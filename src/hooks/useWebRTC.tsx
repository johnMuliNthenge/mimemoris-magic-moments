import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

interface CallState {
  status: CallStatus;
  type: CallType;
  remoteUserId: string | null;
  remoteUserName?: string;
  remoteUserAvatar?: string;
  isIncoming: boolean;
  duration: number;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTC() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    type: 'audio',
    remoteUserId: null,
    isIncoming: false,
    duration: 0,
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCallType = useRef<CallType>('audio');

  const cleanup = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => t.stop());
      localStream.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (signalingChannel.current) {
      supabase.removeChannel(signalingChannel.current);
      signalingChannel.current = null;
    }
    remoteStream.current = null;
    pendingCandidates.current = [];
    pendingOffer.current = null;
    setCallState({ status: 'idle', type: 'audio', remoteUserId: null, isIncoming: false, duration: 0 });
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationInterval.current) clearInterval(durationInterval.current);
    durationInterval.current = setInterval(() => {
      setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  const getMedia = useCallback(async (callType: CallType) => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.current = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback((onConnected: () => void) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    remoteStream.current = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remoteStream.current?.addTrack(track);
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannel.current) {
        signalingChannel.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate.toJSON(), from: user?.id },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        onConnected();
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        cleanup();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [user?.id, cleanup]);

  const getChannelName = useCallback((remoteUserId: string) => {
    return `call-${[user?.id, remoteUserId].sort().join('-')}`;
  }, [user?.id]);

  // ─── INITIATE CALL (caller side) ───
  const initiateCall = useCallback(async (
    remoteUserId: string,
    callType: CallType,
    remoteUserName?: string,
    remoteUserAvatar?: string
  ) => {
    if (!user?.id) return;
    console.log('[WebRTC] Initiating call to', remoteUserId, callType);

    try {
      // 1. Update UI
      setCallState({
        status: 'calling',
        type: callType,
        remoteUserId,
        remoteUserName,
        remoteUserAvatar,
        isIncoming: false,
        duration: 0,
      });

      // 2. Get media
      const stream = await getMedia(callType);

      // 3. Create peer connection
      const pc = createPeerConnection(() => {
        setCallState(prev => ({ ...prev, status: 'connected' }));
        startDurationTimer();
      });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 4. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Subscribe to signaling channel
      const channelName = getChannelName(remoteUserId);
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        console.log('[WebRTC] Received answer');
        if (!peerConnection.current) return;
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          // Flush pending ICE candidates
          for (const c of pendingCandidates.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidates.current = [];
        } catch (err) {
          console.error('[WebRTC] Error setting answer:', err);
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from === user.id) return;
        if (peerConnection.current?.remoteDescription) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          pendingCandidates.current.push(payload.candidate);
        }
      });

      channel.on('broadcast', { event: 'end-call' }, () => {
        console.log('[WebRTC] Remote ended call');
        cleanup();
      });

      channel.on('broadcast', { event: 'reject-call' }, () => {
        console.log('[WebRTC] Call rejected');
        cleanup();
      });

      // When callee signals ready, send the offer
      channel.on('broadcast', { event: 'ready-for-offer' }, () => {
        console.log('[WebRTC] Callee ready, sending offer');
        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            offer: peerConnection.current?.localDescription,
            from: user.id,
            callType,
          },
        });
      });

      await channel.subscribe((status) => {
        console.log('[WebRTC] Caller channel status:', status);
      });
      signalingChannel.current = channel;

      // 6. Notify the remote user via their personal incoming channel
      const notifyChannel = supabase.channel(`incoming-calls-${remoteUserId}`);
      await notifyChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[WebRTC] Sending incoming-call notification');
          notifyChannel.send({
            type: 'broadcast',
            event: 'incoming-call',
            payload: {
              from: user.id,
              callType,
              callerName: user.user_metadata?.full_name || 'Unknown',
              callerAvatar: undefined,
            },
          });
          // Keep channel alive briefly then remove
          setTimeout(() => supabase.removeChannel(notifyChannel), 3000);
        }
      });

    } catch (err) {
      console.error('[WebRTC] Failed to initiate call:', err);
      cleanup();
    }
  }, [user, getMedia, createPeerConnection, getChannelName, startDurationTimer, cleanup]);

  // ─── ACCEPT CALL (callee side) ───
  const acceptCall = useCallback(async () => {
    if (!callState.remoteUserId || !user?.id) return;
    const remoteUserId = callState.remoteUserId;
    const callType = callState.type;
    console.log('[WebRTC] Accepting call from', remoteUserId);

    try {
      // 1. Get media
      const stream = await getMedia(callType);

      // 2. Create peer connection
      const pc = createPeerConnection(() => {
        setCallState(prev => ({ ...prev, status: 'connected' }));
        startDurationTimer();
      });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 3. Subscribe to signaling channel
      const channelName = getChannelName(remoteUserId);
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        console.log('[WebRTC] Received offer SDP');
        if (!peerConnection.current) return;
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
          // Flush pending ICE candidates
          for (const c of pendingCandidates.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidates.current = [];

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          console.log('[WebRTC] Sending answer');
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer, from: user.id },
          });
        } catch (err) {
          console.error('[WebRTC] Error handling offer:', err);
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from === user.id) return;
        if (peerConnection.current?.remoteDescription) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          pendingCandidates.current.push(payload.candidate);
        }
      });

      channel.on('broadcast', { event: 'end-call' }, () => {
        console.log('[WebRTC] Remote ended call');
        cleanup();
      });

      await channel.subscribe((status) => {
        console.log('[WebRTC] Callee channel status:', status);
        if (status === 'SUBSCRIBED') {
          // Signal to caller that we're ready to receive the offer
          console.log('[WebRTC] Sending ready-for-offer');
          channel.send({
            type: 'broadcast',
            event: 'ready-for-offer',
            payload: { from: user.id },
          });
        }
      });
      signalingChannel.current = channel;

      setCallState(prev => ({ ...prev, status: 'calling' }));

    } catch (err) {
      console.error('[WebRTC] Failed to accept call:', err);
      cleanup();
    }
  }, [callState.remoteUserId, callState.type, user, getMedia, createPeerConnection, getChannelName, startDurationTimer, cleanup]);

  // ─── REJECT CALL ───
  const rejectCall = useCallback(() => {
    if (!callState.remoteUserId || !user?.id) return;
    // Send reject on the shared channel
    const channelName = getChannelName(callState.remoteUserId);
    const rejectChannel = supabase.channel(channelName);
    rejectChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        rejectChannel.send({
          type: 'broadcast',
          event: 'reject-call',
          payload: { from: user.id },
        });
        setTimeout(() => supabase.removeChannel(rejectChannel), 1000);
      }
    });
    cleanup();
  }, [callState.remoteUserId, user?.id, getChannelName, cleanup]);

  // ─── END CALL ───
  const endCall = useCallback(() => {
    signalingChannel.current?.send({
      type: 'broadcast',
      event: 'end-call',
      payload: { from: user?.id },
    });
    cleanup();
  }, [user?.id, cleanup]);

  // ─── TOGGLE MUTE ───
  const toggleMute = useCallback(() => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
    }
  }, []);

  // ─── TOGGLE VIDEO ───
  const toggleVideo = useCallback(() => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
    }
  }, []);

  // ─── LISTEN FOR INCOMING CALLS ───
  useEffect(() => {
    if (!user?.id) return;

    const incomingChannel = supabase.channel(`incoming-calls-${user.id}`, {
      config: { broadcast: { self: false } },
    });

    incomingChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      console.log('[WebRTC] Incoming call from', payload.from, payload.callType);
      setCallState(prev => {
        if (prev.status !== 'idle') return prev; // Already in a call
        return {
          status: 'ringing',
          type: payload.callType,
          remoteUserId: payload.from,
          remoteUserName: payload.callerName,
          remoteUserAvatar: payload.callerAvatar,
          isIncoming: true,
          duration: 0,
        };
      });
    });

    incomingChannel.subscribe((status) => {
      console.log('[WebRTC] Incoming channel status:', status);
    });

    return () => {
      supabase.removeChannel(incomingChannel);
    };
  }, [user?.id]);

  return {
    callState,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
