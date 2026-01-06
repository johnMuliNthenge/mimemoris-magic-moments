import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { 
  BookHeart, 
  Plus, 
  Calendar, 
  TrendingUp,
  Users,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { MemoryQuery } from '@/components/memory/MemoryQuery';
import { SubscriptionStatusCard } from '@/components/dashboard/SubscriptionStatusCard';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Memory {
  id: string;
  memory_type: 'text' | 'audio' | 'video' | 'photo';
  memory_date: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [collaborationsCount, setCollaborationsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    // Fetch memories
    const { data: memoriesData } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', user?.id)
      .order('memory_date', { ascending: false });

    if (memoriesData) {
      setMemories(memoriesData as Memory[]);
    }

    // Fetch collaborations count
    const { data: hostCollabs } = await supabase
      .from('collaboration_sessions')
      .select('id')
      .eq('host_user_id', user?.id);

    const { data: participantCollabs } = await supabase
      .from('collaboration_participants')
      .select('collaboration_id')
      .eq('user_id', user?.id);

    const hostCount = hostCollabs?.length || 0;
    const participantCount = participantCollabs?.length || 0;
    // Dedupe if user is both host and participant
    const uniqueCollabIds = new Set([
      ...(hostCollabs?.map(c => c.id) || []),
      ...(participantCollabs?.map(p => p.collaboration_id) || [])
    ]);
    setCollaborationsCount(uniqueCollabIds.size);

    setLoading(false);
  };

  // Calculate streak
  const calculateStreak = () => {
    if (memories.length === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const memoryDates = [...new Set(memories.map(m => m.memory_date))].sort().reverse();
    let streak = 0;
    let currentDate = today;

    for (const dateStr of memoryDates) {
      const memDate = new Date(dateStr);
      memDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((currentDate.getTime() - memDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        streak++;
        currentDate = memDate;
      } else {
        break;
      }
    }
    return streak;
  };

  const stats = [
    { 
      label: 'Total Memories', 
      value: memories.length, 
      icon: BookHeart, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/memories/list',
      clickable: true
    },
    { 
      label: 'Today', 
      value: subscription?.memories_used_today || 0, 
      icon: Calendar, 
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      href: '/memories/list',
      clickable: true
    },
    { 
      label: 'Collaborations', 
      value: collaborationsCount, 
      icon: Users, 
      color: 'text-collab',
      bgColor: 'bg-collab/10',
      href: '/collaborations',
      clickable: true
    },
    { 
      label: 'Memory Streak', 
      value: `${calculateStreak()} days`, 
      icon: TrendingUp, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      clickable: false
    },
  ];

  const recentMemories = memories.slice(0, 3);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Welcome back! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Ready to capture today's memories?
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate('/friends')}
              className="gap-2"
            >
              <Users className="w-5 h-5" />
              {t('nav_friends')}
            </Button>
            <Button 
              onClick={() => navigate('/memories/new')}
              className="gradient-warm text-primary-foreground gap-2 shadow-glow"
            >
              <Plus className="w-5 h-5" />
              {t('create_memory')}
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid - Clickable */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={cn(
                  "border-border shadow-soft transition-all",
                  stat.clickable && "cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary/30"
                )}
                onClick={() => stat.clickable && stat.href && navigate(stat.href)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className={cn(
                        "text-2xl font-bold mt-1",
                        stat.clickable && "text-primary underline-offset-2 hover:underline"
                      )}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                  {stat.clickable && (
                    <p className="text-xs text-muted-foreground mt-2">Click to view →</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Subscription Status Card */}
        <SubscriptionStatusCard />

        {/* Daily Memory Usage Progress */}
        {subscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-border shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Daily Memory Usage</CardTitle>
                    <CardDescription>
                      {subscription.plan.name} - {subscription.memories_used_today}/{subscription.plan.daily_memory_limit} memories used today
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/subscription')}>
                    {t('upgrade_now')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={(subscription.memories_used_today / subscription.plan.daily_memory_limit) * 100} 
                  className="h-3"
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Memory Query */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <MemoryQuery onMemoryFound={(memory) => navigate(`/memories/${memory.id}/edit`)} />
        </motion.div>

        {/* Recent Memories */}
        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-border shadow-soft h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Recent Memories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentMemories.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No memories yet</p>
                    <Button 
                      variant="link" 
                      onClick={() => navigate('/memories/new')}
                      className="mt-2"
                    >
                      Create your first memory
                    </Button>
                  </div>
                ) : (
                  <>
                    {recentMemories.map((memory) => (
                      <div 
                        key={memory.id}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/memories/${memory.id}/edit`)}
                      >
                        <div className="text-2xl">{memory.mood || '📝'}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{memory.title || 'Untitled Memory'}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(memory.memory_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                          {memory.memory_type}
                        </span>
                      </div>
                    ))}
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => navigate('/memories/list')}
                    >
                      View all memories →
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-border shadow-soft h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-collab" />
                  {t('nav_collaborate')}
                </CardTitle>
                <CardDescription>
                  Create shared memories with friends and family
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full gradient-collab text-collab-foreground"
                  onClick={() => navigate('/collaborate')}
                >
                  {t('start_collaboration')}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/collaborate?join=true')}
                >
                  {t('join_collaboration')}
                </Button>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Your collaborations</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0"
                      onClick={() => navigate('/collaborations')}
                    >
                      View all →
                    </Button>
                  </div>
                  {collaborationsCount > 0 ? (
                    <div 
                      className="flex items-center gap-2 p-3 rounded-lg bg-collab/10 cursor-pointer hover:bg-collab/20 transition-colors"
                      onClick={() => navigate('/collaborations')}
                    >
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                          {collaborationsCount}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{collaborationsCount} collaboration{collaborationsCount !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-muted-foreground">Click to view details</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      No collaborations yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
