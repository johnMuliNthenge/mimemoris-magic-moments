import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneIncoming,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { CallStatus, CallType } from '@/hooks/useWebRTC';

interface CallWindowProps {
  status: CallStatus;
  type: CallType;
  remoteUserName?: string;
  remoteUserAvatar?: string;
  isIncoming: boolean;
  duration: number;
  localStream: React.RefObject<MediaStream | null>;
  remoteStream: React.RefObject<MediaStream | null>;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallWindow({
  status,
  type,
  remoteUserName,
  remoteUserAvatar,
  isIncoming,
  duration,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
}: CallWindowProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (localVideoRef.current && localStream.current && localVideoRef.current.srcObject !== localStream.current) {
        localVideoRef.current.srcObject = localStream.current;
      }

      if (remoteVideoRef.current && remoteStream.current && remoteVideoRef.current.srcObject !== remoteStream.current) {
        remoteVideoRef.current.srcObject = remoteStream.current;
      }

      if (
        remoteAudioRef.current &&
        type === 'audio' &&
        status === 'connected' &&
        remoteStream.current &&
        remoteAudioRef.current.srcObject !== remoteStream.current
      ) {
        remoteAudioRef.current.srcObject = remoteStream.current;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [localStream, remoteStream, status, type]);

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    onToggleMute();
  };

  const handleToggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    onToggleVideo();
  };

  if (status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          className={cn(
            'relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl',
            type === 'video' ? 'bg-black aspect-video' : 'bg-card p-8'
          )}
        >
          {type === 'audio' && status === 'connected' && (
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          )}

          {/* Video call - show video streams */}
          {type === 'video' && status === 'connected' && (
            <>
              {/* Remote video (full) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local video (pip) */}
              <motion.div
                drag
                dragConstraints={{ left: -200, right: 200, top: -150, bottom: 150 }}
                className="absolute top-4 right-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg cursor-grab active:cursor-grabbing"
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </motion.div>
            </>
          )}

          {/* Audio call or waiting states */}
          {(type === 'audio' || status !== 'connected') && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              {/* Pulsing avatar */}
              <div className="relative">
                {(status === 'calling' || status === 'ringing') && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-primary/30"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                      className="absolute inset-0 rounded-full bg-primary/20"
                    />
                  </>
                )}
                <Avatar className="w-24 h-24 border-4 border-primary/30">
                  <AvatarImage src={remoteUserAvatar} />
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {remoteUserName?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground">
                  {remoteUserName || 'Unknown User'}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {status === 'calling' && 'Calling...'}
                  {status === 'ringing' && isIncoming && 'Incoming call...'}
                  {status === 'ringing' && !isIncoming && 'Ringing...'}
                  {status === 'connected' && formatDuration(duration)}
                  {status === 'ended' && 'Call ended'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5 capitalize">
                  {type} call
                </p>
              </div>
            </div>
          )}

          {/* Connected video call overlay info */}
          {type === 'video' && status === 'connected' && (
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <p className="text-white text-sm font-medium">{remoteUserName}</p>
              <p className="text-white/70 text-xs">{formatDuration(duration)}</p>
            </div>
          )}

          {/* Controls */}
          <div
            className={cn(
              'flex items-center justify-center gap-4 py-6',
              type === 'video' && status === 'connected' &&
                'absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-12'
            )}
          >
            {/* Incoming call - Accept/Reject */}
            {status === 'ringing' && isIncoming && (
              <>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-14 h-14"
                    onClick={onReject}
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="lg"
                    className="rounded-full w-14 h-14 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={onAccept}
                  >
                    <PhoneIncoming className="w-6 h-6" />
                  </Button>
                </motion.div>
              </>
            )}

            {/* Active call or outgoing call controls */}
            {(status === 'connected' || status === 'calling') && (
              <>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="lg"
                    variant={isMuted ? 'destructive' : 'secondary'}
                    className="rounded-full w-12 h-12"
                    onClick={handleToggleMute}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                </motion.div>

                {type === 'video' && (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button
                      size="lg"
                      variant={isVideoOff ? 'destructive' : 'secondary'}
                      className="rounded-full w-12 h-12"
                      onClick={handleToggleVideo}
                    >
                      {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </Button>
                  </motion.div>
                )}

                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-14 h-14"
                    onClick={onEnd}
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </motion.div>
              </>
            )}

            {/* Ringing outgoing - cancel */}
            {status === 'ringing' && !isIncoming && (
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-14 h-14"
                  onClick={onEnd}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
