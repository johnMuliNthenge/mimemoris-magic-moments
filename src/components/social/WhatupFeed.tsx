import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Heart, MessageCircle, Share2, Loader2, Send, Video, X, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useWhatup } from '@/hooks/useWhatup';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateSafeInput } from '@/lib/security';
import { formatFileSize } from '@/lib/media-utils';
import { cn } from '@/lib/utils';
import { MediaPlayer } from './MediaPlayer';

export function WhatupFeed() {
  const { user } = useAuth();
  const { posts, loading, toggleLike, getComments, addComment, searchUsers, refetch } = useWhatup();
  const { toast } = useToast();

  // Upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Comments state
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const MAX_VIDEO_DURATION = 40;

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > MAX_VIDEO_DURATION) {
        toast({ variant: 'destructive', title: 'Video too long', description: `Video must be ${MAX_VIDEO_DURATION} seconds or less` });
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    };
    video.src = URL.createObjectURL(file);
  };

  const clearVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    setCaption('');
  };

  const handlePost = async () => {
    if (!user || !videoFile) return;

    const captionValidation = validateSafeInput(caption, 2000);
    if (caption && !captionValidation.isValid) {
      toast({ variant: 'destructive', title: 'Invalid caption', description: captionValidation.error });
      return;
    }

    setUploading(true);
    try {
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${user.id}/trending-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('memories')
        .upload(fileName, videoFile);

      if (uploadError) throw uploadError;

      const { error } = await supabase.from('whatup_posts').insert({
        user_id: user.id,
        video_url: fileName,
        caption: captionValidation.sanitized || null,
      });

      if (error) throw error;

      toast({ title: 'Posted!', description: 'Your Trending video is live' });
      clearVideo();
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to post' });
    } finally {
      setUploading(false);
    }
  };

  const openComments = async (postId: string) => {
    setSelectedPost(postId);
    setLoadingComments(true);
    const fetched = await getComments(postId);
    setComments(fetched);
    setLoadingComments(false);
  };

  const handleCommentChange = async (value: string) => {
    setNewComment(value);

    // Detect @mention
    const cursorPos = commentInputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      if (query.length >= 1) {
        const results = await searchUsers(query);
        setMentionResults(results);
        setShowMentionDropdown(results.length > 0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setMentionQuery(null);
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (userName: string) => {
    const cursorPos = commentInputRef.current?.selectionStart || newComment.length;
    const textBeforeCursor = newComment.slice(0, cursorPos);
    const textAfterCursor = newComment.slice(cursorPos);
    const beforeMention = textBeforeCursor.replace(/@\S*$/, '');
    const updated = `${beforeMention}@${userName} ${textAfterCursor}`;
    setNewComment(updated);
    setShowMentionDropdown(false);
    setMentionQuery(null);
    commentInputRef.current?.focus();
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPost) return;

    const validation = validateSafeInput(newComment, 1000);
    if (!validation.isValid) return;

    setSubmittingComment(true);
    await addComment(selectedPost, validation.sanitized);
    const updated = await getComments(selectedPost);
    setComments(updated);
    setNewComment('');
    setSubmittingComment(false);
  };

  const handleShare = async (post: any) => {
    const shareUrl = `https://mimemora.lovable.app/friends`;
    const shareText = post.caption || 'Check out this Trending video on Mimemora!';

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mimemora Trending', text: shareText, url: shareUrl });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await navigator.clipboard.writeText(shareUrl);
          toast({ title: 'Link copied!' });
        }
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!' });
    }
  };

  // Render comment content with highlighted @mentions
  const renderCommentContent = (content: string) => {
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <Card key={i} className="border-border">
            <CardHeader className="flex flex-row items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
            </CardHeader>
            <CardContent><Skeleton className="h-64 w-full rounded-lg" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Upload Section */}
        {user && (
          <Card className="border-border">
            <CardContent className="p-4">
              {!videoFile ? (
                <div className="space-y-3">
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed gap-3"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">Upload a Trending Video</p>
                      <p className="text-xs text-muted-foreground">Up to {MAX_VIDEO_DURATION} seconds</p>
                    </div>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <Button
                      variant="ghost" size="icon"
                      className="absolute top-2 right-2 z-10 bg-background/80"
                      onClick={clearVideo}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Badge variant="secondary" className="absolute top-2 left-2 z-10">
                      {formatFileSize(videoFile.size)}
                    </Badge>
                    <video src={videoPreview!} controls className="w-full max-h-64 object-contain bg-black" />
                  </div>
                  <Textarea
                    placeholder="Add a caption..."
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    className="min-h-[60px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
                    maxLength={2000}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handlePost} disabled={uploading} className="gradient-warm text-primary-foreground">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Video className="w-4 h-4 mr-1" />}
                      {uploading ? 'Posting...' : 'Post Video'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Posts Feed */}
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">No Trending Videos Yet</h3>
            <p className="text-muted-foreground">Be the first to share a short video!</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-border overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={post.user_profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {post.user_profile?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{post.user_profile?.full_name || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(post.created_at), 'MMM d, yyyy · HH:mm')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Video className="w-3 h-3" /> Trending
                  </Badge>
                </CardHeader>

                <CardContent className="pb-3">
                  {post.caption && <p className="text-muted-foreground mb-3">{post.caption}</p>}
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <MediaPlayer src={post.video_url} type="video" className="max-h-[400px]" />
                  </div>
                </CardContent>

                <CardFooter className="border-t border-border pt-3">
                  <div className="flex items-center gap-4 w-full">
                    <Button
                      variant="ghost" size="sm"
                      className={cn("gap-2", post.is_liked && "text-destructive")}
                      onClick={() => toggleLike(post.id)}
                      disabled={!user}
                    >
                      <Heart className={cn("w-5 h-5", post.is_liked && "fill-current")} />
                      {post.likes_count}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => openComments(post.id)}>
                      <MessageCircle className="w-5 h-5" />
                      {post.comments_count}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2 ml-auto" onClick={() => handleShare(post)}>
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
      <Dialog open={!!selectedPost} onOpenChange={() => { setSelectedPost(null); setShowMentionDropdown(false); }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {loadingComments ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No comments yet</p>
                <p className="text-sm">Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={comment.user_profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{comment.user_profile?.full_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.user_profile?.full_name || 'Anonymous'}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), 'MMM d, HH:mm')}</span>
                      </div>
                      <p className="text-sm">{renderCommentContent(comment.content)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {user && (
            <div className="relative pt-4 border-t border-border">
              {/* @mention dropdown */}
              {showMentionDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                  {mentionResults.map(u => (
                    <button
                      key={u.user_id}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted text-left text-sm"
                      onClick={() => insertMention(u.full_name)}
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{u.full_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <span>{u.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={commentInputRef}
                  placeholder="Write a comment... Use @name to tag"
                  value={newComment}
                  onChange={e => handleCommentChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !showMentionDropdown) handleAddComment(); }}
                  disabled={submittingComment}
                  maxLength={1000}
                />
                <Button onClick={handleAddComment} disabled={submittingComment || !newComment.trim()}>
                  {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
