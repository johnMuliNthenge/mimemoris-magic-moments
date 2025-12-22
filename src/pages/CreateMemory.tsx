import { useState, useRef } from 'react';
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
  Smile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const memoryTypes = [
  { type: 'text', icon: FileText, label: 'Text', color: 'bg-primary' },
  { type: 'audio', icon: Mic, label: 'Audio', color: 'bg-accent' },
  { type: 'video', icon: Video, label: 'Video', color: 'bg-collab' },
  { type: 'photo', icon: Image, label: 'Photo', color: 'bg-success' },
] as const;

const moods = ['😊', '😢', '😍', '🤔', '😴', '🎉', '😤', '😌', '🥰', '😎'];

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
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
    }
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

        const { data: urlData } = supabase.storage
          .from('memories')
          .getPublicUrl(filePath);

        mediaUrl = urlData.publicUrl;
      }

      // Create memory record
      const { error } = await supabase.from('memories').insert({
        user_id: user?.id,
        memory_type: selectedType,
        memory_date: memoryDate,
        title: title || null,
        content: content || null,
        media_url: mediaUrl,
        mood: selectedMood,
      });

      if (error) throw error;

      // Update memories used count
      if (subscription) {
        await supabase
          .from('user_subscriptions')
          .update({ 
            memories_used_this_month: subscription.memories_used_this_month + 1 
          })
          .eq('id', subscription.id);
      }

      toast({
        title: 'Memory Saved!',
        description: 'Your memory has been captured successfully.',
      });

      refetch();
      navigate('/memories');
    } catch (error: any) {
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
                {remainingMemories()} memories remaining this month
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
              <div className="space-y-2">
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
                
                {mediaPreview ? (
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-colors"
                  >
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <span className="text-muted-foreground">Click to upload or drag and drop</span>
                  </button>
                )}

                {/* Description for media */}
                <div className="mt-4 space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder={t('describe_memory')}
                    className="min-h-20"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Mood Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Smile className="w-4 h-4" />
                How were you feeling?
              </Label>
              <div className="flex flex-wrap gap-2">
                {moods.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setSelectedMood(selectedMood === mood ? null : mood)}
                    className={cn(
                      "text-2xl p-2 rounded-lg transition-all",
                      selectedMood === mood
                        ? "bg-primary/20 scale-110"
                        : "hover:bg-secondary"
                    )}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

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
                {t('save')}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AppLayout>
  );
}
