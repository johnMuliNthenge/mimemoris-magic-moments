import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type GroupCallStatus = 'idle' | 'joining' | 'connected' | 'ended';

interface Participant {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  stream: MediaStream | null;
  pc: RTCPeerConnection | null;
}

interface ActiveGroupCall {
  id: string;
  group_id: string;
  started_by: string;
  call_type: 'audio' | 'video';
  status: string;
  started_at: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useGroupCall(groupId: string) {
  const { user } = useAuth();
  const [status, setStatus] = useState<GroupCallStatus>('idle');
  const [activeCall, setActiveCall] = useState<ActiveGroupCall | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeCallRef = useRef<ActiveGroupCall | null>(null);

  // Keep refs in sync
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  // Check for active call on mount
  useEffect(() => {
    if (!groupId) return;
    checkActiveCall();
    const sub = subscribeToCallChanges();
    return () => { sub?.then(ch => ch && supabase.removeChannel(ch)); };
  }, [groupId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup(false);
    };
  }, []);

  const checkActiveCall = async () => {
    const { data } = await supabase
      .from('group_calls')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setActiveCall(data[0] as ActiveGroupCall);
    } else {
      setActiveCall(null);
    }
  };

  const subscribeToCallChanges = async () => {
    const channel = supabase
      .channel(`group-calls-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_calls',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const call = payload.new as ActiveGroupCall;
          if (call.status === 'active') {
            setActiveCall(call);
          } else if (call.status === 'ended') {
            setActiveCall(null);
            if (activeCallRef.current?.id === call.id) {
              cleanup(false);
            }
          }
        }
      })
      .subscribe();
    return channel;
  };

  const getMedia = async (callType: 'audio' | 'video') => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const createPeerConnection = (remoteUserId: string, stream: MediaStream): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const remoteStream = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        if (!remoteStream.getTracks().some(t => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
      setParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(remoteUserId);
        if (existing) {
          next.set(remoteUserId, { ...existing, stream: remoteStream });
        }
        return next;
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: user!.id,
            to: remoteUserId,
            candidate: event.candidate.toJSON()
          }
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    peersRef.current.set(remoteUserId, pc);
    return pc;
  };

  const setupSignaling = (callId: string) => {
    const channel = supabase.channel(`group-call-signal-${callId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== user!.id) return;
        const pc = peersRef.current.get(payload.from) || createPeerConnection(payload.from, localStreamRef.current!);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: { from: user!.id, to: payload.from, sdp: answer }
        });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== user!.id) return;
        const pc = peersRef.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== user!.id) return;
        const pc = peersRef.current.get(payload.from);
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { }
        }
      })
      .on('broadcast', { event: 'user-joined' }, async ({ payload }) => {
        if (payload.userId === user!.id) return;
        // Add participant entry
        await addParticipantEntry(payload.userId, payload.name, payload.avatar);
        // Existing member sends offer to new joiner
        const pc = createPeerConnection(payload.userId, localStreamRef.current!);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: { from: user!.id, to: payload.userId, sdp: offer }
        });
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        removePeer(payload.userId);
      })
      .on('broadcast', { event: 'user-kicked' }, ({ payload }) => {
        if (payload.userId === user!.id) {
          // I was kicked
          cleanup(false);
          setStatus('ended');
        } else {
          removePeer(payload.userId);
        }
      })
      .subscribe();

    signalingChannelRef.current = channel;
  };

  const addParticipantEntry = async (userId: string, name?: string, avatar?: string) => {
    let fullName = name || null;
    let avatarUrl = avatar || null;
    if (!fullName) {
      const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('user_id', userId).single();
      if (data) { fullName = data.full_name; avatarUrl = data.avatar_url; }
    }
    setParticipants(prev => {
      const next = new Map(prev);
      if (!next.has(userId)) {
        next.set(userId, { user_id: userId, full_name: fullName, avatar_url: avatarUrl, stream: null, pc: null });
      }
      return next;
    });
  };

  const removePeer = (userId: string) => {
    const pc = peersRef.current.get(userId);
    if (pc) { pc.close(); peersRef.current.delete(userId); }
    setParticipants(prev => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const startCall = async (callType: 'audio' | 'video') => {
    if (!user) return;
    setStatus('joining');

    try {
      const stream = await getMedia(callType);

      // Create the call record
      const { data: callData, error } = await supabase
        .from('group_calls')
        .insert({ group_id: groupId, started_by: user.id, call_type: callType })
        .select()
        .single();

      if (error || !callData) throw error || new Error('Failed to create call');

      const call = callData as ActiveGroupCall;
      setActiveCall(call);
      setIsHost(true);

      // Add self as participant
      await supabase.from('group_call_participants').insert({ call_id: call.id, user_id: user.id });

      // Setup signaling
      setupSignaling(call.id);

      // Announce self
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'user-joined',
        payload: { userId: user.id }
      });

      setStatus('connected');
    } catch (err) {
      console.error('Failed to start group call:', err);
      cleanup(false);
      setStatus('idle');
    }
  };

  const joinCall = async () => {
    if (!user || !activeCall) return;
    setStatus('joining');

    try {
      const stream = await getMedia(activeCall.call_type as 'audio' | 'video');
      setIsHost(activeCall.started_by === user.id);

      // Add self as participant in DB
      await supabase.from('group_call_participants')
        .upsert({ call_id: activeCall.id, user_id: user.id, left_at: null, was_kicked: false }, { onConflict: 'call_id,user_id' });

      // Get existing participants to know who to connect with
      const { data: existingParticipants } = await supabase
        .from('group_call_participants')
        .select('user_id')
        .eq('call_id', activeCall.id)
        .is('left_at', null);

      // Setup signaling
      setupSignaling(activeCall.id);

      // Add participant entries for existing members
      if (existingParticipants) {
        for (const p of existingParticipants) {
          if (p.user_id !== user.id) {
            await addParticipantEntry(p.user_id);
          }
        }
      }

      // Fetch own profile for broadcast
      const { data: myProfile } = await supabase.from('profiles').select('full_name, avatar_url').eq('user_id', user.id).single();

      // Announce joining - existing members will send offers
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'user-joined',
        payload: { userId: user.id, name: myProfile?.full_name, avatar: myProfile?.avatar_url }
      });

      setStatus('connected');
    } catch (err) {
      console.error('Failed to join group call:', err);
      cleanup(false);
      setStatus('idle');
    }
  };

  const leaveCall = async () => {
    if (!user || !activeCall) return;

    // If host, end the entire call
    if (isHost) {
      await supabase.from('group_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', activeCall.id);
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { userId: user.id }
      });
    } else {
      // Mark self as left
      await supabase.from('group_call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { userId: user.id }
      });
    }

    cleanup(true);
  };

  const kickParticipant = async (userId: string) => {
    if (!user || !activeCall || !isHost) return;

    await supabase.from('group_call_participants')
      .update({ left_at: new Date().toISOString(), was_kicked: true })
      .eq('call_id', activeCall.id)
      .eq('user_id', userId);

    signalingChannelRef.current?.send({
      type: 'broadcast',
      event: 'user-kicked',
      payload: { userId }
    });

    removePeer(userId);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(prev => !prev);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsVideoOff(prev => !prev);
    }
  };

  const cleanup = (resetStatus = true) => {
    // Close all peer connections
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    // Stop local media
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Remove signaling channel
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }

    setParticipants(new Map());
    setIsHost(false);
    setIsMuted(false);
    setIsVideoOff(false);
    if (resetStatus) {
      setStatus('idle');
      setActiveCall(null);
    }
  };

  return {
    status,
    activeCall,
    participants,
    localStream,
    isHost,
    isMuted,
    isVideoOff,
    startCall,
    joinCall,
    leaveCall,
    kickParticipant,
    toggleMute,
    toggleVideo,
  };
}
