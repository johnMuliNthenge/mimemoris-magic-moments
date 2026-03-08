import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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
  const remoteDisplayStreamRef = useRef<MediaStream>(new MediaStream());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = useCallback(() => {
    try {
      const streams: MediaStream[] = [];
      if (localStream.current) streams.push(localStream.current);
      if (remoteStream.current) streams.push(remoteStream.current);
      if (streams.length === 0) return;

      // Combine local + remote audio/video into one stream
      const combined = new MediaStream();
      streams.forEach(s => s.getTracks().forEach(t => combined.addTrack(t)));

      const recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `call-recording-${new Date().toISOString().slice(0, 19)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Recording saved', description: 'Your call recording has been downloaded.' });
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast({ title: 'Recording started' });
    } catch (err) {
      console.error('[CallWindow] Recording failed:', err);
      toast({ variant: 'destructive', title: 'Recording failed', description: 'Could not start recording.' });
    }
  }, [localStream, remoteStream, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, []);

  // Stop recording when call ends
  useEffect(() => {
    if (status === 'ended' || status === 'idle') {
      stopRecording();
    }
  }, [status, stopRecording]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Attach local stream to local video (PIP)
      if (localVideoRef.current && localStream.current) {
        if (localVideoRef.current.srcObject !== localStream.current) {
          localVideoRef.current.srcObject = localStream.current;
        }
      }

      // Attach remote stream to remote video (main view)
      if (remoteVideoRef.current) {
        const remote = remoteStream.current;
        const localTracks = localStream.current?.getTracks() ?? [];
        const remoteDisplayStream = remoteDisplayStreamRef.current;

        const remoteOnlyTracks = (remote?.getTracks() ?? []).filter(
          (track) => track.readyState === 'live' && !localTracks.some((localTrack) => localTrack === track)
        );

        remoteDisplayStream.getTracks().forEach((track) => {
          if (!remoteOnlyTracks.some((incoming) => incoming.id === track.id)) {
            remoteDisplayStream.removeTrack(track);
          }
        });

        remoteOnlyTracks.forEach((track) => {
          const exists = remoteDisplayStream.getTracks().some((existing) => existing.id === track.id);
          if (!exists) remoteDisplayStream.addTrack(track);
        });

        const hasVideoTrack = remoteOnlyTracks.some((track) => track.kind === 'video');
        const hasAnyTrack = remoteOnlyTracks.length > 0;

        // For video calls, only render main video when an actual non-local remote video track exists
        const canAttachToMainVideo = type === 'video' ? hasVideoTrack : hasAnyTrack;

        if (canAttachToMainVideo) {
          if (remoteVideoRef.current.srcObject !== remoteDisplayStream) {
            console.log('[CallWindow] Attaching remote stream, tracks:', remoteDisplayStream.getTracks().length);
            remoteVideoRef.current.srcObject = remoteDisplayStream;
          }

          if (remoteVideoRef.current.paused) {
            remoteVideoRef.current.play().catch(() => {});
          }
        } else if (remoteVideoRef.current.srcObject) {
          // Prevent stale previous stream from staying on screen
          remoteVideoRef.current.srcObject = null;
        }
      }

      // Audio-only: attach filtered remote stream to audio element
      if (
        remoteAudioRef.current &&
        type === 'audio' &&
        status === 'connected' &&
        remoteDisplayStreamRef.current.getTracks().length > 0 &&
        remoteAudioRef.current.srcObject !== remoteDisplayStreamRef.current
      ) {
        remoteAudioRef.current.srcObject = remoteDisplayStreamRef.current;
      }
    }, 200);

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

          {type === 'video' && status === 'connected' && (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

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

          {(type === 'audio' || status !== 'connected') && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
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
                <h3 className="text-xl font-semibold text-foreground">{remoteUserName || 'Unknown User'}</h3>
                <p className="text-muted-foreground mt-1">
                  {status === 'calling' && 'Calling...'}
                  {status === 'ringing' && isIncoming && 'Incoming call...'}
                  {status === 'ringing' && !isIncoming && 'Ringing...'}
                  {status === 'connected' && formatDuration(duration)}
                  {status === 'ended' && 'Call ended'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5 capitalize">{type} call</p>
              </div>
            </div>
          )}

          {type === 'video' && status === 'connected' && (
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <p className="text-white text-sm font-medium">{remoteUserName}</p>
              <p className="text-white/70 text-xs">{formatDuration(duration)}</p>
            </div>
          )}

          <div
            className={cn(
              'flex items-center justify-center gap-3 py-6 flex-wrap',
              type === 'video' && status === 'connected' &&
                'absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-12'
            )}
          >
            {status === 'ringing' && isIncoming && (
              <>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  <Button
                    size="lg"
                    className="rounded-full h-12 px-5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onReject}
                  >
                    <PhoneOff className="w-5 h-5 mr-2" />
                    Decline
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  <Button
                    size="lg"
                    className="rounded-full h-12 px-5 bg-success text-success-foreground hover:bg-success/90"
                    onClick={onAccept}
                  >
                    <PhoneIncoming className="w-5 h-5 mr-2" />
                    Accept
                  </Button>
                </motion.div>
              </>
            )}

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

                {status === 'connected' && (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button
                      size="lg"
                      variant={isRecording ? 'destructive' : 'secondary'}
                      className="rounded-full w-12 h-12 relative"
                      onClick={isRecording ? stopRecording : startRecording}
                      title={isRecording ? 'Stop recording' : 'Record call'}
                    >
                      <Circle className={cn("w-5 h-5", isRecording && "fill-current")} />
                      {isRecording && (
                        <motion.div
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive border-2 border-background"
                        />
                      )}
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
