import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Globe, UsersRound } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLayout } from '@/components/layout/AppLayout';
import { FriendsList } from '@/components/social/FriendsList';
import { ChatWindow } from '@/components/social/ChatWindow';
import { PublicFeed } from '@/components/social/PublicFeed';
import { GroupChat } from '@/components/social/GroupChat';
import { CreateGroupDialog } from '@/components/social/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/social/JoinGroupDialog';

import { useChat } from '@/hooks/useChat';
import { useFriends } from '@/hooks/useFriends';
import { useGroupChat } from '@/hooks/useGroupChat';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function SocialPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedChatUser, setSelectedChatUser] = useState<{
    id: string;
    name?: string;
    avatar?: string;
  } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
  
  const { conversations } = useChat();
  const { friends, pendingRequests } = useFriends();
  const { groups } = useGroupChat();
  const { messages: unreadMessages, friendRequests: unreadFriendRequests } = useUnreadCounts();

  const chatUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0);
  const incomingRequests = pendingRequests.filter(r => r.is_follower).length;

  const handleStartChat = (userId: string) => {
    const friend = friends.find(f => f.user_id === userId);
    setSelectedChatUser({
      id: userId,
      name: friend?.full_name || undefined,
      avatar: friend?.avatar_url || undefined
    });
    setActiveTab('chat');
  };

  const selectConversation = (conv: any) => {
    setSelectedChatUser({
      id: conv.user_id,
      name: conv.full_name || undefined,
      avatar: conv.avatar_url || undefined
    });
  };

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="font-display text-3xl font-bold">{t('nav_friends')}</h1>
          <p className="text-muted-foreground">{t('friends_subtitle')}</p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="feed" className="gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="friends" className="gap-2 relative">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Friends</span>
              {incomingRequests > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs justify-center">
                  {incomingRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2 relative">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
              {chatUnread > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs justify-center">
                  {chatUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Groups</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <PublicFeed />
          </TabsContent>

          <TabsContent value="friends">
            <FriendsList onStartChat={handleStartChat} />
          </TabsContent>

          <TabsContent value="chat">
            <div className="grid md:grid-cols-3 gap-4 h-[600px]">
              {/* Conversations list */}
              <div className="md:col-span-1 border border-border rounded-lg overflow-hidden">
                <div className="p-3 border-b border-border bg-muted/30">
                  <h3 className="font-medium">Conversations</h3>
                </div>
                <ScrollArea className="h-[calc(100%-48px)]">
                  {conversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      <p>No conversations yet</p>
                      <p className="text-xs mt-1">Start chatting with friends</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {conversations.map(conv => (
                        <button
                          key={conv.user_id}
                          onClick={() => selectConversation(conv)}
                          className={cn(
                            "w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left",
                            selectedChatUser?.id === conv.user_id && "bg-muted"
                          )}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={conv.avatar_url || undefined} />
                            <AvatarFallback>
                              {conv.full_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {conv.full_name || 'Unknown'}
                            </p>
                            {conv.last_message && (
                              <p className="text-xs text-muted-foreground truncate">
                                {conv.last_message.content}
                              </p>
                            )}
                          </div>
                          {conv.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 w-5 p-0 justify-center">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Chat window or Call History */}
              <div className="md:col-span-2 border border-border rounded-lg overflow-hidden">
                <ChatWindow
                  selectedUserId={selectedChatUser?.id || null}
                  selectedUserName={selectedChatUser?.name}
                  selectedUserAvatar={selectedChatUser?.avatar}
                  onBack={() => setSelectedChatUser(null)}
                />
              </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="groups">
            <div className="grid md:grid-cols-3 gap-4 h-[600px]">
              {/* Groups list */}
              <div className="md:col-span-1 border border-border rounded-lg overflow-hidden flex flex-col">
                <div className="p-3 border-b border-border bg-muted/30">
                  <h3 className="font-medium">My Groups ({groups.length})</h3>
                </div>
                <div className="p-3 border-b border-border flex flex-col gap-2">
                  <CreateGroupDialog onGroupCreated={(id) => setSelectedGroupId(id)} />
                  <JoinGroupDialog onGroupJoined={(id) => setSelectedGroupId(id)} />
                </div>
                <ScrollArea className="flex-1">
                  {groups.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      <p>No groups yet</p>
                      <p className="text-xs mt-1">Create or join a group</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {groups.map(group => (
                        <button
                          key={group.id}
                          onClick={() => selectGroup(group.id)}
                          className={cn(
                            "w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left",
                            selectedGroupId === group.id && "bg-primary/10 border-l-2 border-primary"
                          )}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={group.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {group.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium truncate",
                              selectedGroupId === group.id && "text-primary"
                            )}>
                              {group.name}
                            </p>
                            {group.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {group.description}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Group chat window */}
              <div className="md:col-span-2 border border-border rounded-lg overflow-hidden">
                {selectedGroupId ? (
                  <GroupChat
                    groupId={selectedGroupId}
                    onBack={() => setSelectedGroupId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Select a group to start chatting</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
