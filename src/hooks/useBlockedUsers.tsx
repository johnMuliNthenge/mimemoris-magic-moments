import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface BlockedUser {
  id: string;
  blocked_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export function useBlockedUsers() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBlockedUsers();
    }
  }, [user]);

  const fetchBlockedUsers = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', user.id);

    if (data && data.length > 0) {
      // Fetch profiles for blocked users
      const blockedUserIds = data.map(b => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', blockedUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const blockedList: BlockedUser[] = data.map(b => ({
        id: b.id,
        blocked_id: b.blocked_id,
        full_name: profileMap.get(b.blocked_id)?.full_name || null,
        avatar_url: profileMap.get(b.blocked_id)?.avatar_url || null,
        created_at: b.created_at
      }));

      setBlockedUsers(blockedList);
      setBlockedIds(new Set(blockedUserIds));
    } else {
      setBlockedUsers([]);
      setBlockedIds(new Set());
    }

    setLoading(false);
  };

  const blockUser = async (targetUserId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('blocked_users')
      .insert({
        blocker_id: user.id,
        blocked_id: targetUserId
      });

    if (!error) {
      // Also remove any friend relationships
      await supabase
        .from('user_follows')
        .delete()
        .or(`and(follower_id.eq.${user.id},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${user.id})`);
      
      fetchBlockedUsers();
    }
    return { error };
  };

  const unblockUser = async (blockId: string) => {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('id', blockId);

    if (!error) fetchBlockedUsers();
    return { error };
  };

  const isBlocked = (userId: string) => blockedIds.has(userId);

  return {
    blockedUsers,
    blockedIds,
    loading,
    blockUser,
    unblockUser,
    isBlocked,
    refetch: fetchBlockedUsers
  };
}
