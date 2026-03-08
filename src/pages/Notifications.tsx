import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  Heart,
  MessageCircle,
  AtSign,
  UserPlus,
  TrendingUp,
  CheckCheck,
  Trash2,
  Loader2,
  Filter,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const NOTIFICATION_TYPES: Record<string, { icon: typeof Heart; label: string; color: string }> = {
  trending_like: { icon: Heart, label: 'Likes', color: 'text-destructive' },
  trending_comment: { icon: MessageCircle, label: 'Comments', color: 'text-primary' },
  trending_mention: { icon: AtSign, label: 'Mentions', color: 'text-accent' },
  mention: { icon: AtSign, label: 'Mentions', color: 'text-accent' },
  friend_request: { icon: UserPlus, label: 'Friend Requests', color: 'text-success' },
  friend_accepted: { icon: UserPlus, label: 'Friends', color: 'text-success' },
  like: { icon: Heart, label: 'Likes', color: 'text-destructive' },
  comment: { icon: MessageCircle, label: 'Comments', color: 'text-primary' },
};

function getNotificationType(type: string) {
  return NOTIFICATION_TYPES[type] || { icon: Bell, label: 'Other', color: 'text-muted-foreground' };
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [filterType, setFilterType] = useState<string>('all');

  const filteredNotifications = filterType === 'all'
    ? notifications
    : notifications.filter(n => n.type === filterType || getNotificationType(n.type).label === filterType);

  // Get unique types for filter
  const uniqueTypes = Array.from(new Set(notifications.map(n => n.type)));

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // Navigate based on type
    if (notification.type.startsWith('trending_') && notification.reference_id) {
      navigate('/friends');
    } else if (notification.type === 'friend_request' || notification.type === 'friend_accepted') {
      navigate('/friends');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </Button>
          )}
        </motion.div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All notifications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notifications</SelectItem>
              {uniqueTypes.map(type => {
                const { label } = getNotificationType(type);
                return (
                  <SelectItem key={type} value={type}>{label}</SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {filterType === 'all' ? 'No notifications yet' : 'No notifications of this type'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification, index) => {
              const { icon: Icon, color } = getNotificationType(notification.type);
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={cn(
                      "border-border cursor-pointer hover:shadow-md transition-all",
                      !notification.is_read && "bg-primary/5 border-l-4 border-l-primary"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {notification.from_profile?.avatar_url ? (
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={notification.from_profile.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {notification.from_profile.full_name?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className={cn("p-2 rounded-full bg-muted shrink-0", color)}>
                            <Icon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", !notification.is_read && "font-medium")}>
                            {notification.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
