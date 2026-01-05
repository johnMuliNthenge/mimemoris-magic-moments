import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  MessageCircle,
  Loader2,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FriendsListProps {
  onStartChat?: (userId: string) => void;
}

export function FriendsList({ onStartChat }: FriendsListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { friends, pendingRequests, loading, acceptRequest, rejectRequest, unfriend, sendFriendRequest } = useFriends();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Real-time search as user types
  useEffect(() => {
    const searchUsers = async () => {
      if (!user) return;
      
      setSearching(true);

      // Get existing friend/pending user IDs to exclude
      const existingUserIds = new Set<string>();
      existingUserIds.add(user.id); // Exclude current user
      friends.forEach(f => existingUserIds.add(f.user_id));
      pendingRequests.forEach(p => existingUserIds.add(p.user_id));

      let query = supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .neq('user_id', user.id);

      // If there's a search query, filter by name
      if (searchQuery.trim()) {
        query = query.ilike('full_name', `%${searchQuery}%`);
      }

      const { data } = await query.limit(20);

      // Filter out current user, friends, and pending requests
      const filteredResults = (data || []).filter(
        profile => !existingUserIds.has(profile.user_id)
      );

      setSearchResults(filteredResults);
      setSearching(false);
    };

    // Debounce search
    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user, friends, pendingRequests]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Users */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Find Friends
          </CardTitle>
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
            <div className="space-y-2">
              {searchResults.map(user => (
                <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{user.full_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.full_name || 'Unknown User'}</span>
                  </div>
                  <Button size="sm" onClick={() => handleSendRequest(user.user_id)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="friends">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="friends">
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests 
            {pendingRequests.filter(r => r.is_follower).length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingRequests.filter(r => r.is_follower).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4 space-y-3">
          {friends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No friends yet</p>
              <p className="text-sm">Search for users to add as friends</p>
            </div>
          ) : (
            friends.map((friend, index) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {friend.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{friend.full_name || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">Friend</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {onStartChat && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onStartChat(friend.user_id)}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => unfriend(friend.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-3">
          {pendingRequests.filter(r => r.is_follower).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No pending requests</p>
            </div>
          ) : (
            pendingRequests.filter(r => r.is_follower).map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={request.avatar_url || undefined} />
                    <AvatarFallback className="bg-accent/10 text-accent">
                      {request.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{request.full_name || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">Wants to be your friend</p>
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
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
