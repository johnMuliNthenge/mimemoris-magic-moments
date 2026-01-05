import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
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
      subscribeToMessages();
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

    setMessages((data as Message[]) || []);
  };

  const subscribeToMessages = () => {
    if (!user) return;

    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.sender_id === user.id || newMsg.receiver_id === user.id) {
          if (selectedUserId && (newMsg.sender_id === selectedUserId || newMsg.receiver_id === selectedUserId)) {
            setMessages(prev => [...prev, newMsg]);
          }
          fetchConversations();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (receiverId: string, content: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content
      })
      .select()
      .single();

    if (!error && data) {
      setMessages(prev => [...prev, data as Message]);
    }

    return { error, data };
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

  return {
    conversations,
    messages,
    loading,
    sendMessage,
    fetchMessages,
    markAsRead,
    refetch: fetchConversations
  };
}
