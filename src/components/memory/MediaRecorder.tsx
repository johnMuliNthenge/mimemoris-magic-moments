import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Video, Square, Play, Pause, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface MediaRecorderProps {
  type: 'audio' | 'video';
  onRecordingComplete: (blob: Blob, url: string) => void;
  onCancel: () => void;
}

export function MediaRecorder({ type, onRecordingComplete, onCancel }: MediaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const { toast } = useToast();

  const mediaRecorderRef = useRef<globalThis.MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const startRecording = useCallback(async () => {
    try {
      const constraints = type === 'video' 
        ? { video: true, audio: true }
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mediaRecorder = new globalThis.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setPreviewUrl(url);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      setPermissionError(true);
      toast({
        variant: 'destructive',
        title: 'Camera/Microphone Access Denied',
        description: type === 'video' 
          ? 'Please allow camera & microphone access in your browser settings, then try again.'
          : 'Please allow microphone access in your browser settings, then try again.',
      });
    }
  }, [type, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  }, [isRecording, isPaused]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    chunksRef.current = [];
  }, []);

  const confirmRecording = useCallback(() => {
    if (recordedBlob && previewUrl) {
      onRecordingComplete(recordedBlob, previewUrl);
    }
  }, [recordedBlob, previewUrl, onRecordingComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="border-2 border-dashed border-border rounded-xl p-6 bg-card"
    >
      {/* Permission Error */}
      {permissionError && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-destructive text-sm">
              {type === 'video' ? 'Camera & Microphone' : 'Microphone'} access required
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap the lock/site-settings icon in your browser's address bar, allow {type === 'video' ? 'camera & microphone' : 'microphone'} access, then reload and try again.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setPermissionError(false);
                startRecording();
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Video Preview */}
      {type === 'video' && (
        <div className="relative mb-4 rounded-lg overflow-hidden bg-muted aspect-video">
          <video
            ref={videoPreviewRef}
            muted
            playsInline
            className={cn(
              "w-full h-full object-cover",
              !isRecording && !previewUrl && "hidden"
            )}
          />
          {previewUrl && !isRecording && (
            <video
              src={previewUrl}
              controls
              className="w-full h-full object-cover"
            />
          )}
          {!isRecording && !previewUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      {/* Audio Preview */}
      {type === 'audio' && previewUrl && !isRecording && (
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <audio src={previewUrl} controls className="w-full" />
        </div>
      )}

      {/* Recording Indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-4 mb-4"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-4 h-4 rounded-full bg-destructive"
            />
            <span className="font-mono text-xl font-bold">{formatTime(recordingTime)}</span>
            {isPaused && <span className="text-muted-foreground">(Paused)</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Waveform Visualization */}
      {type === 'audio' && isRecording && (
        <div className="flex items-center justify-center gap-1 h-16 mb-4">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-primary rounded-full"
              animate={{
                height: isPaused ? '8px' : ['8px', `${Math.random() * 48 + 8}px`, '8px'],
              }}
              transition={{
                repeat: isPaused ? 0 : Infinity,
                duration: 0.5,
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording && !recordedBlob && (
          <Button
            onClick={startRecording}
            className="gradient-warm text-primary-foreground gap-2"
          >
            {type === 'audio' ? <Mic className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={pauseRecording}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={stopRecording}
            >
              <Square className="w-5 h-5" />
            </Button>
          </>
        )}

        {recordedBlob && !isRecording && (
          <>
            <Button
              variant="outline"
              onClick={resetRecording}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Retry
            </Button>
            <Button
              onClick={confirmRecording}
              className="gradient-warm text-primary-foreground gap-2"
            >
              <Check className="w-4 h-4" />
              Use Recording
            </Button>
          </>
        )}
      </div>

      {/* Cancel Button */}
      <div className="mt-4 text-center">
        <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
