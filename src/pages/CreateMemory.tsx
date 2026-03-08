import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  FileText,
  Mic,
  Video,
  Image,
  Calendar,
  Upload,
  Loader2,
  X,
  Smile,
  Circle,
  Globe,
  Lock,
  Brain,
  Sparkles,
  WifiOff,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { MediaRecorder } from '@/components/memory/MediaRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { saveOfflineMemory, saveOfflineMedia } from '@/lib/offline-store';
import { smartCompressImage, isVideoWithinTierLimits, formatCompressionStats, type CompressionTier } from '@/lib/smart-compression';

const memoryTypes = [
  { type: 'text', icon: FileText, label: 'Text', color: 'bg-primary' },
  { type: 'audio', icon: Mic, label: 'Audio', color: 'bg-accent' },
  { type: 'video', icon: Video, label: 'Video', color: 'bg-collab' },
  { type: 'photo', icon: Image, label: 'Photo', color: 'bg-success' },
] as const;

export default function CreateMemory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, canCreateMemory, remainingMemories, refetch } = useSubscription();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedType, setSelectedType] = useState<'text' | 'audio' | 'video' | 'photo'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memoryDate, setMemoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [detectedEmoji, setDetectedEmoji] = useState<string | null>(null);
  const [moodLabel, setMoodLabel] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingMood, setAnalyzingMood] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [lockedUntil, setLockedUntil] = useState('');

  // Auto-detect mood when content changes (debounced)
  const analyzeDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  
  const runMoodAnalysis = useCallback(async (textContent: string, type: string, mediaUrl?: string) => {
    if (!textContent && !mediaUrl) return;
    
    setAnalyzingMood(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-mood', {
        body: { content: textContent, memoryType: type, mediaUrl },
      });

      if (error) throw error;

      if (data && !data.error) {
        setDetectedEmoji(data.emoji || null);
        setDetectedMood(data.sentiment || null);
        setMoodLabel(data.primary_emotion || data.mood_label || null);
        setAiAnalysis(data);
      }
    } catch (err: any) {
      console.error('Mood analysis error:', err);
    } finally {
      setAnalyzingMood(false);
    }
  }, []);

  // Auto-analyze text content after user stops typing (1.5s debounce)
  useEffect(() => {
    if (analyzeDebounceRef.current) {
      clearTimeout(analyzeDebounceRef.current);
    }

    if (content && content.length >= 10) {
      analyzeDebounceRef.current = setTimeout(() => {
        runMoodAnalysis(content, selectedType);
      }, 1500);
    }

    return () => {
      if (analyzeDebounceRef.current) clearTimeout(analyzeDebounceRef.current);
    };
  }, [content, selectedType, runMoodAnalysis]);

  // Determine compression tier from subscription
  const compressionTier: CompressionTier = (subscription as any)?.subscription_plans?.tier || 'basic';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Smart compression for images
    if (file.type.startsWith('image/')) {
      try {
        const { file: compressed, stats } = await smartCompressImage(file, compressionTier);
        setMediaFile(compressed);
        setMediaPreview(URL.createObjectURL(compressed));
        toast({
          title: '🗜️ Smart Compression',
          description: formatCompressionStats(stats),
        });
        return;
      } catch {
        // Fall back to original
      }
    }

    // Video tier check
    if (file.type.startsWith('video/')) {
      const check = isVideoWithinTierLimits(file, compressionTier);
      if (!check.allowed) {
        toast({
          variant: 'destructive',
          title: 'Video too large',
          description: `Your plan allows up to ${check.maxSizeMB}MB videos. This file is ${check.fileSizeMB}MB.`,
        });
        return;
      }
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleRecordingComplete = (blob: Blob, url: string) => {
    setMediaFile(new File([blob], `recording.webm`, { type: blob.type }));
    setMediaPreview(url);
    setShowRecorder(false);
  };

  const saveMemoryOffline = async () => {
    if (!user) return;
    
    const memoryId = crypto.randomUUID();
    
    await saveOfflineMemory({
      id: memoryId,
      user_id: user.id,
      memory_type: selectedType,
      memory_date: memoryDate,
      title: title || null,
      content: content || null,
      mood: detectedEmoji || null,
      ai_analysis: aiAnalysis,
      is_public: isPublic,
      locked_until: lockedUntil ? new Date(lockedUntil).toISOString() : null,
      sentiment_score: aiAnalysis?.sentiment_score ?? null,
      emotion_category: aiAnalysis?.emotion_category ?? null,
      people_tags: aiAnalysis?.people_tags ?? [],
      location_data: aiAnalysis?.location_hint ? { hint: aiAnalysis.location_hint } : null,
      event_category: aiAnalysis?.event_category ?? null,
      privacy_level: isPublic ? 'public' : 'private',
    });

    // Save media file to IndexedDB
    if (mediaFile) {
      const arrayBuffer = await mediaFile.arrayBuffer();
      await saveOfflineMedia({
        id: crypto.randomUUID(),
        memory_id: memoryId,
        file_data: arrayBuffer,
        file_name: mediaFile.name,
        file_type: mediaFile.type,
        file_size: mediaFile.size,
        compression_tier: compressionTier,
      });
    }

    toast({
      title: '📴 Saved Offline',
      description: 'Memory will sync automatically when you reconnect.',
    });
    navigate('/memories');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreateMemory()) {
      toast({
        variant: 'destructive',
        title: 'Memory Limit Reached',
        description: 'Please upgrade your plan to create more memories.',
      });
      navigate('/subscription');
      return;
    }

    // If offline, save locally
    if (!navigator.onLine) {
      await saveMemoryOffline();
      return;
    }

    setLoading(true);

    try {
      let mediaUrl = null;

      // Upload media file if exists
      if (mediaFile && user) {
        const fileExt = mediaFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('memories')
          .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        mediaUrl = filePath;
      }

      // If we have media but no AI analysis yet, run it now with the media URL
      let finalAnalysis = aiAnalysis;
      let finalEmoji = detectedEmoji;
      if (!finalAnalysis && (content || mediaUrl)) {
        try {
          const { data } = await supabase.functions.invoke('analyze-mood', {
            body: { content: content || '', memoryType: selectedType, mediaUrl },
          });
          if (data && !data.error) {
            finalAnalysis = data;
            finalEmoji = data.emoji || null;
          }
        } catch {
          // Non-blocking - save memory even if analysis fails
        }
      }

      // Create memory record with AI-detected mood emoji and full metadata
      const insertData: any = {
        user_id: user?.id,
        memory_type: selectedType,
        memory_date: memoryDate,
        title: title || null,
        content: content || null,
        media_url: mediaUrl,
        mood: finalEmoji || detectedEmoji || null,
        ai_analysis: finalAnalysis,
        is_public: isPublic,
        sentiment_score: finalAnalysis?.sentiment_score ?? null,
        emotion_category: finalAnalysis?.emotion_category ?? null,
        people_tags: finalAnalysis?.people_tags ?? [],
        location_data: finalAnalysis?.location_hint ? { hint: finalAnalysis.location_hint } : null,
        event_category: finalAnalysis?.event_category ?? null,
        privacy_level: isPublic ? 'public' : 'private',
      };
      if (lockedUntil) {
        insertData.locked_until = new Date(lockedUntil).toISOString();
      }
      const { error } = await supabase.from('memories').insert(insertData);

      if (error) throw error;

      // Update memories used count using secure RPC
      if (subscription) {
        await supabase.rpc('increment_memory_usage', { _subscription_id: subscription.id });
      }

      toast({
        title: 'Memory Saved! ' + (finalEmoji || '✨'),
        description: moodLabel 
          ? `Mood detected: ${moodLabel} ${finalEmoji}` 
          : 'Your memory has been captured successfully.',
      });

      refetch();
      navigate('/memories');
    } catch (error: any) {
      // If network error, save offline as fallback
      if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('fetch')) {
        await saveMemoryOffline();
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save memory',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">{t('create_memory')}</h1>
              <p className="text-sm text-muted-foreground">
                {remainingMemories()} memories remaining today
              </p>
            </div>
          </div>

          {/* Memory Type Selection */}
          <div className="mb-8">
            <Label className="mb-3 block">Memory Type</Label>
            <div className="grid grid-cols-4 gap-3">
              {memoryTypes.map(({ type, icon: Icon, label, color }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    selectedType === type
                      ? `border-primary ${color} text-primary-foreground`
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">{t('memory_date')}</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  className="pl-10"
                  value={memoryDate}
                  onChange={(e) => setMemoryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('memory_title')}</Label>
              <Input
                id="title"
                placeholder="Give your memory a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Content - for text type */}
            {selectedType === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="content">{t('memory_content')}</Label>
                <Textarea
                  id="content"
                  placeholder={t('describe_memory')}
                  className="min-h-32"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            )}

            {/* Media Upload - for audio, video, photo */}
            {selectedType !== 'text' && (
              <div className="space-y-4">
                <Label>{t('upload_media')}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={
                    selectedType === 'audio' ? 'audio/*' :
                    selectedType === 'video' ? 'video/*' :
                    'image/*'
                  }
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                {showRecorder && (selectedType === 'audio' || selectedType === 'video') ? (
                  <MediaRecorder
                    type={selectedType}
                    onRecordingComplete={handleRecordingComplete}
                    onCancel={() => setShowRecorder(false)}
                  />
                ) : mediaPreview ? (
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-0">
                      {selectedType === 'photo' && (
                        <img src={mediaPreview} alt="Preview" className="w-full h-48 object-cover" />
                      )}
                      {selectedType === 'video' && (
                        <video src={mediaPreview} controls className="w-full h-48 object-cover" />
                      )}
                      {selectedType === 'audio' && (
                        <div className="p-6">
                          <audio src={mediaPreview} controls className="w-full" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setMediaFile(null);
                          setMediaPreview(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {(selectedType === 'audio' || selectedType === 'video') && (
                      <button
                        type="button"
                        onClick={() => setShowRecorder(true)}
                        className="w-full h-24 border-2 border-dashed border-primary/50 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <Circle className="w-8 h-8 text-primary" />
                        <span className="text-primary font-medium">
                          Record {selectedType === 'audio' ? 'Audio' : 'Video'}
                        </span>
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-colors"
                    >
                      <Upload className="w-10 h-10 text-muted-foreground" />
                      <span className="text-muted-foreground">Click to upload or drag and drop</span>
                    </button>
                  </div>
                )}

                {/* Narration / Description for media */}
                <div className="mt-4 space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    {selectedType === 'video' ? (
                      <>
                        <Mic className="w-4 h-4 text-primary" />
                        Narration / Description
                      </>
                    ) : (
                      'Description (optional)'
                    )}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder={
                      selectedType === 'video'
                        ? 'Add a brief narration or describe what this video captures...'
                        : t('describe_memory')
                    }
                    className="min-h-24"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  {selectedType === 'video' && (
                    <p className="text-xs text-muted-foreground">
                      Tip: Your video records with audio. Add written context here for your future self.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* AI Mood Detection Card - Always visible */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-primary" />
                  <span className="font-medium text-sm">AI Mood Detection</span>
                  {analyzingMood && (
                    <div className="flex items-center gap-1 ml-auto">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    </div>
                  )}
                </div>

                {detectedEmoji ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{detectedEmoji}</span>
                      <div>
                        <p className="font-medium capitalize">{moodLabel || detectedMood}</p>
                        <p className="text-xs text-muted-foreground">AI detected mood</p>
                      </div>
                      {aiAnalysis?.confidence && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {Math.round(aiAnalysis.confidence * 100)}% confident
                        </Badge>
                      )}
                    </div>

                    {/* Detected emotions */}
                    {aiAnalysis?.emotions && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiAnalysis.emotions.slice(0, 5).map((emotion: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs bg-accent/10">
                            {emotion}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Insight */}
                    {aiAnalysis?.insight && (
                      <div className="p-2.5 bg-background/50 rounded-lg border border-border text-sm">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <p className="text-muted-foreground text-xs">{aiAnalysis.insight}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {content && content.length < 10
                      ? 'Keep typing... AI will detect your mood automatically'
                      : 'Start writing or upload media — AI will automatically detect your mood and assign an emoji'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Time-Lock */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="locked_until">{t('timelock_label')}</Label>
                  <p className="text-xs text-muted-foreground">{t('timelock_desc')}</p>
                </div>
              </div>
            </div>
            {
              <div className="space-y-2 pl-2">
                <Input
                  id="locked_until"
                  type="datetime-local"
                  value={lockedUntil}
                  onChange={(e) => setLockedUntil(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
                {lockedUntil && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLockedUntil('')}>
                    <X className="w-3 h-3 mr-1" /> {t('timelock_clear')}
                  </Button>
                )}
              </div>
            }

            {/* Share to Public Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="public">Share to Public</Label>
                  <p className="text-xs text-muted-foreground">Make this memory visible on the public feed</p>
                </div>
              </div>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {/* Compression Tier Info */}
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                Smart Compression: <span className="font-medium text-foreground capitalize">{compressionTier}</span> tier
                {compressionTier === 'basic' && ' (720p)'}
                {compressionTier === 'standard' && ' (1080p)'}
                {compressionTier === 'premium' && ' (4K)'}
              </span>
            </div>

            {/* Offline indicator */}
            {!navigator.onLine && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <WifiOff className="w-4 h-4 text-warning" />
                <span className="text-xs text-warning-foreground">
                  You're offline — memory will be saved locally and synced when reconnected
                </span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1 gradient-warm text-primary-foreground"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {!navigator.onLine && <WifiOff className="w-4 h-4 mr-2" />}
                {detectedEmoji ? `${t('save')} ${detectedEmoji}` : t('save')}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AppLayout>
  );
}
