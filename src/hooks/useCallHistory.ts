import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CallHistoryItem {
  id: string;
  peer_user_id: string;
  direction: 'incoming' | 'outgoing';
  call_type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'completed' | 'missed' | 'rejected' | 'failed' | 'canceled';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

export function useCallHistory(peerUserId?: string) {
  const { user } = useAuth();
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user?.id || !peerUserId) {
      setHistory([]);
      return;
    }

    setLoading(true);

    const { data, error } = (await supabase
      .from('call_history' as any)
      .select('id, peer_user_id, direction, call_type, status, started_at, ended_at, duration_seconds')
      .eq('user_id', user.id)
      .eq('peer_user_id', peerUserId)
      .order('started_at', { ascending: false })
      .limit(10)) as { data: CallHistoryItem[] | null; error: any };

    if (error) {
      console.error('[CallHistory] Failed loading history:', error);
      setHistory([]);
      setLoading(false);
      return;
    }

    setHistory(data ?? []);
    setLoading(false);
  }, [peerUserId, user?.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    history,
    loading,
    refetch,
  };
}
