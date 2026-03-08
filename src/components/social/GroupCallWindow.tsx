import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, UserMinus, X, Users, Wifi, WifiOff, Monitor, MonitorOff, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
    void videoRef.current.play().catch(() => {});
  }, [stream, hasVideo]);

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden aspect-video flex items-center justify-center min-h-[100px]">
      {stream && hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <Avatar className="w-12 h-12 sm:w-16 sm:h-16">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="text-xl sm:text-2xl bg-primary/20 text-primary">
            {label[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
        <Badge variant="secondary" className="text-[10px] sm:text-xs bg-background/80 backdrop-blur-sm px-1.5 py-0.5">
          {label}{isLocal ? ' (You)' : ''}
        </Badge>
        {isMuted && <MicOff className="w-3 h-3 text-destructive" />}
      </div>
      {!isLocal && connectionState && connectionState !== 'connected' && (
        <div className="absolute top-1.5 right-1.5">
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] sm:text-[10px] gap-0.5 bg-background/80 backdrop-blur-sm px-1.5 py-0.5",
              connectionState === 'connecting' && "text-amber-500 border-amber-500/50",
              connectionState === 'reconnecting' && "text-orange-500 border-orange-500/50 animate-pulse",
              connectionState === 'disconnected' && "text-destructive border-destructive/50"
            )}
          >
            {connectionState === 'connecting' && <><Wifi className="w-2.5 h-2.5" /> Connecting</>}
            {connectionState === 'reconnecting' && <><Wifi className="w-2.5 h-2.5" /> Reconnecting</>}
            {connectionState === 'disconnected' && <><WifiOff className="w-2.5 h-2.5" /> Lost</>}
          </Badge>
        </div>
      )}
      {!isLocal && connectionState === 'connected' && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" title="Connected" />
        </div>
      )}
    </div>
  );
}

function ParticipantsList({ participantList, kickParticipant }: {
  participantList: { user_id: string; full_name: string | null; avatar_url: string | null; connectionState: string }[];
  kickParticipant: (id: string) => void;
}) {
  return (
    <div className="p-2 space-y-1">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs">You</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium flex-1">You (Host)</span>
      </div>
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
  );
}

export function GroupCallWindow({ groupId, groupName, onClose, callHook }: GroupCallWindowProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
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
  } = callHook;

  const [elapsed, setElapsed] = useState(0);

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

  // Check if screen share API is available (not available on most mobile browsers)
  const canScreenShare = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  // Idle - show join/start UI
  if (status === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center px-4"
      >
        <Button variant="ghost" size="icon" className="absolute top-3 right-3 sm:top-4 sm:right-4" onClick={onClose}>
          <X className="w-6 h-6" />
        </Button>

        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center">{groupName}</h2>

        {activeCall ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-center text-sm sm:text-base">{t('call_active')}</p>
            <Badge variant="outline" className="text-sm">{activeCall.call_type === 'video' ? t('video_call') : t('audio_call')}</Badge>
            <Button
              size="lg"
              className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              onClick={joinCall}
            >
              <Phone className="w-5 h-5" />
              {t('join_call')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            <p className="text-muted-foreground text-center text-sm sm:text-base">{t('start_call_desc')}</p>
            <div className="flex gap-3 w-full">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 flex-1"
                onClick={() => startCall('audio')}
              >
                <Phone className="w-5 h-5" />
                <span className="hidden sm:inline">{t('audio_call')}</span>
                <span className="sm:hidden">{t('audio_call')}</span>
              </Button>
              <Button
                size="lg"
                className="gap-2 flex-1"
                onClick={() => startCall('video')}
              >
                <Video className="w-5 h-5" />
                <span className="hidden sm:inline">{t('video_call')}</span>
                <span className="sm:hidden">{t('video_call')}</span>
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Joining
  if (status === 'joining') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center"
      >
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Phone className="w-10 h-10 text-primary" />
          <p className="text-lg">{t('joining_call')}</p>
        </div>
      </motion.div>
    );
  }

  // Connected
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base truncate">{groupName}</h3>
          <Badge variant={isVideoCall ? 'default' : 'secondary'} className="text-[10px] sm:text-xs shrink-0">
            {isVideoCall ? 'Video' : 'Audio'}
          </Badge>
          <span className="text-xs sm:text-sm text-muted-foreground font-mono shrink-0">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs">
            <Users className="w-3 h-3" />
            {participantList.length + 1}
          </Badge>
          {isHost && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-8 px-2 sm:px-3">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 sm:w-80 p-0">
                <SheetHeader className="p-3 border-b border-border">
                  <SheetTitle className="text-sm">Participants ({participantList.length + 1})</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-49px)]">
                  <ParticipantsList participantList={participantList} kickParticipant={kickParticipant} />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 p-2 sm:p-4 overflow-auto">
        <div className={cn(
          "grid gap-2 sm:gap-3 h-full auto-rows-fr",
          participantList.length === 0 ? "grid-cols-1" :
          participantList.length <= 1 ? "grid-cols-1 sm:grid-cols-2" :
          participantList.length <= 3 ? "grid-cols-2" :
          participantList.length <= 8 ? "grid-cols-2 sm:grid-cols-3" :
          "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}>
          {isScreenSharing && screenStream && (
            <div className="col-span-full">
              <VideoTile stream={screenStream} label="Your Screen" isLocal />
            </div>
          )}

          <VideoTile
            stream={localStream}
            label={user?.user_metadata?.full_name || 'You'}
            isMuted={isMuted}
            isLocal
          />

          {participantList.map(p => (
            <div key={p.user_id} className="relative">
              <VideoTile
                stream={p.stream}
                label={p.full_name || 'User'}
                avatarUrl={p.avatar_url}
                connectionState={p.connectionState}
              />
              {raisedHands.has(p.user_id) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 left-2 bg-warning/90 rounded-full p-1.5 shadow-lg"
                >
                  <Hand className="w-4 h-4 text-warning-foreground" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls bar - touch-friendly sizing */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 py-3 sm:py-4 px-4 border-t border-border bg-background shrink-0 safe-area-bottom">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="icon"
          className="rounded-full w-11 h-11 sm:w-12 sm:h-12"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {isVideoCall && (
          <Button
            variant={isVideoOff ? 'destructive' : 'secondary'}
            size="icon"
            className="rounded-full w-11 h-11 sm:w-12 sm:h-12"
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
        )}

        {canScreenShare && (
          <Button
            variant={isScreenSharing ? 'default' : 'secondary'}
            size="icon"
            className={cn("rounded-full w-11 h-11 sm:w-12 sm:h-12", isScreenSharing && "bg-primary text-primary-foreground")}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>
        )}

        <Button
          variant={handRaised ? 'default' : 'secondary'}
          size="icon"
          className={cn("rounded-full w-11 h-11 sm:w-12 sm:h-12", handRaised && "bg-warning text-warning-foreground")}
          onClick={toggleHandRaise}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-5 h-5" />
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="rounded-full w-12 h-12 sm:w-14 sm:h-14"
          onClick={handleLeave}
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
        </Button>
      </div>
    </motion.div>
  );
}
