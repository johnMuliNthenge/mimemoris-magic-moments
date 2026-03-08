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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

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
    setCallState({ status: 'idle', type: 'audio', remoteUserId: null, isIncoming: false, duration: 0 });
  }, []);

  const setupPeerConnection = useCallback((callType: CallType) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    remoteStream.current = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.current?.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream.current;
      }
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

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [user?.id]);

  const getMedia = useCallback(async (callType: CallType) => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const setupSignaling = useCallback((remoteUserId: string) => {
    const channelName = [user?.id, remoteUserId].sort().join('-call-');
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.from === user?.id) return;
      // Incoming call
      setCallState(prev => ({
        ...prev,
        status: 'ringing',
        type: payload.callType,
        remoteUserId: payload.from,
        remoteUserName: payload.callerName,
        isIncoming: true,
      }));
    });

    channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (payload.from === user?.id || !peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
      // Flush pending candidates
      for (const c of pendingCandidates.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
      }
      pendingCandidates.current = [];
      setCallState(prev => ({ ...prev, status: 'connected' }));
      durationInterval.current = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    });

    channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
      if (payload.from === user?.id) return;
      if (peerConnection.current?.remoteDescription) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        pendingCandidates.current.push(payload.candidate);
      }
    });

    channel.on('broadcast', { event: 'end-call' }, () => {
      cleanup();
    });

    channel.on('broadcast', { event: 'reject-call' }, () => {
      cleanup();
    });

    channel.subscribe();
    signalingChannel.current = channel;
    return channel;
  }, [user?.id, cleanup]);

  // Start an outgoing call
  const startCall = useCallback(async (
    remoteUserId: string,
    callType: CallType,
    remoteUserName?: string,
    remoteUserAvatar?: string
  ) => {
    try {
      setCallState({
        status: 'calling',
        type: callType,
        remoteUserId,
        remoteUserName,
        remoteUserAvatar,
        isIncoming: false,
        duration: 0,
      });

      const channel = setupSignaling(remoteUserId);
      const stream = await getMedia(callType);
      const pc = setupPeerConnection(callType);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait a moment for channel to be ready
      setTimeout(() => {
        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            offer,
            from: user?.id,
            callType,
            callerName: user?.user_metadata?.full_name || 'Unknown',
          },
        });
      }, 500);
    } catch (err) {
      console.error('Failed to start call:', err);
      cleanup();
    }
  }, [user, setupSignaling, getMedia, setupPeerConnection, cleanup]);

  // Accept an incoming call
  const acceptCall = useCallback(async () => {
    if (!callState.remoteUserId) return;
    try {
      const stream = await getMedia(callState.type);
      const pc = setupPeerConnection(callState.type);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Wait for the actual SDP offer via a separate listener
      const channelName = [user?.id, callState.remoteUserId].sort().join('-call-');
      const channel = supabase.channel(channelName + '-accept', {
        config: { broadcast: { self: false } },
      });

      // Re-listen on existing channel for the SDP offer
      // The offer was already sent, so we request it again
      signalingChannel.current?.send({
        type: 'broadcast',
        event: 'accept-signal',
        payload: { from: user?.id },
      });

      // Since the offer was already sent before we subscribed for SDP,
      // we need the caller to resend. Add a listener on existing channel:
      signalingChannel.current?.on('broadcast', { event: 'offer-sdp' }, async ({ payload }) => {
        if (payload.from === user?.id || !peerConnection.current) return;
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
        for (const c of pendingCandidates.current) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidates.current = [];
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        signalingChannel.current?.send({
          type: 'broadcast',
          event: 'answer',
          payload: { answer, from: user?.id },
        });
        setCallState(prev => ({ ...prev, status: 'connected' }));
        durationInterval.current = setInterval(() => {
          setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);
      });

      supabase.removeChannel(channel);
    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanup();
    }
  }, [callState, user, getMedia, setupPeerConnection, cleanup]);

  // Reject an incoming call
  const rejectCall = useCallback(() => {
    signalingChannel.current?.send({
      type: 'broadcast',
      event: 'reject-call',
      payload: { from: user?.id },
    });
    cleanup();
  }, [user?.id, cleanup]);

  // End an active call
  const endCall = useCallback(() => {
    signalingChannel.current?.send({
      type: 'broadcast',
      event: 'end-call',
      payload: { from: user?.id },
    });
    cleanup();
  }, [user?.id, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
    }
  }, []);

  // Listen for incoming calls globally
  useEffect(() => {
    if (!user?.id) return;
    
    const incomingChannel = supabase.channel(`incoming-calls-${user.id}`, {
      config: { broadcast: { self: false } },
    });

    incomingChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      if (callState.status !== 'idle') return; // Already in a call
      setCallState({
        status: 'ringing',
        type: payload.callType,
        remoteUserId: payload.from,
        remoteUserName: payload.callerName,
        remoteUserAvatar: payload.callerAvatar,
        isIncoming: true,
        duration: 0,
      });
      setupSignaling(payload.from);
    });

    incomingChannel.subscribe();

    return () => {
      supabase.removeChannel(incomingChannel);
    };
  }, [user?.id, callState.status, setupSignaling]);

  // When starting a call, also notify on the receiver's incoming channel
  const initiateCall = useCallback(async (
    remoteUserId: string,
    callType: CallType,
    remoteUserName?: string,
    remoteUserAvatar?: string
  ) => {
    // Setup signaling first
    setupSignaling(remoteUserId);
    
    setCallState({
      status: 'calling',
      type: callType,
      remoteUserId,
      remoteUserName,
      remoteUserAvatar,
      isIncoming: false,
      duration: 0,
    });

    try {
      const stream = await getMedia(callType);
      const pc = setupPeerConnection(callType);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Notify the remote user
      const notifyChannel = supabase.channel(`incoming-calls-${remoteUserId}`);
      await notifyChannel.subscribe();
      
      setTimeout(async () => {
        await notifyChannel.send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: {
            from: user?.id,
            callType,
            callerName: user?.user_metadata?.full_name || 'Unknown',
            callerAvatar: undefined,
          },
        });
        
        // Also send the SDP offer on the signaling channel
        setTimeout(() => {
          signalingChannel.current?.send({
            type: 'broadcast',
            event: 'offer-sdp',
            payload: { offer, from: user?.id, callType },
          });
        }, 300);
        
        supabase.removeChannel(notifyChannel);
      }, 500);

      // Listen for accept-signal to resend offer
      signalingChannel.current?.on('broadcast', { event: 'accept-signal' }, () => {
        signalingChannel.current?.send({
          type: 'broadcast',
          event: 'offer-sdp',
          payload: { offer: peerConnection.current?.localDescription, from: user?.id, callType },
        });
      });
    } catch (err) {
      console.error('Failed to initiate call:', err);
      cleanup();
    }
  }, [user, setupSignaling, getMedia, setupPeerConnection, cleanup]);

  return {
    callState,
    localVideoRef,
    remoteVideoRef,
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
