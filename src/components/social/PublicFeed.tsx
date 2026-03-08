import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Loader2,
  Globe,
  Send,
  Pencil,
  Check,
  X,
  Flag,
  MoreVertical,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePublicFeed } from '@/hooks/usePublicFeed';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CreatePost } from './CreatePost';
import { MediaPlayer } from './MediaPlayer';
import { validateSafeInput } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

export function PublicFeed() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { memories, loading, loadingMore, hasMore, toggleLike, getComments, addComment, loadMore, refetch } = usePublicFeed();
  
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; avatar_url?: string } | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());

  // Tick every 10s so edit buttons disappear after 60s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setUserProfile(data);
    }
  };

  const openComments = async (memoryId: string) => {
    setSelectedMemory(memoryId);
    setLoadingComments(true);
    const fetchedComments = await getComments(memoryId);
    setComments(fetchedComments);
    setLoadingComments(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedMemory) return;
    
    // Validate comment for security
    const validation = validateSafeInput(newComment, 1000);
    if (!validation.isValid) {
      return;
    }
    
    setSubmittingComment(true);
    
    await addComment(selectedMemory, validation.sanitized);
    const updatedComments = await getComments(selectedMemory);
    setComments(updatedComments);
    setNewComment('');
    setSubmittingComment(false);
  };

  const canEdit = (memory: any) => {
    if (!user || memory.user_id !== user.id) return false;
    const secondsAgo = differenceInSeconds(new Date(), new Date(memory.created_at));
    return secondsAgo <= 60;
  };

  const startEdit = (memory: any) => {
    setEditingId(memory.id);
    setEditContent(memory.content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const validation = validateSafeInput(editContent, 5000);
    if (!validation.isValid) {
      toast({ variant: 'destructive', title: 'Invalid content', description: validation.error });
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from('memories')
      .update({ content: validation.sanitized })
      .eq('id', editingId)
      .eq('user_id', user!.id);
    setSavingEdit(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update post' });
    } else {
      toast({ title: 'Updated', description: 'Post updated successfully' });
      setEditingId(null);
      setEditContent('');
      refetch();
    }
  };

  const handleShare = async (memory: any) => {
    const shareUrl = `https://mimemora.lovable.app/friends`;
    const shareText = memory.content
      ? `${memory.user_profile?.full_name || 'Someone'} shared: "${memory.content.slice(0, 100)}${memory.content.length > 100 ? '...' : ''}"`
      : `Check out this memory on Mimemora!`;

    const copyFallback = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
      } catch {
        // Final fallback using textarea
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
      }
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mimemora',
          text: shareText,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Permission denied or other error — fall back to copy
          await copyFallback();
        }
      }
    } else {
      await copyFallback();
    }
  };

  const handleLike = async (memoryId: string) => {
    if (!user) return;
    await toggleLike(memoryId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border">
            <CardHeader className="flex flex-row items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Create Post */}
        {user && (
          <CreatePost onPostCreated={refetch} userProfile={userProfile} />
        )}

        {memories.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">No Public Memories</h3>
            <p className="text-muted-foreground">
              Be the first to share a memory with the community!
            </p>
          </div>
        ) : (
          memories.map((memory, index) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-border overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={memory.user_profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {memory.user_profile?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{memory.user_profile?.full_name || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(memory.memory_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {canEdit(memory) && editingId !== memory.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(memory)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                  {memory.mood && (
                    <span className="text-2xl">{memory.mood}</span>
                  )}
                </CardHeader>
                
                <CardContent className="pb-3">
                  {memory.title && (
                    <h4 className="font-semibold mb-2">{memory.title}</h4>
                  )}
                  
                  {editingId === memory.id ? (
                    <div className="mb-3 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] resize-none"
                        maxLength={5000}
                        autoFocus
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={savingEdit}>
                          <X className="w-4 h-4 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={savingEdit || !editContent.trim()}>
                          {savingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : memory.content ? (
                    <p className="text-muted-foreground mb-3">{memory.content}</p>
                  ) : null}

                  {memory.media_url && (
                    <div className="rounded-lg overflow-hidden bg-muted">
                      {memory.memory_type === 'photo' && (
                        <img 
                          src={memory.media_url} 
                          alt={memory.title || 'Memory'} 
                          className="w-full max-h-[400px] object-contain mx-auto"
                        />
                      )}
                      {memory.memory_type === 'video' && (
                        <MediaPlayer 
                          src={memory.media_url} 
                          type="video" 
                          className="max-h-[400px]"
                        />
                      )}
                      {memory.memory_type === 'audio' && (
                        <MediaPlayer 
                          src={memory.media_url} 
                          type="audio"
                        />
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="border-t border-border pt-3">
                  <div className="flex items-center gap-4 w-full">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn(
                        "gap-2",
                        memory.is_liked && "text-destructive"
                      )}
                      onClick={() => handleLike(memory.id)}
                      disabled={!user}
                    >
                      <Heart className={cn("w-5 h-5", memory.is_liked && "fill-current")} />
                      {memory.likes_count}
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => openComments(memory.id)}
                    >
                      <MessageCircle className="w-5 h-5" />
                      {memory.comments_count}
                    </Button>
                    
                    <Button variant="ghost" size="sm" className="gap-2 ml-auto" onClick={() => handleShare(memory)}>
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Comments Dialog */}
      <Dialog open={!!selectedMemory} onOpenChange={() => setSelectedMemory(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            {loadingComments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No comments yet</p>
                <p className="text-sm">Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={comment.user_profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {comment.user_profile?.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {comment.user_profile?.full_name || 'Anonymous'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {user && (
            <div className="flex gap-2 pt-4 border-t border-border">
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                disabled={submittingComment}
                maxLength={1000}
              />
              <Button onClick={handleAddComment} disabled={submittingComment || !newComment.trim()}>
                {submittingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
