import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Send, ArrowLeft, Loader2, Edit2, Trash2, X, Reply, Check, Users, Settings, Link, QrCode, UserPlus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useGroupChat } from '@/hooks/useGroupChat';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

interface GroupChatProps {
  groupId: string;
  onBack?: () => void;
}

interface GroupMessageBubbleProps {
  msg: any;
  isOwn: boolean;
  canEdit: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReply: (msg: any) => void;
  index: number;
}

function GroupMessageBubble({ msg, isOwn, canEdit, onEdit, onDelete, onReply, index }: GroupMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);
  const [showActions, setShowActions] = useState(false);
  const x = useMotionValue(0);
  const dragThreshold = 60;
  
  const replyOpacity = useTransform(x, [0, dragThreshold], [0, 1]);
  const replyScale = useTransform(x, [0, dragThreshold], [0.5, 1]);

  const handleDragEnd = () => {
    if (x.get() > dragThreshold) {
      onReply(msg);
    }
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== msg.content) {
      onEdit(msg.id, editContent.trim());
    }
    setIsEditing(false);
  };

  if (msg.is_deleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex", isOwn ? "justify-end" : "justify-start")}
      >
        <div className="max-w-[70%] rounded-2xl px-4 py-2 bg-muted/50 italic text-muted-foreground text-sm">
          Message deleted
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      <motion.div 
        className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary",
          isOwn ? "right-full mr-2" : "left-0"
        )}
        style={{ opacity: replyOpacity, scale: replyScale }}
      >
        <Reply className="w-4 h-4" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        drag="x"
        dragConstraints={{ left: 0, right: dragThreshold + 20 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn("flex cursor-grab active:cursor-grabbing", isOwn ? "justify-end" : "justify-start")}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="relative group flex gap-2">
          {!isOwn && (
            <Avatar className="w-8 h-8 mt-auto">
              <AvatarImage src={msg.sender_profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {msg.sender_profile?.full_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
          )}

          <div>
            {!isOwn && (
              <p className="text-xs text-muted-foreground mb-1 ml-1">
                {msg.sender_profile?.full_name || 'Unknown'}
              </p>
            )}

            {msg.reply_to && (
              <div className={cn(
                "mb-1 px-3 py-1 rounded-lg text-xs border-l-2",
                isOwn ? "bg-primary/20 border-primary-foreground/50" : "bg-muted/80 border-primary"
              )}>
                <p className="text-muted-foreground truncate max-w-[200px]">
                  {msg.reply_to.content}
                </p>
              </div>
            )}

            <div className={cn(
              "max-w-[280px] rounded-2xl px-4 py-2",
              isOwn 
                ? "bg-primary text-primary-foreground rounded-br-sm" 
                : "bg-muted rounded-bl-sm"
            )}>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="h-8 text-sm bg-background/20"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditing(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm">{msg.content}</p>
                  <div className={cn(
                    "flex items-center gap-1 mt-1",
                    isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    <span className="text-xs">{format(new Date(msg.created_at), 'HH:mm')}</span>
                    {msg.edited_at && <span className="text-xs italic">(edited)</span>}
                  </div>
                </>
              )}
            </div>

            {isOwn && showActions && !isEditing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-8 right-0 flex items-center gap-1 bg-background border border-border rounded-lg p-1 shadow-lg"
              >
                {canEdit && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => onDelete(msg.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function GroupChat({ groupId, onBack }: GroupChatProps) {
  const { user } = useAuth();
  const { 
    messages, 
    members, 
    currentGroup, 
    sendMessage, 
    editMessage, 
    deleteMessage, 
    canEditMessage, 
    isAdmin, 
    leaveGroup,
    removeMember,
    loading 
  } = useGroupChat(groupId);
  
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showQR, setShowQR] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    await sendMessage(newMessage.trim(), replyTo?.id);
    setNewMessage('');
    setReplyTo(null);
    setSending(false);
  };

  const handleEdit = async (messageId: string, content: string) => {
    const { error } = await editMessage(messageId, content);
    if (error) {
      toast.error('Could not edit message. Time limit may have expired.');
    }
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await deleteMessage(messageId);
    if (error) {
      toast.error('Could not delete message');
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join-group/${currentGroup?.invite_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  const handleLeaveGroup = async () => {
    const { error } = await leaveGroup();
    if (error) {
      toast.error(error);
    } else {
      toast.success('Left group');
      onBack?.();
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const { error } = await removeMember(userId);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Member removed');
    }
  };

  if (!currentGroup) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentGroup.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {currentGroup.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{currentGroup.name}</p>
            <p className="text-xs text-muted-foreground">{members.length} members</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Invite options */}
          <Dialog open={showQR} onOpenChange={setShowQR}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <QrCode className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite to {currentGroup.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCode 
                    value={`${window.location.origin}/join-group/${currentGroup.invite_code}`}
                    size={200}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to join the group
                </p>
                <Button onClick={handleCopyLink} className="gap-2">
                  <Link className="w-4 h-4" />
                  Copy Invite Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Members sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Users className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Group Members ({members.length}/500)</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {member.profile?.full_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {member.profile?.full_name || 'Unknown'}
                            {member.user_id === user?.id && ' (You)'}
                          </p>
                          {member.role === 'admin' && (
                            <Badge variant="secondary" className="text-xs">Admin</Badge>
                          )}
                        </div>
                      </div>
                      {isAdmin() && member.user_id !== user?.id && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="pt-4 border-t mt-4">
                <Button 
                  variant="destructive" 
                  className="w-full gap-2"
                  onClick={handleLeaveGroup}
                >
                  <LogOut className="w-4 h-4" />
                  Leave Group
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <GroupMessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_id === user?.id}
                canEdit={canEditMessage(msg)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReply={setReplyTo}
                index={index}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Reply className="w-4 h-4 text-primary" />
            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
              {replyTo.content}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
