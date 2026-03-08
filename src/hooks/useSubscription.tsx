import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SubscriptionPlan {
  id: string;
  tier: 'basic' | 'standard' | 'premium';
  name: string;
  price_monthly: number;
  daily_memory_limit: number;
  languages_limited: boolean;
  features: string[];
  is_active: boolean;
  stripe_price_id?: string;
  stripe_product_id?: string;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  memories_used_today: number;
  last_memory_date: string;
  plan: SubscriptionPlan;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (data) {
      setPlans(data.map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as string || '[]')
      })) as SubscriptionPlan[]);
    }
  };

  const fetchSubscription = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      // Check if we need to reset daily count (new day)
      const today = new Date().toISOString().split('T')[0];
      const lastDate = data.last_memory_date;
      
      if (lastDate !== today) {
        // Reset daily count for new day using secure RPC
        await supabase.rpc('reset_daily_memory_count', { _subscription_id: data.id });
        
        data.memories_used_today = 0;
        data.last_memory_date = today;
      }

      setSubscription({
        ...data,
        plan: {
          ...data.plan,
          features: Array.isArray(data.plan.features) ? data.plan.features : JSON.parse(data.plan.features as string || '[]')
        }
      } as UserSubscription);
    }
    setLoading(false);
  };

  const canCreateMemory = () => {
    if (!subscription) return false;
    return subscription.memories_used_today < subscription.plan.daily_memory_limit;
  };

  const remainingMemories = () => {
    if (!subscription) return 0;
    return subscription.plan.daily_memory_limit - subscription.memories_used_today;
  };

  return {
    subscription,
    plans,
    loading,
    canCreateMemory,
    remainingMemories,
    refetch: fetchSubscription,
  };
}
