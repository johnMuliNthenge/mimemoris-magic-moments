import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image, 
  Video, 
  X, 
  Loader2, 
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { validateSafeInput } from '@/lib/security';
import { compressImage, formatFileSize } from '@/lib/media-utils';

interface CreatePostProps {
  onPostCreated: () => void;
  userProfile?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export function CreatePost({ onPostCreated, userProfile }: CreatePostProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'text'>('text');
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const MAX_VIDEO_DURATION = 30; // seconds

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file' });
      return;
    }
    
    if (file.size > 20 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Image must be less than 20MB' });
      return;
    }

    setCompressing(true);
    try {
      // Compress the image
      const compressedFile = await compressImage(file);
      setMediaFile(compressedFile);
      setMediaType('photo');
      setMediaPreview(URL.createObjectURL(compressedFile));
      toast({ 
        title: 'Image optimized', 
        description: `Compressed from ${formatFileSize(file.size)} to ${formatFileSize(compressedFile.size)}` 
      });
    } catch (error) {
      // If compression fails, use original
      setMediaFile(file);
      setMediaType('photo');
      setMediaPreview(URL.createObjectURL(file));
    } finally {
      setCompressing(false);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select a video file' });
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Video must be less than 50MB' });
      return;
    }

    // Check video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > MAX_VIDEO_DURATION) {
        toast({ 
          variant: 'destructive', 
          title: 'Video too long', 
          description: `Video must be ${MAX_VIDEO_DURATION} seconds or less` 
        });
        return;
      }
      
      setMediaFile(file);
      setMediaType('video');
      setMediaPreview(URL.createObjectURL(file));
    };
    
    video.src = URL.createObjectURL(file);
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('text');
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!content.trim() && !mediaFile) {
      toast({ variant: 'destructive', title: 'Empty post', description: 'Please add some content or media' });
      return;
    }

    // Validate content length (up to ~500 words)
    const contentValidation = validateSafeInput(content, 5000);
    if (!contentValidation.isValid) {
      toast({ variant: 'destructive', title: 'Invalid content', description: contentValidation.error });
      return;
    }

    setLoading(true);

    try {
      let mediaUrl = null;

      // Upload media if present
      if (mediaFile) {
        // Use jpeg extension for compressed images
        const fileExt = mediaType === 'photo' ? 'jpg' : mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('memories')
          .upload(fileName, mediaFile, {
            contentType: mediaType === 'photo' ? 'image/jpeg' : undefined,
          });
        
        if (uploadError) throw uploadError;
        
        mediaUrl = fileName;
      }

      // Create the memory post
      const { error } = await supabase
        .from('memories')
        .insert({
          user_id: user.id,
          content: contentValidation.sanitized || null,
          memory_type: mediaFile ? mediaType : 'text',
          media_url: mediaUrl,
          memory_date: new Date().toISOString().split('T')[0],
          is_public: true,
        });

      if (error) throw error;

      toast({ title: 'Posted!', description: 'Your memory has been shared' });
      setContent('');
      clearMedia();
      onPostCreated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to create post' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={userProfile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {userProfile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="Share a memory..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
              maxLength={5000}
            />
            
            {/* Media Preview */}
            <AnimatePresence>
              {mediaPreview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative rounded-lg overflow-hidden bg-muted"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
                    onClick={clearMedia}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  
                  {mediaFile && (
                    <Badge variant="secondary" className="absolute top-2 left-2 z-10">
                      {formatFileSize(mediaFile.size)}
                    </Badge>
                  )}
                  
                  {mediaType === 'photo' && (
                    <img 
                      src={mediaPreview} 
                      alt="Preview" 
                      className="w-full max-h-64 object-contain bg-muted"
                    />
                  )}
                  
                  {mediaType === 'video' && (
                    <video 
                      src={mediaPreview} 
                      controls 
                      className="w-full max-h-64 object-contain bg-black"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => imageInputRef.current?.click()}
                  disabled={loading || compressing}
                >
                  {compressing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Image className="w-4 h-4 mr-1" />
                  )}
                  {compressing ? 'Compressing...' : 'Image'}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => videoInputRef.current?.click()}
                  disabled={loading || compressing}
                >
                  <Video className="w-4 h-4 mr-1" />
                  Video (30s)
                </Button>
              </div>
              
              <Button 
                onClick={handleSubmit} 
                disabled={loading || (!content.trim() && !mediaFile)}
                className="gradient-warm text-primary-foreground"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
