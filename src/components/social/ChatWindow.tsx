import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  Send,
  ArrowLeft,
  Loader2,
  Edit2,
  Trash2,
  X,
  Reply,
  Check,
  CheckCheck,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  Clock3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useGlobalWebRTC } from '@/hooks/useGlobalWebRTC';
import { useCallHistory } from '@/hooks/useCallHistory';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { CallStatus } from '@/hooks/useWebRTC';

interface ChatWindowProps {
  selectedUserId: string | null;
  selectedUserName?: string;
  selectedUserAvatar?: string;
  onBack?: () => void;
}

interface MessageBubbleProps {
  msg: any;
  isOwn: boolean;
  canEdit: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReply: (msg: any) => void;
  index: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function MessageBubble({ msg, isOwn, canEdit, onEdit, onDelete, onReply, index }: MessageBubbleProps) {
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
        className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
      >
        <div className="max-w-[70%] rounded-2xl px-4 py-2 bg-muted/50 italic text-muted-foreground text-sm">
          Message deleted
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      {/* Reply indicator */}
      <motion.div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary',
          isOwn ? 'right-full mr-2' : 'left-0'
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
        className={cn('flex cursor-grab active:cursor-grabbing', isOwn ? 'justify-end' : 'justify-start')}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="relative group">
          {/* Reply reference */}
          {msg.reply_to && (
            <div
              className={cn(
                'mb-1 px-3 py-1 rounded-lg text-xs border-l-2',
                isOwn ? 'bg-primary/20 border-primary-foreground/50' : 'bg-muted/80 border-primary'
              )}
            >
              <p className="text-muted-foreground truncate max-w-[200px]">{msg.reply_to.content}</p>
            </div>
          )}

          <div
            className={cn(
              'max-w-[70%] rounded-2xl px-4 py-2',
              isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
            )}
          >
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
                <div
                  className={cn(
                    'flex items-center gap-1 mt-1',
                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  <span className="text-xs">{format(new Date(msg.created_at), 'HH:mm')}</span>
                  {msg.edited_at && <span className="text-xs italic">(edited)</span>}
                  {/* Read receipt ticks for own messages */}
                  {isOwn && (
                    msg.is_read ? (
                      <CheckCheck className="w-3.5 h-3.5 ml-1 text-blue-300" />
                    ) : (
                      <Check className="w-3.5 h-3.5 ml-1" />
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          {isOwn && showActions && !isEditing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -top-8 right-0 flex items-center gap-1 bg-background border border-border rounded-lg p-1 shadow-lg"
            >
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditing(true)}>
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
      </motion.div>
    </div>
  );
}

export function ChatWindow({ selectedUserId, selectedUserName, selectedUserAvatar, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const [showCallHistory, setShowCallHistory] = useState(false);
  const { messages, sendMessage, editMessage, deleteMessage, canEditMessage, loading, isPartnerTyping, sendTypingIndicator } = useChat(
    selectedUserId || undefined
  );
  const { history: callHistory, loading: callHistoryLoading, refetch: refetchCallHistory } = useCallHistory(
    selectedUserId || undefined
  );
  const {
    callState,
    initiateCall,
  } = useGlobalWebRTC();

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousCallStatusRef = useRef<CallStatus>('idle');
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (previousCallStatusRef.current !== 'idle' && callState.status === 'idle') {
      void refetchCallHistory();
    }
    previousCallStatusRef.current = callState.status;
  }, [callState.status, refetchCallHistory]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    // Debounced typing indicator
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      sendTypingIndicator();
    }, 300);
  }, [sendTypingIndicator]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUserId) return;

    setSending(true);
    await sendMessage(selectedUserId, newMessage.trim(), replyTo?.id);
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

  if (!selectedUserId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="w-10 h-10">
          <AvatarImage src={selectedUserAvatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">{selectedUserName?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{selectedUserName || 'Unknown User'}</p>
          {isPartnerTyping ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-primary font-medium"
            >
              typing...
            </motion.p>
          ) : (
            <p className="text-xs text-muted-foreground">Online</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground hover:text-primary", showCallHistory && "text-primary bg-primary/10")}
            onClick={() => setShowCallHistory(!showCallHistory)}
            title="Call history"
          >
            <Clock3 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
            onClick={() => initiateCall(selectedUserId, 'audio', selectedUserName, selectedUserAvatar)}
            title="Audio call"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
            onClick={() => initiateCall(selectedUserId, 'video', selectedUserName, selectedUserAvatar)}
            title="Video call"
          >
            <Video className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Call History (toggleable) */}
      {showCallHistory && (
        <div className="px-4 py-2 border-b border-border bg-muted/20 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground mb-2">Call history with {selectedUserName || 'this user'}</p>

          {callHistoryLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </div>
          ) : callHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No calls yet with this user.</p>
          ) : (
            <div className="space-y-1">
              {callHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md bg-background px-2.5 py-1.5 border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.direction === 'incoming' ? (
                      <PhoneIncoming className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <PhoneOutgoing className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <p className="text-xs truncate">
                      <span className="font-medium capitalize">{entry.call_type}</span>
                      <span className="text-muted-foreground"> · {entry.direction}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'text-[11px] font-medium capitalize',
                        entry.status === 'completed' || entry.status === 'connected'
                          ? 'text-success'
                          : entry.status === 'ringing'
                            ? 'text-warning'
                            : 'text-destructive'
                      )}
                    >
                      {entry.status}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      {entry.duration_seconds > 0
                        ? formatDuration(entry.duration_seconds)
                        : format(new Date(entry.started_at), 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              <MessageBubble
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
          {/* Typing indicator in message area */}
          {isPartnerTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Reply className="w-4 h-4 text-primary" />
            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{replyTo.content}</p>
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
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
