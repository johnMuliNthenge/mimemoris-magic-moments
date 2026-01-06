import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  MessageCircle,
  Loader2,
  Search,
  Ban,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFriends } from '@/hooks/useFriends';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FriendsListProps {
  onStartChat?: (userId: string) => void;
}

const USERS_PER_PAGE = 10;

export function FriendsList({ onStartChat }: FriendsListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { friends, pendingRequests, loading, acceptRequest, rejectRequest, unfriend, sendFriendRequest } = useFriends();
  const { blockedUsers, isBlocked, blockUser, unblockUser } = useBlockedUsers();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const searchUsers = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    
    setSearching(true);
    const currentPage = isLoadMore ? page : 0;

    // Get existing friend/pending user IDs to exclude
    const existingUserIds = new Set<string>();
    existingUserIds.add(user.id);
    friends.forEach(f => existingUserIds.add(f.user_id));
    pendingRequests.forEach(p => existingUserIds.add(p.user_id));
    // Also exclude blocked users
    blockedUsers.forEach(b => existingUserIds.add(b.blocked_id));

    let query = supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .neq('user_id', user.id)
      .order('full_name', { ascending: true })
      .range(currentPage * USERS_PER_PAGE, (currentPage + 1) * USERS_PER_PAGE - 1);

    if (searchQuery.trim()) {
      query = query.ilike('full_name', `%${searchQuery}%`);
    }

    const { data } = await query;

    const filteredResults = (data || []).filter(
      profile => !existingUserIds.has(profile.user_id)
    );

    if (isLoadMore) {
      setSearchResults(prev => [...prev, ...filteredResults]);
    } else {
      setSearchResults(filteredResults);
    }

    setHasMore((data?.length || 0) === USERS_PER_PAGE);
    if (!isLoadMore) setPage(0);
    setSearching(false);
  }, [user, searchQuery, friends, pendingRequests, blockedUsers, page]);

  // Initial search and search on query change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPage(0);
      searchUsers(false);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user, friends, pendingRequests, blockedUsers]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !searching) {
        setPage(prev => prev + 1);
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, searching]);

  // Load more when page changes
  useEffect(() => {
    if (page > 0) {
      searchUsers(true);
    }
  }, [page]);

  const handleSendRequest = async (userId: string) => {
    const { error } = await sendFriendRequest(userId);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send friend request'
      });
    } else {
      toast({
        title: 'Request Sent',
        description: 'Friend request sent successfully'
      });
      setSearchResults(prev => prev.filter(u => u.user_id !== userId));
    }
  };

  const handleAccept = async (requestId: string) => {
    const { error } = await acceptRequest(requestId);
    if (!error) {
      toast({ title: 'Friend Added', description: 'You are now friends!' });
    }
  };

  const handleReject = async (requestId: string) => {
    const { error } = await rejectRequest(requestId);
    if (!error) {
      toast({ title: 'Request Declined' });
    }
  };

  const handleBlock = async (userId: string, userName: string) => {
    const { error } = await blockUser(userId);
    if (!error) {
      toast({ 
        title: 'User Blocked', 
        description: `${userName || 'User'} has been blocked` 
      });
    }
  };

  const handleUnblock = async (blockId: string, userName: string) => {
    const { error } = await unblockUser(blockId);
    if (!error) {
      toast({ 
        title: 'User Unblocked', 
        description: `${userName || 'User'} has been unblocked` 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const incomingRequests = pendingRequests.filter(r => r.is_follower);

  return (
    <div className="space-y-6">
      {/* Current Friends - Always visible at top */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            My Friends ({friends.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No friends yet</p>
              <p className="text-sm">Search for users below to add friends</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {friends.map((friend, index) => (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                >
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    onClick={() => navigate(`/profile/${friend.user_id}`)}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {friend.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium truncate">{friend.full_name || 'Unknown User'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {onStartChat && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onStartChat(friend.user_id)}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => unfriend(friend.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Requests - Show if any */}
      {incomingRequests.length > 0 && (
        <Card className="border-border border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-warning" />
              Friend Requests
              <Badge variant="destructive">{incomingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomingRequests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={request.avatar_url || undefined} />
                    <AvatarFallback className="bg-accent/10 text-accent">
                      {request.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{request.full_name || 'Unknown User'}</p>
                    <p className="text-xs text-muted-foreground">Wants to be your friend</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleAccept(request.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleReject(request.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search & Blocked Users Tabs */}
      <Tabs defaultValue="search">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search">
            <Search className="w-4 h-4 mr-2" />
            Find Friends
          </TabsTrigger>
          <TabsTrigger value="blocked">
            <Ban className="w-4 h-4 mr-2" />
            Blocked ({blockedUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardDescription>Search for users to add as friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Start typing to find users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.map(resultUser => (
                    <div 
                      key={resultUser.user_id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div 
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate(`/profile/${resultUser.user_id}`)}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={resultUser.avatar_url || undefined} />
                          <AvatarFallback>{resultUser.full_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{resultUser.full_name || 'Unknown User'}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendRequest(resultUser.user_id);
                          }}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlock(resultUser.user_id, resultUser.full_name);
                          }}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {/* Infinite scroll trigger */}
                  <div ref={loadMoreRef} className="h-4" />
                  {searching && page > 0 && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!hasMore && searchResults.length > 0 && (
                    <p className="text-center text-sm text-muted-foreground py-2">No more users</p>
                  )}
                </div>
              )}
              
              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="mt-4">
          <Card className="border-border">
            <CardContent className="pt-6">
              {blockedUsers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <UserX className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No blocked users</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((blocked) => (
                    <div 
                      key={blocked.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={blocked.avatar_url || undefined} />
                          <AvatarFallback>{blocked.full_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{blocked.full_name || 'Unknown User'}</span>
                      </div>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnblock(blocked.id, blocked.full_name || 'User')}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
