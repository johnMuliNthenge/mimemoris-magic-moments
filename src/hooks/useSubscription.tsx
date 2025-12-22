import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionPlan {
  id: string;
  tier: 'basic' | 'standard' | 'premium';
  name: string;
  price_monthly: number;
  memory_limit: number;
  languages_limited: boolean;
  features: string[];
  is_active: boolean;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  memories_used_this_month: number;
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
    return subscription.memories_used_this_month < subscription.plan.memory_limit;
  };

  const remainingMemories = () => {
    if (!subscription) return 0;
    return subscription.plan.memory_limit - subscription.memories_used_this_month;
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
