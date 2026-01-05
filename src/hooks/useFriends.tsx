import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Friend {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  is_follower: boolean;
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFriends();
      subscribeToChanges();
    }
  }, [user]);

  const fetchFriends = async () => {
    if (!user) return;

    // Get people I'm following
    const { data: following } = await supabase
      .from('user_follows')
      .select('*, profiles!user_follows_following_id_fkey(*)')
      .eq('follower_id', user.id);

    // Get people following me
    const { data: followers } = await supabase
      .from('user_follows')
      .select('*, profiles!user_follows_follower_id_fkey(*)')
      .eq('following_id', user.id);

    const friendsList: Friend[] = [];
    const pendingList: Friend[] = [];

    // Process following
    following?.forEach(f => {
      const friend: Friend = {
        id: f.id,
        user_id: f.following_id,
        full_name: (f as any).profiles?.full_name || null,
        avatar_url: (f as any).profiles?.avatar_url || null,
        status: f.status as 'pending' | 'accepted' | 'rejected',
        created_at: f.created_at,
        is_follower: false
      };

      if (f.status === 'accepted') {
        friendsList.push(friend);
      } else if (f.status === 'pending') {
        pendingList.push(friend);
      }
    });

    // Process followers (pending requests to me)
    followers?.forEach(f => {
      if (f.status === 'pending') {
        pendingList.push({
          id: f.id,
          user_id: f.follower_id,
          full_name: (f as any).profiles?.full_name || null,
          avatar_url: (f as any).profiles?.avatar_url || null,
          status: f.status as 'pending' | 'accepted' | 'rejected',
          created_at: f.created_at,
          is_follower: true
        });
      } else if (f.status === 'accepted') {
        // Check if already in friendsList
        const exists = friendsList.find(fr => fr.user_id === f.follower_id);
        if (!exists) {
          friendsList.push({
            id: f.id,
            user_id: f.follower_id,
            full_name: (f as any).profiles?.full_name || null,
            avatar_url: (f as any).profiles?.avatar_url || null,
            status: f.status as 'pending' | 'accepted' | 'rejected',
            created_at: f.created_at,
            is_follower: true
          });
        }
      }
    });

    setFriends(friendsList);
    setPendingRequests(pendingList);
    setLoading(false);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('friends-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_follows'
      }, () => {
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: user.id,
        following_id: targetUserId,
        status: 'pending'
      });

    if (!error) fetchFriends();
    return { error };
  };

  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('user_follows')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (!error) fetchFriends();
    return { error };
  };

  const rejectRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('user_follows')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (!error) fetchFriends();
    return { error };
  };

  const unfriend = async (followId: string) => {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('id', followId);

    if (!error) fetchFriends();
    return { error };
  };

  return {
    friends,
    pendingRequests,
    loading,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    unfriend,
    refetch: fetchFriends
  };
}
