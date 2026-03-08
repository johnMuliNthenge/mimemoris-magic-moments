import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { playIncomingCallSound } from '@/lib/notification-sound';

export type GroupCallStatus = 'idle' | 'joining' | 'connected' | 'ended';

interface Participant {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  stream: MediaStream | null;
  pc: RTCPeerConnection | null;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());

  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeCallRef = useRef<ActiveGroupCall | null>(null);
  const statusRef = useRef<GroupCallStatus>('idle');

  // ICE candidate buffer: store candidates that arrive before remote description is set
  const iceCandidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Track which peers have had their remote description set
  const remoteDescSetRef = useRef<Set<string>>(new Set());

  // Keep refs in sync
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Check for active call on mount and subscribe to changes
  useEffect(() => {
    if (!groupId || !user) return;
    checkActiveCall();
    const channel = subscribeToCallChanges();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [groupId, user]);

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

  const subscribeToCallChanges = () => {
    const channel = supabase
      .channel(`group-calls-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_calls',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const call = payload.new as ActiveGroupCall;
          if (call.status === 'active') {
            setActiveCall(call);
            if (call.started_by !== user?.id && statusRef.current === 'idle') {
              playIncomingCallSound();
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const call = payload.new as ActiveGroupCall;
          if (call.status === 'active') {
            setActiveCall(call);
          } else if (call.status === 'ended') {
            setActiveCall(null);
            if (activeCallRef.current?.id === call.id && statusRef.current === 'connected') {
              cleanup(true);
              setStatus('ended');
              setTimeout(() => setStatus('idle'), 2000);
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

  /** Flush any buffered ICE candidates for a peer after remote description is set */
  const flushIceCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    remoteDescSetRef.current.add(peerId);
    const buffered = iceCandidateBufferRef.current.get(peerId);
    if (buffered && buffered.length > 0) {
      console.log(`[GroupCall] Flushing ${buffered.length} buffered ICE candidates for ${peerId}`);
      for (const candidate of buffered) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[GroupCall] Failed to add buffered ICE candidate:', e);
        }
      }
      iceCandidateBufferRef.current.delete(peerId);
    }
  };

  /** Add an ICE candidate — either apply immediately or buffer it */
  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    const pc = peersRef.current.get(fromId);
    if (!pc) {
      // No peer connection yet — buffer it
      if (!iceCandidateBufferRef.current.has(fromId)) {
        iceCandidateBufferRef.current.set(fromId, []);
      }
      iceCandidateBufferRef.current.get(fromId)!.push(candidate);
      return;
    }

    if (!remoteDescSetRef.current.has(fromId)) {
      // Remote description not set yet — buffer it
      if (!iceCandidateBufferRef.current.has(fromId)) {
        iceCandidateBufferRef.current.set(fromId, []);
      }
      iceCandidateBufferRef.current.get(fromId)!.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[GroupCall] Failed to add ICE candidate:', e);
    }
  };

  const createPeerConnection = (remoteUserId: string, stream: MediaStream): RTCPeerConnection => {
    // Close existing connection if any
    const existing = peersRef.current.get(remoteUserId);
    if (existing) { existing.close(); }

    // Reset state for this peer
    remoteDescSetRef.current.delete(remoteUserId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const remoteStream = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        if (!remoteStream.getTracks().some(t => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
      if (event.track && !remoteStream.getTracks().some(t => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
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
      const state = pc.iceConnectionState;
      console.log(`[GroupCall] ICE state for ${remoteUserId}: ${state}`);
      const mapped: Participant['connectionState'] =
        state === 'connected' || state === 'completed' ? 'connected' :
        state === 'checking' || state === 'new' ? 'connecting' :
        state === 'disconnected' ? 'reconnecting' : 'disconnected';

      setParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(remoteUserId);
        if (existing) {
          next.set(remoteUserId, { ...existing, connectionState: mapped });
        }
        return next;
      });

      if (state === 'failed') {
        console.log(`[GroupCall] ICE failed for ${remoteUserId}, restarting ICE`);
        pc.restartIce();
      } else if (state === 'disconnected') {
        // Wait a moment before restarting — transient disconnects are common on mobile
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log(`[GroupCall] Still disconnected for ${remoteUserId}, restarting ICE`);
            pc.restartIce();
          }
        }, 3000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection state for ${remoteUserId}: ${pc.connectionState}`);
    };

    peersRef.current.set(remoteUserId, pc);
    return pc;
  };

  const setupSignaling = (callId: string): Promise<void> => {
    return new Promise((resolve) => {
      const channel = supabase.channel(`group-call-signal-${callId}`, {
        config: { broadcast: { self: false } }
      });

      channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.to !== user!.id) return;
          console.log(`[GroupCall] Received offer from ${payload.from}`);
          const pc = peersRef.current.get(payload.from) || createPeerConnection(payload.from, localStreamRef.current!);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            // Flush any buffered ICE candidates now that remote desc is set
            await flushIceCandidates(payload.from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { from: user!.id, to: payload.from, sdp: answer }
            });
            console.log(`[GroupCall] Sent answer to ${payload.from}`);
          } catch (e) {
            console.error('[GroupCall] Error handling offer:', e);
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.to !== user!.id) return;
          console.log(`[GroupCall] Received answer from ${payload.from}`);
          const pc = peersRef.current.get(payload.from);
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              // Flush any buffered ICE candidates now that remote desc is set
              await flushIceCandidates(payload.from, pc);
            } catch (e) {
              console.error('[GroupCall] Error handling answer:', e);
            }
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.to !== user!.id) return;
          // Use the buffering handler instead of directly adding
          await handleIceCandidate(payload.from, payload.candidate);
        })
        .on('broadcast', { event: 'user-joined' }, async ({ payload }) => {
          if (payload.userId === user!.id) return;
          console.log(`[GroupCall] User joined: ${payload.userId}`);
          await addParticipantEntry(payload.userId, payload.name, payload.avatar);
          const pc = createPeerConnection(payload.userId, localStreamRef.current!);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'offer',
            payload: { from: user!.id, to: payload.userId, sdp: offer }
          });
          console.log(`[GroupCall] Sent offer to ${payload.userId}`);
        })
        .on('broadcast', { event: 'user-left' }, ({ payload }) => {
          removePeer(payload.userId);
        })
        .on('broadcast', { event: 'user-kicked' }, ({ payload }) => {
          if (payload.userId === user!.id) {
            cleanup(false);
            setStatus('ended');
            setTimeout(() => setStatus('idle'), 2000);
          } else {
            removePeer(payload.userId);
          }
        })
        .on('broadcast', { event: 'hand-raise' }, ({ payload }) => {
          if (payload.userId === user!.id) return;
          setRaisedHands(prev => {
            const next = new Set(prev);
            if (payload.raised) next.add(payload.userId);
            else next.delete(payload.userId);
            return next;
          });
        })
        .on('broadcast', { event: 'renegotiate-offer' }, async ({ payload }) => {
          if (payload.to !== user!.id) return;
          console.log(`[GroupCall] Received renegotiate offer from ${payload.from}`);
          const pc = peersRef.current.get(payload.from);
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              await flushIceCandidates(payload.from, pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              channel.send({
                type: 'broadcast',
                event: 'answer',
                payload: { from: user!.id, to: payload.from, sdp: answer }
              });
            } catch (e) {
              console.error('[GroupCall] Error handling renegotiate:', e);
            }
          }
        })
        .subscribe((st) => {
          if (st === 'SUBSCRIBED') {
            console.log(`[GroupCall] Signaling channel subscribed for call ${callId}`);
            signalingChannelRef.current = channel;
            resolve();
          }
        });
    });
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
        next.set(userId, { user_id: userId, full_name: fullName, avatar_url: avatarUrl, stream: null, pc: null, connectionState: 'connecting' });
      }
      return next;
    });
  };

  const removePeer = (userId: string) => {
    const pc = peersRef.current.get(userId);
    if (pc) { pc.close(); peersRef.current.delete(userId); }
    remoteDescSetRef.current.delete(userId);
    iceCandidateBufferRef.current.delete(userId);
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

      const { data: callData, error } = await supabase
        .from('group_calls')
        .insert({ group_id: groupId, started_by: user.id, call_type: callType })
        .select()
        .single();

      if (error || !callData) throw error || new Error('Failed to create call');

      const call = callData as ActiveGroupCall;
      setActiveCall(call);
      setIsHost(true);

      await supabase.from('group_call_participants').insert({ call_id: call.id, user_id: user.id });

      await setupSignaling(call.id);

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

      await supabase.from('group_call_participants')
        .upsert({ call_id: activeCall.id, user_id: user.id, left_at: null, was_kicked: false }, { onConflict: 'call_id,user_id' });

      // Get existing participants
      const { data: existingParticipants } = await supabase
        .from('group_call_participants')
        .select('user_id')
        .eq('call_id', activeCall.id)
        .is('left_at', null);

      // Setup signaling FIRST and wait for subscription
      await setupSignaling(activeCall.id);

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

      // Small delay to ensure signaling is fully ready before announcing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Announce — existing members will send offers
      signalingChannelRef.current!.send({
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

    if (isHost) {
      await supabase.from('group_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', activeCall.id);
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { userId: user.id }
      });
    } else {
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

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });

      screenStreamRef.current = screen;
      setScreenStream(screen);
      setIsScreenSharing(true);

      const screenTrack = screen.getVideoTracks()[0];

      screenTrack.onended = () => {
        stopScreenShare();
      };

      peersRef.current.forEach((pc, peerId) => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
          screenSendersRef.current.set(peerId, videoSender);
        }
      });

      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'screen-share',
        payload: { userId: user!.id, sharing: true }
      });
    } catch (err) {
      console.log('Screen share cancelled or failed:', err);
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      screenSendersRef.current.forEach((sender) => {
        sender.replaceTrack(cameraTrack);
      });
    }
    screenSendersRef.current.clear();

    signalingChannelRef.current?.send({
      type: 'broadcast',
      event: 'screen-share',
      payload: { userId: user!.id, sharing: false }
    });
  };

  const cleanup = (resetStatus = true) => {
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    screenSendersRef.current.clear();

    // Clear ICE candidate buffers
    iceCandidateBufferRef.current.clear();
    remoteDescSetRef.current.clear();

    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }

    setParticipants(new Map());
    setIsHost(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    if (resetStatus) {
      setStatus('idle');
      setActiveCall(null);
    }
  };

  const toggleHandRaise = () => {
    const newRaised = !handRaised;
    setHandRaised(newRaised);
    signalingChannelRef.current?.send({
      type: 'broadcast',
      event: 'hand-raise',
      payload: { userId: user!.id, raised: newRaised },
    });
  };

  return {
    status,
    activeCall,
    participants,
    localStream,
    screenStream,
    isHost,
    isMuted,
    isVideoOff,
    isScreenSharing,
    handRaised,
    raisedHands,
    startCall,
    joinCall,
    leaveCall,
    kickParticipant,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleHandRaise,
  };
}
