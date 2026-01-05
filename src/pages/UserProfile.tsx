import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  UserPlus, 
  UserMinus, 
  MessageCircle, 
  Globe, 
  Calendar,
  Loader2,
  Heart,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface PublicMemory {
  id: string;
  title: string | null;
  content: string | null;
  memory_type: string;
  memory_date: string;
  media_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { friends, pendingRequests, sendFriendRequest, unfriend } = useFriends();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memories, setMemories] = useState<PublicMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMemories, setLoadingMemories] = useState(true);

  const isOwnProfile = user?.id === userId;
  const isFriend = friends.some(f => f.user_id === userId);
  const isPendingRequest = pendingRequests.some(p => p.user_id === userId);
  const friendRelation = [...friends, ...pendingRequests].find(f => f.user_id === userId);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchPublicMemories();
    }
  }, [userId]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load profile'
      });
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const fetchPublicMemories = async () => {
    // Get public memories for this user
    const { data: memoriesData } = await supabase
      .from('memories')
      .select('id, title, content, memory_type, memory_date, media_url, thumbnail_url, created_at')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('memory_date', { ascending: false })
      .limit(20);

    if (memoriesData && memoriesData.length > 0) {
      // Get likes and comments counts
      const memoryIds = memoriesData.map(m => m.id);
      
      const [{ data: likesData }, { data: commentsData }] = await Promise.all([
        supabase
          .from('memory_likes')
          .select('memory_id')
          .in('memory_id', memoryIds),
        supabase
          .from('memory_comments')
          .select('memory_id')
          .in('memory_id', memoryIds)
      ]);

      const likesCount: Record<string, number> = {};
      const commentsCount: Record<string, number> = {};
      
      likesData?.forEach(like => {
        likesCount[like.memory_id] = (likesCount[like.memory_id] || 0) + 1;
      });
      
      commentsData?.forEach(comment => {
        commentsCount[comment.memory_id] = (commentsCount[comment.memory_id] || 0) + 1;
      });

      setMemories(memoriesData.map(m => ({
        ...m,
        likes_count: likesCount[m.id] || 0,
        comments_count: commentsCount[m.id] || 0
      })));
    }
    setLoadingMemories(false);
  };

  const handleFriendAction = async () => {
    if (isFriend && friendRelation) {
      await unfriend(friendRelation.id);
      toast({ title: 'Unfriended' });
    } else if (!isPendingRequest) {
      const { error } = await sendFriendRequest(userId!);
      if (!error) {
        toast({ title: 'Friend request sent!' });
      }
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">User not found</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="w-24 h-24 md:w-32 md:h-32">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  {profile.full_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {profile.full_name || 'Unknown User'}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    Joined {format(new Date(profile.created_at), 'MMMM yyyy')}
                  </span>
                </div>
                
                {!isOwnProfile && (
                  <div className="flex gap-3 mt-4 justify-center md:justify-start">
                    <Button 
                      onClick={handleFriendAction}
                      variant={isFriend ? 'outline' : 'default'}
                      disabled={isPendingRequest}
                    >
                      {isFriend ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-2" />
                          Unfriend
                        </>
                      ) : isPendingRequest ? (
                        'Request Pending'
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Friend
                        </>
                      )}
                    </Button>
                    {isFriend && (
                      <Button variant="outline" onClick={() => navigate('/social')}>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Memories */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Public Memories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMemories ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : memories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No public memories yet
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {memories.map((memory, index) => (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-lg border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
                  >
                    {memory.thumbnail_url || memory.media_url ? (
                      <div className="aspect-video bg-muted">
                        <img 
                          src={memory.thumbnail_url || memory.media_url || ''} 
                          alt={memory.title || 'Memory'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-4xl">📝</span>
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-medium line-clamp-1">
                        {memory.title || 'Untitled Memory'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(memory.memory_date), 'MMM d, yyyy')}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          {memory.likes_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {memory.comments_count}
                        </span>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {memory.memory_type}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}