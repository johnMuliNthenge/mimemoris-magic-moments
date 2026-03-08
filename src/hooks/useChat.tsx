import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { playMessageSound } from '@/lib/notification-sound';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  reply_to_id: string | null;
  edited_at: string | null;
  is_deleted: boolean;
  reply_to?: Message;
}

interface ChatUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_message?: Message;
  unread_count: number;
}

export function useChat(selectedUserId?: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
      const cleanup = subscribeToMessages();
      return cleanup;
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedUserId) {
      fetchMessages(selectedUserId);
      markAsRead(selectedUserId);
    }
  }, [user, selectedUserId]);

  const fetchConversations = async () => {
    if (!user) return;

    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!allMessages) {
      setLoading(false);
      return;
    }

    // Group by conversation partner
    const conversationMap = new Map<string, { messages: Message[]; unread: number }>();
    
    allMessages.forEach(msg => {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, { messages: [], unread: 0 });
      }
      
      const conv = conversationMap.get(partnerId)!;
      conv.messages.push(msg as Message);
      
      if (!msg.is_read && msg.receiver_id === user.id) {
        conv.unread++;
      }
    });

    // Fetch profile info for each partner
    const partnerIds = Array.from(conversationMap.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', partnerIds);

    const convList: ChatUser[] = partnerIds.map(partnerId => {
      const conv = conversationMap.get(partnerId)!;
      const profile = profiles?.find(p => p.user_id === partnerId);
      
      return {
        user_id: partnerId,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        last_message: conv.messages[0],
        unread_count: conv.unread
      };
    });

    setConversations(convList);
    setLoading(false);
  };

  const fetchMessages = async (partnerId: string) => {
    if (!user) return;

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    // Fetch reply messages if any
    const messagesWithReplies = await Promise.all(
      (data || []).map(async (msg) => {
        if (msg.reply_to_id) {
          const { data: replyMsg } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('id', msg.reply_to_id)
            .single();
          return { ...msg, reply_to: replyMsg } as Message;
        }
        return msg as Message;
      })
    );

    setMessages(messagesWithReplies);
  };

  const subscribeToMessages = () => {
    if (!user) return () => {};

    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === user.id || newMsg.receiver_id === user.id) {
            if (selectedUserId && (newMsg.sender_id === selectedUserId || newMsg.receiver_id === selectedUserId)) {
              setMessages(prev => [...prev, newMsg]);
            }
            fetchConversations();
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
        } else if (payload.eventType === 'DELETE') {
          const deletedMsg = payload.old as { id: string };
          setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
          fetchConversations();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (receiverId: string, content: string, replyToId?: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        reply_to_id: replyToId || null
      })
      .select()
      .single();

    return { error, data };
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_messages')
      .update({ 
        content: newContent,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (!error) {
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, content: newContent, edited_at: new Date().toISOString() } 
          : m
      ));
    }

    return { error };
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchConversations();
    }

    return { error };
  };

  const markAsRead = async (senderId: string) => {
    if (!user) return;

    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    fetchConversations();
  };

  const canEditMessage = useCallback((message: Message) => {
    if (!user || message.sender_id !== user.id) return false;
    const createdAt = new Date(message.created_at).getTime();
    const now = Date.now();
    return (now - createdAt) <= 40000; // 40 seconds
  }, [user]);

  return {
    conversations,
    messages,
    loading,
    sendMessage,
    editMessage,
    deleteMessage,
    fetchMessages,
    markAsRead,
    canEditMessage,
    refetch: fetchConversations
  };
}
