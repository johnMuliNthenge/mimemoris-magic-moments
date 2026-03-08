import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalWebRTC } from '@/hooks/useGlobalWebRTC';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallRecord {
  id: string;
  peer_user_id: string;
  direction: string;
  call_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  peer_name?: string;
  peer_avatar?: string;
}

export function CallHistoryPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { initiateCall } = useGlobalWebRTC();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('call_history')
      .select('id, peer_user_id, direction, call_type, status, started_at, ended_at, duration_seconds')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50) as { data: CallRecord[] | null };

    if (!data) { setCalls([]); setLoading(false); return; }

    const peerIds = [...new Set(data.map(c => c.peer_user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', peerIds);

    const enriched = data.map(c => {
      const p = profiles?.find(pr => pr.user_id === c.peer_user_id);
      return { ...c, peer_name: p?.full_name || 'Unknown', peer_avatar: p?.avatar_url || undefined };
    });

    setCalls(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const getIcon = (direction: string, status: string) => {
    if (status === 'missed' || status === 'rejected' || status === 'failed')
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    if (direction === 'incoming')
      return <PhoneIncoming className="w-4 h-4 text-green-500" />;
    return <PhoneOutgoing className="w-4 h-4 text-primary" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-medium">Call History</h3>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
        ) : calls.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">No call history</div>
        ) : (
          <div className="divide-y divide-border">
            {calls.map(call => (
              <div key={call.id} className="p-3 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={call.peer_avatar} />
                  <AvatarFallback>{call.peer_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{call.peer_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {getIcon(call.direction, call.status)}
                    <span className={cn(
                      (call.status === 'missed' || call.status === 'rejected') && 'text-destructive'
                    )}>
                      {call.status === 'completed' ? formatDuration(call.duration_seconds) : call.status}
                    </span>
                    <span>·</span>
                    <span>{format(new Date(call.started_at), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => initiateCall(call.peer_user_id, call.call_type as any, call.peer_name, call.peer_avatar)}
                >
                  {call.call_type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
