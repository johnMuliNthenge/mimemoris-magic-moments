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

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const CHANNEL_SUBSCRIBE_TIMEOUT_MS = 10000;
const DISCONNECT_GRACE_MS = 12000;

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
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const disconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCallState = useCallback(() => {
    setCallState({
      status: 'idle',
      type: 'audio',
      remoteUserId: null,
      isIncoming: false,
      duration: 0,
    });
  }, []);

  const cleanup = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    if (disconnectTimeout.current) {
      clearTimeout(disconnectTimeout.current);
      disconnectTimeout.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
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
    resetCallState();
  }, [resetCallState]);

  const startDurationTimer = useCallback(() => {
    if (durationInterval.current) clearInterval(durationInterval.current);

    durationInterval.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  const getMedia = useCallback(async (callType: CallType) => {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.current = stream;
    return stream;
  }, []);

  const waitForChannelSubscription = useCallback(
    (channel: ReturnType<typeof supabase.channel>, label: string) =>
      new Promise<void>((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error(`${label} subscribe timeout`));
        }, CHANNEL_SUBSCRIBE_TIMEOUT_MS);

        channel.subscribe((status) => {
          console.log(`[WebRTC] ${label} status:`, status);

          if (settled) return;

          if (status === 'SUBSCRIBED') {
            settled = true;
            clearTimeout(timeout);
            resolve();
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            settled = true;
            clearTimeout(timeout);
            reject(new Error(`${label} failed: ${status}`));
          }
        });
      }),
    []
  );

  const createPeerConnection = useCallback(
    (onConnected: () => void) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      remoteStream.current = new MediaStream();

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remoteStream.current?.addTrack(track);
        });
      };

      pc.onicecandidate = async (event) => {
        if (!event.candidate || !signalingChannel.current || !user?.id) return;

        try {
          await signalingChannel.current.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: event.candidate.toJSON(), from: user.id },
          });
        } catch (error) {
          console.error('[WebRTC] Failed to send ICE candidate:', error);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);

        if (pc.connectionState === 'connected') {
          if (disconnectTimeout.current) {
            clearTimeout(disconnectTimeout.current);
            disconnectTimeout.current = null;
          }
          onConnected();
          return;
        }

        if (pc.connectionState === 'disconnected') {
          if (disconnectTimeout.current) clearTimeout(disconnectTimeout.current);
          disconnectTimeout.current = setTimeout(() => {
            if (!peerConnection.current || peerConnection.current !== pc) return;
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              cleanup();
            }
          }, DISCONNECT_GRACE_MS);
          return;
        }

        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanup();
        }
      };

      pc.oniceconnectionstatechange = async () => {
        console.log('[WebRTC] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          try {
            await pc.restartIce();
          } catch (error) {
            console.error('[WebRTC] ICE restart failed:', error);
          }
        }
      };

      peerConnection.current = pc;
      return pc;
    },
    [cleanup, user?.id]
  );

  const getChannelName = useCallback(
    (remoteUserId: string) => `call-${[user?.id, remoteUserId].sort().join('-')}`,
    [user?.id]
  );

  const initiateCall = useCallback(
    async (remoteUserId: string, callType: CallType, remoteUserName?: string, remoteUserAvatar?: string) => {
      if (!user?.id) return;
      console.log('[WebRTC] Initiating call to', remoteUserId, callType);

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

        const channelName = getChannelName(remoteUserId);
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });

        channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (!peerConnection.current || !payload?.answer) return;
          console.log('[WebRTC] Received answer');

          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));

            for (const candidate of pendingCandidates.current) {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidates.current = [];
          } catch (error) {
            console.error('[WebRTC] Error setting answer:', error);
          }
        });

        channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (!payload?.candidate || payload.from === user.id || !peerConnection.current) return;

          try {
            if (peerConnection.current.remoteDescription) {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              pendingCandidates.current.push(payload.candidate);
            }
          } catch (error) {
            console.error('[WebRTC] Error handling ICE candidate:', error);
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

        channel.on('broadcast', { event: 'ready-for-offer' }, async () => {
          const pc = peerConnection.current;
          if (!pc || !user.id) return;

          try {
            if (!pc.localDescription) {
              const localOffer = await pc.createOffer();
              await pc.setLocalDescription(localOffer);
            }

            await channel.send({
              type: 'broadcast',
              event: 'offer',
              payload: {
                offer: pc.localDescription,
                from: user.id,
                callType,
              },
            });
            console.log('[WebRTC] Callee ready, offer sent');
          } catch (error) {
            console.error('[WebRTC] Failed to send offer:', error);
          }
        });

        await waitForChannelSubscription(channel, 'Caller signaling channel');
        signalingChannel.current = channel;

        const stream = await getMedia(callType);
        const pc = createPeerConnection(() => {
          setCallState((prev) => ({ ...prev, status: 'connected' }));
          startDurationTimer();
        });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const notifyChannel = supabase.channel(`incoming-calls-${remoteUserId}`, {
          config: { broadcast: { self: false } },
        });

        try {
          await waitForChannelSubscription(notifyChannel, 'Incoming notification channel');
          await notifyChannel.send({
            type: 'broadcast',
            event: 'incoming-call',
            payload: {
              from: user.id,
              callType,
              callerName: user.user_metadata?.full_name || 'Unknown',
              callerAvatar: undefined,
            },
          });
          console.log('[WebRTC] Incoming-call notification sent');
        } finally {
          setTimeout(() => supabase.removeChannel(notifyChannel), 750);
        }
      } catch (error) {
        console.error('[WebRTC] Failed to initiate call:', error);
        cleanup();
      }
    },
    [user, getChannelName, waitForChannelSubscription, getMedia, createPeerConnection, startDurationTimer, cleanup]
  );

  const acceptCall = useCallback(async () => {
    if (!callState.remoteUserId || !user?.id) return;

    const remoteUserId = callState.remoteUserId;
    const callType = callState.type;
    console.log('[WebRTC] Accepting call from', remoteUserId);

    try {
      const stream = await getMedia(callType);
      const pc = createPeerConnection(() => {
        setCallState((prev) => ({ ...prev, status: 'connected', isIncoming: false }));
        startDurationTimer();
      });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const channelName = getChannelName(remoteUserId);
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!peerConnection.current || !payload?.offer) return;
        console.log('[WebRTC] Received offer SDP');

        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.offer));

          for (const candidate of pendingCandidates.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current = [];

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);

          await channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer: peerConnection.current.localDescription, from: user.id },
          });
          console.log('[WebRTC] Answer sent');
        } catch (error) {
          console.error('[WebRTC] Error handling offer:', error);
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!payload?.candidate || payload.from === user.id || !peerConnection.current) return;

        try {
          if (peerConnection.current.remoteDescription) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } else {
            pendingCandidates.current.push(payload.candidate);
          }
        } catch (error) {
          console.error('[WebRTC] Error handling ICE candidate:', error);
        }
      });

      channel.on('broadcast', { event: 'end-call' }, () => {
        console.log('[WebRTC] Remote ended call');
        cleanup();
      });

      channel.on('broadcast', { event: 'reject-call' }, () => {
        console.log('[WebRTC] Call rejected by caller');
        cleanup();
      });

      await waitForChannelSubscription(channel, 'Callee signaling channel');
      signalingChannel.current = channel;

      await channel.send({
        type: 'broadcast',
        event: 'ready-for-offer',
        payload: { from: user.id },
      });

      setCallState((prev) => ({ ...prev, status: 'calling', isIncoming: false }));
      console.log('[WebRTC] Ready-for-offer sent');
    } catch (error) {
      console.error('[WebRTC] Failed to accept call:', error);
      cleanup();
    }
  }, [callState.remoteUserId, callState.type, user?.id, getMedia, createPeerConnection, getChannelName, waitForChannelSubscription, startDurationTimer, cleanup]);

  const rejectCall = useCallback(() => {
    if (!callState.remoteUserId || !user?.id) return;

    const targetUserId = callState.remoteUserId;
    const reject = async () => {
      const channelName = getChannelName(targetUserId);
      const rejectChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      try {
        await waitForChannelSubscription(rejectChannel, 'Reject channel');
        await rejectChannel.send({
          type: 'broadcast',
          event: 'reject-call',
          payload: { from: user.id },
        });
      } catch (error) {
        console.error('[WebRTC] Failed to send reject:', error);
      } finally {
        setTimeout(() => supabase.removeChannel(rejectChannel), 500);
      }
    };

    void reject();
    cleanup();
  }, [callState.remoteUserId, user?.id, getChannelName, waitForChannelSubscription, cleanup]);

  const endCall = useCallback(() => {
    const channel = signalingChannel.current;

    if (channel && user?.id) {
      void channel.send({
        type: 'broadcast',
        event: 'end-call',
        payload: { from: user.id },
      });
    }

    cleanup();
  }, [user?.id, cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;

    const audioTrack = localStream.current.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStream.current) return;

    const videoTrack = localStream.current.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const incomingChannel = supabase.channel(`incoming-calls-${user.id}`, {
      config: { broadcast: { self: false } },
    });

    incomingChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      console.log('[WebRTC] Incoming call from', payload.from, payload.callType);

      setCallState((prev) => {
        if (prev.status !== 'idle') return prev;

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

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

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
