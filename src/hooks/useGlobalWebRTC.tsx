import { createContext, useContext, ReactNode } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { CallWindow } from '@/components/social/CallWindow';
import type { CallStatus, CallType } from '@/hooks/useWebRTC';

interface WebRTCContextType {
  callState: {
    status: CallStatus;
    type: CallType;
    remoteUserId: string | null;
    remoteUserName?: string;
    remoteUserAvatar?: string;
    isIncoming: boolean;
    duration: number;
  };
  localStream: React.RefObject<MediaStream | null>;
  remoteStream: React.RefObject<MediaStream | null>;
  initiateCall: (remoteUserId: string, callType: CallType, remoteUserName?: string, remoteUserAvatar?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

export function useGlobalWebRTC() {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error('useGlobalWebRTC must be used within WebRTCProvider');
  return ctx;
}

export function WebRTCProvider({ children }: { children: ReactNode }) {
  const webrtc = useWebRTC();

  return (
    <WebRTCContext.Provider value={webrtc}>
      {children}
      {/* Global call window overlay - visible on ANY page */}
      <CallWindow
        status={webrtc.callState.status}
        type={webrtc.callState.type}
        remoteUserName={webrtc.callState.remoteUserName}
        remoteUserAvatar={webrtc.callState.remoteUserAvatar}
        isIncoming={webrtc.callState.isIncoming}
        duration={webrtc.callState.duration}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        onAccept={webrtc.acceptCall}
        onReject={webrtc.rejectCall}
        onEnd={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
      />
    </WebRTCContext.Provider>
  );
}
