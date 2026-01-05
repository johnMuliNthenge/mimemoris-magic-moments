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

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
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
      .select('*')
      .eq('follower_id', user.id);

    // Get people following me
    const { data: followers } = await supabase
      .from('user_follows')
      .select('*')
      .eq('following_id', user.id);

    // Get all user IDs we need profiles for
    const userIds = new Set<string>();
    following?.forEach(f => userIds.add(f.following_id));
    followers?.forEach(f => userIds.add(f.follower_id));

    // Fetch profiles
    const { data: profiles } = userIds.size > 0 
      ? await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', Array.from(userIds))
      : { data: [] as Profile[] };

    const profileMap = new Map<string, Profile>();
    profiles?.forEach(p => profileMap.set(p.user_id, p));

    const friendsList: Friend[] = [];
    const pendingList: Friend[] = [];

    // Process following
    following?.forEach(f => {
      const profile = profileMap.get(f.following_id);
      const friend: Friend = {
        id: f.id,
        user_id: f.following_id,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
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
      const profile = profileMap.get(f.follower_id);
      if (f.status === 'pending') {
        pendingList.push({
          id: f.id,
          user_id: f.follower_id,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
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
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
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
