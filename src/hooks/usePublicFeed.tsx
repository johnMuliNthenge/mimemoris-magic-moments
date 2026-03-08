import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { signMediaFields } from '@/lib/storage-utils';

interface PublicMemory {
  id: string;
  user_id: string;
  memory_type: 'text' | 'audio' | 'video' | 'photo';
  memory_date: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
  mood: string | null;
  created_at: string;
  user_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

interface Comment {
  id: string;
  memory_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function usePublicFeed() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<PublicMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchPublicMemories(0);
    subscribeToChanges();
  }, [user]);

  const fetchPublicMemories = async (page: number) => {
    if (page === 0) setLoading(true);
    else setLoadingMore(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: memoriesData } = await supabase
      .from('memories')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!memoriesData) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setHasMore(memoriesData.length === PAGE_SIZE);

    const signedMemoriesData = await signMediaFields(memoriesData, ['media_url']);

    // Get user profiles
    const userIds = [...new Set(signedMemoriesData.map(m => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    // Get likes count and user's likes
    const memoryIds = signedMemoriesData.map(m => m.id);
    const { data: allLikes } = await supabase
      .from('memory_likes')
      .select('memory_id, user_id')
      .in('memory_id', memoryIds);

    // Get comments count
    const { data: allComments } = await supabase
      .from('memory_comments')
      .select('memory_id')
      .in('memory_id', memoryIds);

    const memoriesWithInfo: PublicMemory[] = signedMemoriesData.map(memory => {
      const profile = profiles?.find(p => p.user_id === memory.user_id);
      const memoryLikes = allLikes?.filter(l => l.memory_id === memory.id) || [];
      const memoryComments = allComments?.filter(c => c.memory_id === memory.id) || [];

      return {
        ...memory,
        memory_type: memory.memory_type as 'text' | 'audio' | 'video' | 'photo',
        user_profile: profile ? {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url
        } : undefined,
        likes_count: memoryLikes.length,
        comments_count: memoryComments.length,
        is_liked: user ? memoryLikes.some(l => l.user_id === user.id) : false
      };
    });

    if (page === 0) {
      setMemories(memoriesWithInfo);
    } else {
      setMemories(prev => [...prev, ...memoriesWithInfo]);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('public-feed')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'memory_likes'
      }, () => fetchPublicMemories())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'memory_comments'
      }, () => fetchPublicMemories())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleLike = async (memoryId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return { error: 'Memory not found' };

    if (memory.is_liked) {
      const { error } = await supabase
        .from('memory_likes')
        .delete()
        .eq('memory_id', memoryId)
        .eq('user_id', user.id);

      if (!error) {
        setMemories(prev => prev.map(m => 
          m.id === memoryId 
            ? { ...m, is_liked: false, likes_count: m.likes_count - 1 }
            : m
        ));
      }
      return { error };
    } else {
      const { error } = await supabase
        .from('memory_likes')
        .insert({ memory_id: memoryId, user_id: user.id });

      if (!error) {
        setMemories(prev => prev.map(m => 
          m.id === memoryId 
            ? { ...m, is_liked: true, likes_count: m.likes_count + 1 }
            : m
        ));
      }
      return { error };
    }
  };

  const getComments = async (memoryId: string): Promise<Comment[]> => {
    const { data: comments } = await supabase
      .from('memory_comments')
      .select('*')
      .eq('memory_id', memoryId)
      .order('created_at', { ascending: true });

    if (!comments) return [];

    const userIds = [...new Set(comments.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    return comments.map(comment => ({
      ...comment,
      user_profile: profiles?.find(p => p.user_id === comment.user_id) 
        ? {
            full_name: profiles.find(p => p.user_id === comment.user_id)!.full_name,
            avatar_url: profiles.find(p => p.user_id === comment.user_id)!.avatar_url
          }
        : undefined
    }));
  };

  const addComment = async (memoryId: string, content: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('memory_comments')
      .insert({
        memory_id: memoryId,
        user_id: user.id,
        content
      });

    if (!error) {
      setMemories(prev => prev.map(m => 
        m.id === memoryId 
          ? { ...m, comments_count: m.comments_count + 1 }
          : m
      ));
    }

    return { error };
  };

  const makeMemoryPublic = async (memoryId: string, isPublic: boolean) => {
    const { error } = await supabase
      .from('memories')
      .update({ is_public: isPublic })
      .eq('id', memoryId);

    if (!error) fetchPublicMemories();
    return { error };
  };

  return {
    memories,
    loading,
    toggleLike,
    getComments,
    addComment,
    makeMemoryPublic,
    refetch: fetchPublicMemories
  };
}
