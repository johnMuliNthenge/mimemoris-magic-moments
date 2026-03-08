import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { subDays, format } from 'date-fns';
import { 
  Users, 
  BookHeart, 
  CreditCard, 
  TrendingUp,
  DollarSign,
  Activity,
  Settings,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminPlans } from '@/components/admin/AdminPlans';
import { AdminStripeSetup } from '@/components/admin/AdminStripeSetup';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  totalUsers: number;
  totalMemories: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  prevUsers: number;
  prevMemories: number;
  prevSubscriptions: number;
  prevRevenue: number;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalMemories: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    prevUsers: 0,
    prevMemories: 0,
    prevSubscriptions: 0,
    prevRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  useEffect(() => {
    fetchStats(dateRange.start, dateRange.end);
  }, [dateRange]);

  const handleDateChange = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
  };

  const fetchStats = async (startDate: Date, endDate: Date) => {
    setLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevStart = format(subDays(startDate, rangeDays), 'yyyy-MM-dd');
      const prevEnd = format(subDays(startDate, 1), 'yyyy-MM-dd');
      
      // Current period
      const [{ count: usersCount }, { count: memoriesCount }, { data: subscriptions }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', startStr).lte('created_at', endStr + 'T23:59:59'),
        supabase.from('memories').select('*', { count: 'exact', head: true })
          .gte('created_at', startStr).lte('created_at', endStr + 'T23:59:59'),
        supabase.from('user_subscriptions').select('*, plan:subscription_plans(price_monthly)')
          .eq('status', 'active').gte('created_at', startStr).lte('created_at', endStr + 'T23:59:59'),
      ]);

      // Previous period
      const [{ count: prevUsersCount }, { count: prevMemoriesCount }, { data: prevSubs }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', prevStart).lte('created_at', prevEnd + 'T23:59:59'),
        supabase.from('memories').select('*', { count: 'exact', head: true })
          .gte('created_at', prevStart).lte('created_at', prevEnd + 'T23:59:59'),
        supabase.from('user_subscriptions').select('*, plan:subscription_plans(price_monthly)')
          .eq('status', 'active').gte('created_at', prevStart).lte('created_at', prevEnd + 'T23:59:59'),
      ]);

      const revenue = subscriptions?.reduce((sum, sub) => sum + ((sub.plan as any)?.price_monthly || 0), 0) || 0;
      const prevRevenue = prevSubs?.reduce((sum, sub) => sum + ((sub.plan as any)?.price_monthly || 0), 0) || 0;

      setStats({
        totalUsers: usersCount || 0,
        totalMemories: memoriesCount || 0,
        activeSubscriptions: subscriptions?.length || 0,
        monthlyRevenue: revenue,
        prevUsers: prevUsersCount || 0,
        prevMemories: prevMemoriesCount || 0,
        prevSubscriptions: prevSubs?.length || 0,
        prevRevenue: prevRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '0%';
    const pct = Math.round(((curr - prev) / prev) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const statCards = [
    { 
      label: t('total_users'), 
      value: stats.totalUsers, 
      icon: Users, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: calcChange(stats.totalUsers, stats.prevUsers),
      positive: stats.totalUsers >= stats.prevUsers,
    },
    { 
      label: t('total_memories'), 
      value: stats.totalMemories, 
      icon: BookHeart, 
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: calcChange(stats.totalMemories, stats.prevMemories),
      positive: stats.totalMemories >= stats.prevMemories,
    },
    { 
      label: t('active_subscriptions'), 
      value: stats.activeSubscriptions, 
      icon: CreditCard, 
      color: 'text-collab',
      bgColor: 'bg-collab/10',
      change: calcChange(stats.activeSubscriptions, stats.prevSubscriptions),
      positive: stats.activeSubscriptions >= stats.prevSubscriptions,
    },
    { 
      label: t('monthly_revenue'), 
      value: `$${stats.monthlyRevenue.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: calcChange(stats.monthlyRevenue, stats.prevRevenue),
      positive: stats.monthlyRevenue >= stats.prevRevenue,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{t('admin_dashboard')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('admin_desc')}
            </p>
          </div>
          <DateRangeFilter onDateChange={handleDateChange} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
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
                      <p className="text-3xl font-bold mt-2">{stat.value}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <TrendingUp className={`w-4 h-4 ${stat.positive ? 'text-success' : 'text-destructive rotate-180'}`} />
                        <span className={`text-sm ${stat.positive ? 'text-success' : 'text-destructive'}`}>{stat.change}</span>
                        <span className="text-xs text-muted-foreground">{t('vs_last_month')}</span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs for Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                {t('manage_users')}
              </TabsTrigger>
              <TabsTrigger value="plans" className="gap-2">
                <CreditCard className="w-4 h-4" />
                {t('manage_plans')}
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-2">
                <Settings className="w-4 h-4" />
                {t('payments')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <AdminUsers />
            </TabsContent>

            <TabsContent value="plans">
              <AdminPlans />
            </TabsContent>

            <TabsContent value="payments">
              <AdminStripeSetup />
            </TabsContent>
          </Tabs>
        </motion.div>

        <RecentActivityFeed />
      </div>
    </AdminLayout>
  );
}

function RecentActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const fetchRecentActivity = async () => {
    try {
      // Fetch recent memories
      const { data: recentMemories } = await supabase
        .from('memories')
        .select('id, user_id, memory_type, created_at, title')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent subscriptions  
      const { data: recentSubs } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, created_at, plan:subscription_plans(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent collaborations
      const { data: recentCollabs } = await supabase
        .from('collaboration_sessions')
        .select('id, host_user_id, created_at, title')
        .order('created_at', { ascending: false })
        .limit(3);

      const items: any[] = [];

      recentMemories?.forEach(m => items.push({
        action: `Memory created: ${m.title || m.memory_type}`,
        time: m.created_at,
        type: 'memory',
      }));

      recentSubs?.forEach(s => items.push({
        action: `Subscription: ${(s.plan as any)?.name || 'Plan'}`,
        time: s.created_at,
        type: 'subscription',
      }));

      recentCollabs?.forEach(c => items.push({
        action: `Collaboration: ${c.title || 'Session'}`,
        time: c.created_at,
        type: 'collab',
      }));

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivities(items.slice(0, 8));
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            {t('recent_activity')}
          </CardTitle>
          <CardDescription>{t('latest_actions')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{t('no_recent_activity')}</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'memory' ? 'bg-accent' :
                    activity.type === 'subscription' ? 'bg-collab' : 'bg-success'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(activity.time), 'MMM d, HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
