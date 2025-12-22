import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  BookHeart, 
  Plus, 
  Calendar, 
  TrendingUp,
  Users,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, loading } = useSubscription();

  const stats = [
    { 
      label: 'Total Memories', 
      value: '24', 
      icon: BookHeart, 
      color: 'text-primary',
      bgColor: 'bg-primary/10' 
    },
    { 
      label: 'This Month', 
      value: subscription?.memories_used_this_month || 0, 
      icon: Calendar, 
      color: 'text-accent',
      bgColor: 'bg-accent/10' 
    },
    { 
      label: 'Collaborations', 
      value: '3', 
      icon: Users, 
      color: 'text-collab',
      bgColor: 'bg-collab/10' 
    },
    { 
      label: 'Memory Streak', 
      value: '7 days', 
      icon: TrendingUp, 
      color: 'text-success',
      bgColor: 'bg-success/10' 
    },
  ];

  const recentMemories = [
    { title: 'Beach sunset with family', date: 'Dec 20, 2024', type: 'photo', mood: '😊' },
    { title: 'Morning coffee thoughts', date: 'Dec 19, 2024', type: 'text', mood: '☕' },
    { title: 'Birthday celebration', date: 'Dec 15, 2024', type: 'video', mood: '🎉' },
  ];

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
          <Button 
            onClick={() => navigate('/memories/new')}
            className="gradient-warm text-primary-foreground gap-2 shadow-glow"
          >
            <Plus className="w-5 h-5" />
            {t('create_memory')}
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-border shadow-soft hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Subscription Progress */}
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
                    <CardTitle className="text-lg">Memory Usage</CardTitle>
                    <CardDescription>
                      {subscription.plan.name} - {t('memories_used', { 
                        used: subscription.memories_used_this_month, 
                        limit: subscription.plan.memory_limit 
                      })}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/subscription')}>
                    {t('upgrade_now')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={(subscription.memories_used_this_month / subscription.plan.memory_limit) * 100} 
                  className="h-3"
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

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
                {recentMemories.map((memory, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl">{memory.mood}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{memory.title}</p>
                      <p className="text-sm text-muted-foreground">{memory.date}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                      {memory.type}
                    </span>
                  </div>
                ))}
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate('/memories')}
                >
                  View all memories →
                </Button>
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
                  <p className="text-sm text-muted-foreground mb-3">Active collaborations</p>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-collab/10">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">JD</div>
                      <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">MK</div>
                      <div className="w-8 h-8 rounded-full bg-collab text-collab-foreground flex items-center justify-center text-xs font-medium">+2</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Family Reunion 2024</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        {t('live_now')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
