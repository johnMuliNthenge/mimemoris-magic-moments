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
  Settings
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
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalMemories: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
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
      
      // Fetch users created in date range
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59');

      // Fetch memories in date range
      const { count: memoriesCount } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59');

      // Fetch active subscriptions with plan info in date range
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(price_monthly)
        `)
        .eq('status', 'active')
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59');

      const activeCount = subscriptions?.length || 0;
      const revenue = subscriptions?.reduce((sum, sub) => {
        return sum + (sub.plan?.price_monthly || 0);
      }, 0) || 0;

      setStats({
        totalUsers: usersCount || 0,
        totalMemories: memoriesCount || 0,
        activeSubscriptions: activeCount,
        monthlyRevenue: revenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: t('total_users'), 
      value: stats.totalUsers, 
      icon: Users, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: '+12%'
    },
    { 
      label: t('total_memories'), 
      value: stats.totalMemories, 
      icon: BookHeart, 
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: '+8%'
    },
    { 
      label: t('active_subscriptions'), 
      value: stats.activeSubscriptions, 
      icon: CreditCard, 
      color: 'text-collab',
      bgColor: 'bg-collab/10',
      change: '+5%'
    },
    { 
      label: 'Monthly Revenue', 
      value: `$${stats.monthlyRevenue.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: '+15%'
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
              Manage users, subscriptions, and monitor app analytics
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
                        <TrendingUp className="w-4 h-4 text-success" />
                        <span className="text-sm text-success">{stat.change}</span>
                        <span className="text-xs text-muted-foreground">vs last month</span>
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
                Payments
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

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest actions across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: 'New user registered', user: 'john@example.com', time: '2 minutes ago', type: 'user' },
                  { action: 'Subscription upgraded to Premium', user: 'sarah@example.com', time: '15 minutes ago', type: 'subscription' },
                  { action: 'Memory created', user: 'mike@example.com', time: '1 hour ago', type: 'memory' },
                  { action: 'Collaboration started', user: 'anna@example.com', time: '2 hours ago', type: 'collab' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'user' ? 'bg-primary' :
                      activity.type === 'subscription' ? 'bg-collab' :
                      activity.type === 'memory' ? 'bg-accent' : 'bg-success'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
