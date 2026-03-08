import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

type CallHistoryStatus = 'ringing' | 'connected' | 'completed' | 'missed' | 'rejected' | 'failed' | 'canceled';
type CallDirection = 'incoming' | 'outgoing';

interface CallState {
  status: CallStatus;
  type: CallType;
  remoteUserId: string | null;
  remoteUserName?: string;
  remoteUserAvatar?: string;
  isIncoming: boolean;
  duration: number;
}

interface ActiveCallLog {
  id: string | null;
  peerUserId: string;
  direction: CallDirection;
  callType: CallType;
  connectedAt: number | null;
  finalized: boolean;
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

const CHANNEL_SUBSCRIBE_TIMEOUT_MS = 10000;
// No disconnect grace timeout — calls stay alive indefinitely until manually ended

export function useWebRTC() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    type: 'audio',
    remoteUserId: null,
    isIncoming: false,
    duration: 0,
  });

  const callStateRef = useRef(callState);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const disconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCallLog = useRef<ActiveCallLog | null>(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const resetCallState = useCallback(() => {
    setCallState({
      status: 'idle',
      type: 'audio',
      remoteUserId: null,
      isIncoming: false,
      duration: 0,
    });
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

  const sendSignal = useCallback(
    async (
      channel: ReturnType<typeof supabase.channel> | null,
      event: string,
      payload: Record<string, unknown>
    ) => {
      if (!channel) return;

      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload ?? {}).filter(([, value]) => value !== undefined)
      );

      const result = await channel.send({
        type: 'broadcast',
        event,
        payload: sanitizedPayload,
      });

      if (result !== 'ok') {
        throw new Error(`Signal send failed for ${event}: ${result}`);
      }
    },
    []
  );

  const updateHistoryById = useCallback(
    async (historyId: string, updates: Record<string, unknown>) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('call_history' as any)
        .update(updates)
        .eq('id', historyId)
        .eq('user_id', user.id);

      if (error) {
        console.error('[WebRTC] Failed updating call history:', error);
      }
    },
    [user?.id]
  );

  const beginCallHistory = useCallback(
    async (peerUserId: string, direction: CallDirection, callType: CallType) => {
      if (!user?.id) return;

      const localLog: ActiveCallLog = {
        id: null,
        peerUserId,
        direction,
        callType,
        connectedAt: null,
        finalized: false,
      };

      activeCallLog.current = localLog;

      const { data, error } = (await supabase
        .from('call_history' as any)
        .insert({
          user_id: user.id,
          peer_user_id: peerUserId,
          direction,
          call_type: callType,
          status: 'ringing',
          started_at: new Date().toISOString(),
          duration_seconds: 0,
        })
        .select('id')
        .single()) as { data: { id: string } | null; error: any };

      if (error) {
        console.error('[WebRTC] Failed creating call history:', error);
        return;
      }

      if (activeCallLog.current === localLog) {
        activeCallLog.current = { ...localLog, id: data?.id ?? null };
      }
    },
    [user?.id]
  );

  const markCallConnected = useCallback(() => {
    const currentLog = activeCallLog.current;
    if (!currentLog || currentLog.finalized || currentLog.connectedAt) return;

    currentLog.connectedAt = Date.now();

    if (currentLog.id) {
      void updateHistoryById(currentLog.id, { status: 'connected' });
    }
  }, [updateHistoryById]);

  const finalizeCallHistory = useCallback(
    (status: CallHistoryStatus) => {
      const currentLog = activeCallLog.current;
      if (!currentLog || currentLog.finalized) return;

      currentLog.finalized = true;

      if (!currentLog.id) return;

      const durationSeconds = currentLog.connectedAt
        ? Math.max(0, Math.round((Date.now() - currentLog.connectedAt) / 1000))
        : 0;

      void updateHistoryById(currentLog.id, {
        status,
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      });
    },
    [updateHistoryById]
  );

  const cleanupResources = useCallback(() => {
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

    pendingCandidates.current = [];
    remoteStream.current = null;
    activeCallLog.current = null;
    resetCallState();
  }, [resetCallState]);

  const cleanup = useCallback(
    (finalStatus?: CallHistoryStatus) => {
      if (finalStatus) {
        finalizeCallHistory(finalStatus);
      }
      cleanupResources();
    },
    [cleanupResources, finalizeCallHistory]
  );

  const startDurationTimer = useCallback(() => {
    if (durationInterval.current) clearInterval(durationInterval.current);

    durationInterval.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  const getMedia = useCallback(async (callType: CallType) => {
    const buildConstraints = (mode: CallType): MediaStreamConstraints => ({
      audio: true,
      video:
        mode === 'video'
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : false,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(callType));
      localStream.current = stream;
      return { stream, resolvedType: callType };
    } catch (error) {
      if (callType === 'video') {
        try {
          console.warn('[WebRTC] Video media unavailable, falling back to audio:', error);
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia(buildConstraints('audio'));
          localStream.current = audioOnlyStream;
          return { stream: audioOnlyStream, resolvedType: 'audio' as CallType };
        } catch (audioFallbackError) {
          console.error('[WebRTC] Audio fallback failed:', audioFallbackError);
          throw audioFallbackError;
        }
      }

      throw error;
    }
  }, []);

  const getChannelName = useCallback(
    (remoteUserId: string) => `call-${[user?.id, remoteUserId].sort().join('-')}`,
    [user?.id]
  );

  const getRemoteEndedStatus = useCallback((): CallHistoryStatus => {
    const current = callStateRef.current;
    if (current.status === 'connected') return 'completed';
    if (current.isIncoming && current.status === 'ringing') return 'missed';
    return 'canceled';
  }, []);

  const createPeerConnection = useCallback(
    (onConnected: () => void) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const inboundRemoteStream = new MediaStream();
      remoteStream.current = inboundRemoteStream;

      const attachRemoteTrack = (track: MediaStreamTrack) => {
        if (track.readyState !== 'live') return;

        const exists = inboundRemoteStream.getTracks().some((existing) => existing.id === track.id);
        if (!exists) {
          inboundRemoteStream.addTrack(track);
          remoteStream.current = inboundRemoteStream;
        }
      };

      const detachRemoteTrack = (track: MediaStreamTrack) => {
        const existing = inboundRemoteStream.getTracks().find((candidate) => candidate.id === track.id);
        if (existing) {
          inboundRemoteStream.removeTrack(existing);
          remoteStream.current = inboundRemoteStream;
        }
      };

      pc.ontrack = (event) => {
        event.streams.forEach((stream) => {
          stream.getTracks().forEach(attachRemoteTrack);
        });

        if (event.track) {
          attachRemoteTrack(event.track);

          event.track.onunmute = () => {
            attachRemoteTrack(event.track);
          };

          event.track.onended = () => {
            detachRemoteTrack(event.track);
          };
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !signalingChannel.current || !user?.id) return;

        void sendSignal(signalingChannel.current, 'ice-candidate', {
          candidate: event.candidate.toJSON(),
          from: user.id,
        });
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

        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          // Just attempt ICE restart, never auto-disconnect — user must end call manually
          if (pc.connectionState === 'failed') {
            try {
              pc.restartIce();
            } catch (error) {
              console.error('[WebRTC] ICE restart on failed state error:', error);
            }
          }
          return;
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
    [sendSignal, user?.id]
  );

  const sendIncomingNotification = useCallback(
    async (remoteUserId: string, event: string, payload: Record<string, unknown>) => {
      const notifyChannel = supabase.channel(`incoming-calls-${remoteUserId}`, {
        config: { broadcast: { self: false } },
      });

      try {
        await waitForChannelSubscription(notifyChannel, 'Incoming notification channel');
        await sendSignal(notifyChannel, event, payload);

        // Retry once to reduce missed incoming-call notifications on slower connections
        setTimeout(() => {
          void sendSignal(notifyChannel, event, payload).catch((error) => {
            console.warn('[WebRTC] Incoming notification retry failed:', error);
          });
        }, 600);
      } finally {
        setTimeout(() => supabase.removeChannel(notifyChannel), 3000);
      }
    },
    [sendSignal, waitForChannelSubscription]
  );

  const initiateCall = useCallback(
    async (remoteUserId: string, callType: CallType, remoteUserName?: string, remoteUserAvatar?: string) => {
      if (!user?.id) return;
      console.log('[WebRTC] Initiating call to', remoteUserId, callType);

      if (callStateRef.current.status !== 'idle') {
        cleanup('failed');
      }

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

        pendingCandidates.current = [];
        await beginCallHistory(remoteUserId, 'outgoing', callType);

        const channelName = getChannelName(remoteUserId);
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });

        channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (!peerConnection.current || !payload?.answer || payload?.from !== remoteUserId) return;

          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));

            for (const candidate of pendingCandidates.current) {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidates.current = [];

            setCallState((prev) => ({ ...prev, status: 'connected', isIncoming: false }));
            markCallConnected();
            startDurationTimer();
          } catch (error) {
            console.error('[WebRTC] Error setting answer:', error);
          }
        });

        channel.on('broadcast', { event: 'ready-for-offer' }, async ({ payload }) => {
          const pc = peerConnection.current;
          if (!pc || !user.id || payload?.from !== remoteUserId) return;

          try {
            if (!pc.localDescription) {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
            }

            await sendSignal(channel, 'offer', {
              offer: pc.localDescription,
              from: user.id,
              callType,
            });
            console.log('[WebRTC] Offer sent');
          } catch (error) {
            console.error('[WebRTC] Failed to send offer:', error);
          }
        });

        channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (!payload?.candidate || payload.from !== remoteUserId || !peerConnection.current) return;

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

        channel.on('broadcast', { event: 'end-call' }, ({ payload }) => {
          if (payload?.from !== remoteUserId) return;
          cleanup(getRemoteEndedStatus());
        });

        channel.on('broadcast', { event: 'reject-call' }, ({ payload }) => {
          if (payload?.from !== remoteUserId) return;
          cleanup('rejected');
        });

        await waitForChannelSubscription(channel, 'Caller signaling channel');
        signalingChannel.current = channel;

        const { stream, resolvedType } = await getMedia(callType);
        if (resolvedType !== callType) {
          setCallState((prev) => ({ ...prev, type: resolvedType }));
        }

        const pc = createPeerConnection(() => {
          setCallState((prev) => ({ ...prev, status: 'connected', isIncoming: false }));
          markCallConnected();
          startDurationTimer();
        });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendIncomingNotification(remoteUserId, 'incoming-call', {
          from: user.id,
          callType: resolvedType,
          callerName: user.user_metadata?.full_name || 'Unknown',
          callerAvatar: user.user_metadata?.avatar_url || undefined,
        });
      } catch (error) {
        console.error('[WebRTC] Failed to initiate call:', error);
        cleanup('failed');
      }
    },
    [
      user,
      cleanup,
      beginCallHistory,
      getChannelName,
      sendSignal,
      waitForChannelSubscription,
      getMedia,
      createPeerConnection,
      markCallConnected,
      startDurationTimer,
      sendIncomingNotification,
      getRemoteEndedStatus,
    ]
  );

  const acceptCall = useCallback(async () => {
    if (!callStateRef.current.remoteUserId || !user?.id) return;

    const remoteUserId = callStateRef.current.remoteUserId;
    const initialCallType = callStateRef.current.type;

    try {
      if (
        !activeCallLog.current ||
        activeCallLog.current.direction !== 'incoming' ||
        activeCallLog.current.peerUserId !== remoteUserId
      ) {
        await beginCallHistory(remoteUserId, 'incoming', initialCallType);
      }

      pendingCandidates.current = [];

      const shouldAcquireLocalMedia =
        !localStream.current ||
        !localStream.current.getTracks().some((track) => track.readyState === 'live');

      if (shouldAcquireLocalMedia) {
        const { resolvedType } = await getMedia(initialCallType);
        if (resolvedType !== initialCallType) {
          setCallState((prev) => ({ ...prev, type: resolvedType }));
        }
      }

      const pc = createPeerConnection(() => {
        setCallState((prev) => ({ ...prev, status: 'connected', isIncoming: false }));
        markCallConnected();
        startDurationTimer();
      });

      const activeStream = localStream.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => {
          const alreadySending = pc.getSenders().some((sender) => sender.track?.id === track.id);
          if (!alreadySending) {
            pc.addTrack(track, activeStream);
          }
        });
      }

      const channelName = getChannelName(remoteUserId);
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!peerConnection.current || !payload?.offer || payload?.from !== remoteUserId) return;

        try {
          if (peerConnection.current.signalingState === 'have-remote-offer') {
            return;
          }

          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.offer));

          for (const candidate of pendingCandidates.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current = [];

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);

          await sendSignal(channel, 'answer', {
            answer: peerConnection.current.localDescription,
            from: user.id,
          });

          setCallState((prev) => ({ ...prev, status: 'connected', isIncoming: false }));
          markCallConnected();
          startDurationTimer();
          console.log('[WebRTC] Answer sent');
        } catch (error) {
          console.error('[WebRTC] Error handling offer:', error);
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!payload?.candidate || payload.from !== remoteUserId || !peerConnection.current) return;

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

      channel.on('broadcast', { event: 'end-call' }, ({ payload }) => {
        if (payload?.from !== remoteUserId) return;
        cleanup(getRemoteEndedStatus());
      });

      channel.on('broadcast', { event: 'reject-call' }, ({ payload }) => {
        if (payload?.from !== remoteUserId) return;
        cleanup('rejected');
      });

      await waitForChannelSubscription(channel, 'Callee signaling channel');
      signalingChannel.current = channel;

      await sendSignal(channel, 'ready-for-offer', { from: user.id });
      setCallState((prev) => ({ ...prev, status: 'calling', isIncoming: false }));
    } catch (error) {
      console.error('[WebRTC] Failed to accept call:', error);
      cleanup('failed');
    }
  }, [
    user?.id,
    beginCallHistory,
    getMedia,
    createPeerConnection,
    markCallConnected,
    startDurationTimer,
    getChannelName,
    sendSignal,
    waitForChannelSubscription,
    cleanup,
    getRemoteEndedStatus,
  ]);

  const rejectCall = useCallback(() => {
    if (!callStateRef.current.remoteUserId || !user?.id) return;

    const targetUserId = callStateRef.current.remoteUserId;

    const reject = async () => {
      const channelName = getChannelName(targetUserId);
      const rejectChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      try {
        await waitForChannelSubscription(rejectChannel, 'Reject channel');
        await sendSignal(rejectChannel, 'reject-call', { from: user.id });
      } catch (error) {
        console.error('[WebRTC] Failed to send reject:', error);
      } finally {
        setTimeout(() => supabase.removeChannel(rejectChannel), 2000);
      }
    };

    void reject();
    cleanup('rejected');
  }, [user?.id, getChannelName, waitForChannelSubscription, sendSignal, cleanup]);

  const endCall = useCallback(() => {
    const channel = signalingChannel.current;
    const current = callStateRef.current;
    const remoteUserId = current.remoteUserId;

    if (channel && user?.id) {
      void sendSignal(channel, 'end-call', { from: user.id });
    }

    if (current.status !== 'connected' && remoteUserId && user?.id) {
      void sendIncomingNotification(remoteUserId, 'cancel-call', { from: user.id });
    }

    cleanup(current.status === 'connected' ? 'completed' : 'canceled');
  }, [cleanup, sendSignal, sendIncomingNotification, user?.id]);

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

    let isMounted = true;
    let incomingChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connectIncomingChannel = () => {
      if (!isMounted || !user?.id) return;

      incomingChannel = supabase.channel(`incoming-calls-${user.id}`, {
        config: { broadcast: { self: false } },
      });

      incomingChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
        const callerId = payload?.from as string | undefined;
        const incomingType = payload?.callType as CallType | undefined;

        if (!callerId || callerId === user.id || (incomingType !== 'audio' && incomingType !== 'video')) return;

        setCallState((prev) => {
          if (prev.status !== 'idle') return prev;

          void beginCallHistory(callerId, 'incoming', incomingType);

          return {
            status: 'ringing',
            type: incomingType,
            remoteUserId: callerId,
            remoteUserName: payload.callerName,
            remoteUserAvatar: payload.callerAvatar,
            isIncoming: true,
            duration: 0,
          };
        });
      });

      incomingChannel.on('broadcast', { event: 'cancel-call' }, ({ payload }) => {
        const current = callStateRef.current;
        if (
          current.status === 'ringing' &&
          current.isIncoming &&
          current.remoteUserId &&
          payload?.from === current.remoteUserId
        ) {
          cleanup('missed');
        }
      });

      incomingChannel.subscribe((status) => {
        console.log('[WebRTC] Incoming channel status:', status);

        if (!isMounted || !incomingChannel) return;

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          supabase.removeChannel(incomingChannel);
          incomingChannel = null;

          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            connectIncomingChannel();
          }, 1500);
        }
      });
    };

    connectIncomingChannel();

    return () => {
      isMounted = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (incomingChannel) {
        supabase.removeChannel(incomingChannel);
        incomingChannel = null;
      }
    };
  }, [user?.id, beginCallHistory, cleanup]);

  useEffect(() => {
    return () => cleanupResources();
  }, [cleanupResources]);

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
