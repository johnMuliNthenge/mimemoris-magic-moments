import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, UserMinus, X, Users, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useGroupCall } from '@/hooks/useGroupCall';
import { useAuth } from '@/hooks/useAuth';

interface GroupCallWindowProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
  callHook: ReturnType<typeof useGroupCall>;
}

function VideoTile({ stream, label, avatarUrl, isMuted, isLocal, connectionState }: {
  stream: MediaStream | null;
  label: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isLocal?: boolean;
  connectionState?: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = !!stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  useEffect(() => {
    if (!videoRef.current || !stream) return;

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => {
      // Browser may block autoplay until user interaction
    });
  }, [stream, hasVideo]);

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden aspect-video flex items-center justify-center min-h-[120px]">
      {stream && hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <Avatar className="w-16 h-16">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="text-2xl bg-primary/20 text-primary">
            {label[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <Badge variant="secondary" className="text-xs bg-background/80 backdrop-blur-sm">
          {label}{isLocal ? ' (You)' : ''}
        </Badge>
        {isMuted && <MicOff className="w-3 h-3 text-destructive" />}
      </div>
      {/* Connection status indicator */}
      {!isLocal && connectionState && connectionState !== 'connected' && (
        <div className="absolute top-2 right-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] gap-1 bg-background/80 backdrop-blur-sm",
              connectionState === 'connecting' && "text-amber-500 border-amber-500/50",
              connectionState === 'reconnecting' && "text-orange-500 border-orange-500/50 animate-pulse",
              connectionState === 'disconnected' && "text-destructive border-destructive/50"
            )}
          >
            {connectionState === 'connecting' && <><Wifi className="w-3 h-3" /> Connecting</>}
            {connectionState === 'reconnecting' && <><Wifi className="w-3 h-3" /> Reconnecting</>}
            {connectionState === 'disconnected' && <><WifiOff className="w-3 h-3" /> Lost</>}
          </Badge>
        </div>
      )}
      {!isLocal && connectionState === 'connected' && (
        <div className="absolute top-2 right-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" title="Connected" />
        </div>
      )}
    </div>
  );
}

export function GroupCallWindow({ groupId, groupName, onClose, callHook }: GroupCallWindowProps) {
  const { user } = useAuth();
  const {
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
  } = callHook;

  const [showParticipants, setShowParticipants] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (status !== 'connected' || !activeCall) return;
    const start = new Date(activeCall.started_at).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, activeCall]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleLeave = async () => {
    await leaveCall();
    onClose();
  };

  const participantList = Array.from(participants.values());
  const isVideoCall = activeCall?.call_type === 'video';

  // Not in a call yet - show join/start UI
  if (status === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center"
      >
        <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={onClose}>
          <X className="w-6 h-6" />
        </Button>

        <h2 className="text-2xl font-bold mb-2">{groupName}</h2>

        {activeCall ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">A call is active in this group</p>
            <Badge variant="outline" className="text-sm">{activeCall.call_type === 'video' ? 'Video' : 'Audio'} Call</Badge>
            <Button
              size="lg"
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={joinCall}
            >
              <Phone className="w-5 h-5" />
              Join Call
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Start a call for group members to join</p>
            <div className="flex gap-3">
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => startCall('audio')}
              >
                <Phone className="w-5 h-5" />
                Audio Call
              </Button>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => startCall('video')}
              >
                <Video className="w-5 h-5" />
                Video Call
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Joining state
  if (status === 'joining') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center"
      >
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Phone className="w-10 h-10 text-primary" />
          <p className="text-lg">Joining call...</p>
        </div>
      </motion.div>
    );
  }

  // Connected - show call UI
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{groupName}</h3>
          <Badge variant={isVideoCall ? 'default' : 'secondary'}>
            {isVideoCall ? 'Video' : 'Audio'}
          </Badge>
          <span className="text-sm text-muted-foreground font-mono">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {participantList.length + 1}
          </Badge>
          {isHost && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <Users className="w-4 h-4" />
              Manage
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video/Audio grid */}
        <div className={cn("flex-1 p-4 overflow-auto", showParticipants && "mr-64")}>
          <div className={cn(
            "grid gap-3 h-full auto-rows-fr",
            participantList.length === 0 ? "grid-cols-1" :
            participantList.length <= 1 ? "grid-cols-1 sm:grid-cols-2" :
            participantList.length <= 3 ? "grid-cols-2" :
            participantList.length <= 8 ? "grid-cols-2 sm:grid-cols-3" :
            "grid-cols-3 sm:grid-cols-4"
          )}>
            {/* Local user tile */}
            <VideoTile
              stream={localStream}
              label={user?.user_metadata?.full_name || 'You'}
              isMuted={isMuted}
              isLocal
            />

            {/* Remote participant tiles */}
            {participantList.map(p => (
              <VideoTile
                key={p.user_id}
                stream={p.stream}
                label={p.full_name || 'User'}
                avatarUrl={p.avatar_url}
                connectionState={p.connectionState}
              />
            ))}
          </div>
        </div>

        {/* Participants sidebar (host only) */}
        <AnimatePresence>
          {showParticipants && isHost && (
            <motion.div
              initial={{ x: 256 }}
              animate={{ x: 0 }}
              exit={{ x: 256 }}
              className="w-64 border-l border-border bg-muted/30 flex flex-col absolute right-0 top-[57px] bottom-[72px] z-10"
            >
              <div className="p-3 border-b border-border">
                <h4 className="font-medium text-sm">Participants ({participantList.length + 1})</h4>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {/* Self */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">You</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1">You (Host)</span>
                  </div>
                  {/* Others */}
                  {participantList.map(p => (
                    <div key={p.user_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{p.full_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{p.full_name || 'User'}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => kickParticipant(p.user_id)}
                        title="Remove from call"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 py-4 border-t border-border bg-background">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {isVideoCall && (
          <Button
            variant={isVideoOff ? 'destructive' : 'secondary'}
            size="icon"
            className="rounded-full w-12 h-12"
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          className="rounded-full w-14 h-14"
          onClick={handleLeave}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </motion.div>
  );
}
