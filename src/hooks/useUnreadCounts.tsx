import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UnreadCounts {
  messages: number;
  friendRequests: number;
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ messages: 0, friendRequests: 0 });

  useEffect(() => {
    if (!user?.id) return;

    const fetchCounts = async () => {
      // Unread messages
      const { count: msgCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .eq('is_deleted', false);

      // Pending friend requests (incoming)
      const { count: reqCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id)
        .eq('status', 'pending');

      setCounts({
        messages: msgCount || 0,
        friendRequests: reqCount || 0,
      });
    };

    fetchCounts();

    // Subscribe to new messages for live updates
    const msgChannel = supabase
      .channel('global-unread-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        fetchCounts();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_follows',
        filter: `following_id=eq.${user.id}`,
      }, () => {
        fetchCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id]);

  return counts;
}
