import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChatWindowProps {
  selectedUserId: string | null;
  selectedUserName?: string;
  selectedUserAvatar?: string;
  onBack?: () => void;
}

export function ChatWindow({ 
  selectedUserId, 
  selectedUserName, 
  selectedUserAvatar,
  onBack 
}: ChatWindowProps) {
  const { user } = useAuth();
  const { messages, sendMessage, loading } = useChat(selectedUserId || undefined);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUserId) return;
    
    setSending(true);
    await sendMessage(selectedUserId, newMessage.trim());
    setNewMessage('');
    setSending(false);
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
          <AvatarFallback className="bg-primary/10 text-primary">
            {selectedUserName?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{selectedUserName || 'Unknown User'}</p>
          <p className="text-xs text-muted-foreground">Online</p>
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
            messages.map((msg, index) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    "flex",
                    isOwn ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2",
                    isOwn 
                      ? "bg-primary text-primary-foreground rounded-br-sm" 
                      : "bg-muted rounded-bl-sm"
                  )}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

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
