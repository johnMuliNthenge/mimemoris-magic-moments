import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // Navigate to the relevant section based on type
    if (notification.type === 'trending_mention' || notification.type === 'whatup_mention') {
      navigate('/friends');
    }
    setOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trending_mention':
      case 'whatup_mention':
        return '💬';
      case 'like':
        return '❤️';
      case 'comment':
        return '💭';
      case 'follow':
        return '👤';
      case 'trending_like':
        return '❤️';
      case 'trending_comment':
        return '💬';
      default:
        return '🔔';
    }
  };

  const getNotificationContent = (notification: any) => {
    // Show just the action part, since the name is shown separately
    const content = notification.content as string;
    const fromName = notification.from_profile?.full_name;
    if (fromName && content.startsWith(fromName)) {
      return content.slice(fromName.length).trim();
    }
    return content;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                    !notification.is_read && "bg-primary/5"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={notification.from_profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {notification.from_profile?.full_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 text-xs">
                      {getNotificationIcon(notification.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">
                        {notification.from_profile?.full_name || 'Someone'}
                      </span>{' '}
                      <span className="text-muted-foreground">{getNotificationContent(notification)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
