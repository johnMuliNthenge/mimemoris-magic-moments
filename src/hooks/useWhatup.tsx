import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { signMediaFields } from '@/lib/storage-utils';

export interface WhatupPost {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  created_at: string;
  user_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

export interface WhatupComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  user_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  replies?: WhatupComment[];
}

export function useWhatup() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<WhatupPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    const { data: postsData } = await supabase
      .from('whatup_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!postsData) {
      setLoading(false);
      return;
    }

    const signedPosts = await signMediaFields(postsData, ['video_url']);

    const userIds = [...new Set(signedPosts.map(p => p.user_id))];
    const postIds = signedPosts.map(p => p.id);

    const [profilesRes, likesRes, commentsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds),
      supabase.from('whatup_likes').select('post_id, user_id').in('post_id', postIds),
      supabase.from('whatup_comments').select('post_id').in('post_id', postIds),
    ]);

    const profiles = profilesRes.data || [];
    const allLikes = likesRes.data || [];
    const allComments = commentsRes.data || [];

    const enriched: WhatupPost[] = signedPosts.map(post => {
      const profile = profiles.find(p => p.user_id === post.user_id);
      const postLikes = allLikes.filter(l => l.post_id === post.id);
      const postComments = allComments.filter(c => c.post_id === post.id);

      return {
        ...post,
        user_profile: profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : undefined,
        likes_count: postLikes.length,
        comments_count: postComments.length,
        is_liked: user ? postLikes.some(l => l.user_id === user.id) : false,
      };
    });

    setPosts(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('whatup-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatup_likes' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatup_comments' }, () => fetchPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatup_posts' }, () => fetchPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.is_liked) {
      await supabase.from('whatup_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: false, likes_count: p.likes_count - 1 } : p));
    } else {
      await supabase.from('whatup_likes').insert({ post_id: postId, user_id: user.id });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: true, likes_count: p.likes_count + 1 } : p));
    }
  };

  const getComments = async (postId: string): Promise<WhatupComment[]> => {
    const { data: comments } = await supabase
      .from('whatup_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!comments) return [];

    const userIds = [...new Set(comments.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    const enrichedComments: WhatupComment[] = comments.map(comment => ({
      ...comment,
      reply_to_id: (comment as any).reply_to_id || null,
      user_profile: profiles?.find(p => p.user_id === comment.user_id)
        ? { full_name: profiles.find(p => p.user_id === comment.user_id)!.full_name, avatar_url: profiles.find(p => p.user_id === comment.user_id)!.avatar_url }
        : undefined,
    }));

    // Build threaded structure: top-level comments with nested replies
    const topLevel = enrichedComments.filter(c => !c.reply_to_id);
    const replyMap = new Map<string, WhatupComment[]>();
    enrichedComments.filter(c => c.reply_to_id).forEach(reply => {
      const existing = replyMap.get(reply.reply_to_id!) || [];
      existing.push(reply);
      replyMap.set(reply.reply_to_id!, existing);
    });

    return topLevel.map(comment => ({
      ...comment,
      replies: replyMap.get(comment.id) || [],
    }));
  };

  const addComment = async (postId: string, content: string, replyToId?: string) => {
    if (!user) return { error: 'Not authenticated' };

    const insertData: any = {
      post_id: postId,
      user_id: user.id,
      content,
    };
    if (replyToId) insertData.reply_to_id = replyToId;

    const { error } = await supabase.from('whatup_comments').insert(insertData);

    if (!error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));

      // Parse @mentions and create notifications
      const mentions = content.match(/@(\S+)/g);
      if (mentions) {
        const usernames = mentions.map(m => m.slice(1));
        const { data: mentionedUsers } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('full_name', usernames);

        if (mentionedUsers) {
          const notifications = mentionedUsers
            .filter(u => u.user_id !== user.id)
            .map(u => ({
              user_id: u.user_id,
              from_user_id: user.id,
              type: 'trending_mention',
              reference_id: postId,
              content: `tagged you in a Trending comment`,
            }));

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }
        }
      }
    }

    return { error };
  };

  const searchUsers = async (query: string) => {
    if (!query || query.length < 1) return [];
    const { data } = await supabase.rpc('search_users_for_discovery', {
      search_term: query,
      page_size: 5,
    });
    return data || [];
  };

  return { posts, loading, toggleLike, getComments, addComment, searchUsers, refetch: fetchPosts };
}
