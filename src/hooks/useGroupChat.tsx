import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { signMediaFields, signSingleMediaUrl } from '@/lib/storage-utils';

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  sender_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  reply_to?: GroupMessage;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  invite_code: string;
  max_members: number;
  created_at: string;
  member_count?: number;
}

export function useGroupChat(groupId?: string) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentGroup, setCurrentGroup] = useState<ChatGroup | null>(null);

  useEffect(() => {
    if (user) {
      fetchGroups();
      
      // Subscribe to membership changes so user sees groups they're added to
      const memberChannel = supabase
        .channel('my-group-memberships')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chat_group_members',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchGroups();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(memberChannel);
      };
    }
  }, [user]);

  useEffect(() => {
    if (user && groupId) {
      fetchGroupDetails(groupId);
      fetchMessages(groupId);
      fetchMembers(groupId);
      const cleanup = subscribeToMessages(groupId);
      return cleanup;
    }
  }, [user, groupId]);

  const fetchGroups = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('chat_groups')
      .select('*')
      .order('created_at', { ascending: false });

    setGroups((data as ChatGroup[]) || []);
    setLoading(false);
  };

  const fetchGroupDetails = async (gId: string) => {
    const { data } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('id', gId)
      .single();

    if (data) {
      setCurrentGroup(data as ChatGroup);
    }
  };

  const fetchMessages = async (gId: string) => {
    const { data } = await supabase
      .from('chat_group_messages')
      .select('*')
      .eq('group_id', gId)
      .order('created_at', { ascending: true });

    if (!data) {
      setMessages([]);
      return;
    }

    const signedMessages = await signMediaFields(data as GroupMessage[], ['media_url']);

    // Fetch sender profiles
    const senderIds = [...new Set(signedMessages.map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', senderIds);

    const messagesWithProfiles = signedMessages.map(msg => ({
      ...msg,
      sender_profile: profiles?.find(p => p.user_id === msg.sender_id)
    })) as GroupMessage[];

    setMessages(messagesWithProfiles);
  };

  const fetchMembers = async (gId: string) => {
    const { data } = await supabase
      .from('chat_group_members')
      .select('*')
      .eq('group_id', gId);

    if (!data) {
      setMembers([]);
      return;
    }

    // Fetch member profiles
    const userIds = data.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    const membersWithProfiles = data.map(member => ({
      ...member,
      profile: profiles?.find(p => p.user_id === member.user_id)
    })) as GroupMember[];

    setMembers(membersWithProfiles);
  };

  const subscribeToMessages = (gId: string) => {
    const channel = supabase
      .channel(`group-messages-${gId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_group_messages',
        filter: `group_id=eq.${gId}`
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as GroupMessage;
          const signedMediaUrl = await signSingleMediaUrl(newMsg.media_url || null);

          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .eq('user_id', newMsg.sender_id)
            .single();
          
          setMessages(prev => [...prev, { ...newMsg, media_url: signedMediaUrl, sender_profile: profile || undefined }]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as GroupMessage;
          const signedMediaUrl = await signSingleMediaUrl(updatedMsg.media_url || null);
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg, media_url: signedMediaUrl } : m));
        } else if (payload.eventType === 'DELETE') {
          const deletedMsg = payload.old as { id: string };
          setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createGroup = async (name: string, description?: string) => {
    if (!user) return { error: 'Not authenticated', data: null };

    const { data, error } = await supabase
      .from('chat_groups')
      .insert({
        name,
        description,
        created_by: user.id
      })
      .select()
      .single();

    if (error) return { error: error.message, data: null };

    // Add creator as admin
    await supabase
      .from('chat_group_members')
      .insert({
        group_id: data.id,
        user_id: user.id,
        role: 'admin'
      });

    await fetchGroups();
    return { error: null, data: data as ChatGroup };
  };

  const joinGroupByCode = async (inviteCode: string) => {
    if (!user) return { error: 'Not authenticated' };

    // Use secure server-side RPC for all validation and joining
    const { data, error } = await supabase
      .rpc('join_group_by_invite_code', { _invite_code: inviteCode }) as { data: any; error: any };

    if (error) return { error: error.message };

    if (data?.error) {
      return { error: data.error, groupId: data.group_id || null };
    }

    await fetchGroups();
    return { error: null, groupId: data.group_id };
  };

  const sendMessage = async (content: string, replyToId?: string, mediaUrl?: string, mediaType?: string) => {
    if (!user || !groupId) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_group_messages')
      .insert({
        group_id: groupId,
        sender_id: user.id,
        content,
        reply_to_id: replyToId || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null
      });

    return { error: error?.message || null };
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_group_messages')
      .update({ 
        content: newContent,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    return { error: error?.message || null };
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_group_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id);

    return { error: error?.message || null };
  };

  const addMember = async (userId: string) => {
    if (!user || !groupId) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role: 'member'
      });

    if (!error) {
      await fetchMembers(groupId);
    }

    return { error: error?.message || null };
  };

  const removeMember = async (userId: string) => {
    if (!user || !groupId) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (!error) {
      await fetchMembers(groupId);
    }

    return { error: error?.message || null };
  };

  const leaveGroup = async () => {
    if (!user || !groupId) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);

    if (!error) {
      await fetchGroups();
    }

    return { error: error?.message || null };
  };

  const canEditMessage = useCallback((message: GroupMessage) => {
    if (!user || message.sender_id !== user.id) return false;
    const createdAt = new Date(message.created_at).getTime();
    const now = Date.now();
    return (now - createdAt) <= 40000; // 40 seconds
  }, [user]);

  const isAdmin = useCallback(() => {
    if (!user) return false;
    return members.some(m => m.user_id === user.id && m.role === 'admin');
  }, [user, members]);

  return {
    groups,
    messages,
    members,
    currentGroup,
    loading,
    createGroup,
    joinGroupByCode,
    sendMessage,
    editMessage,
    deleteMessage,
    addMember,
    removeMember,
    leaveGroup,
    canEditMessage,
    isAdmin,
    refetch: fetchGroups
  };
}
