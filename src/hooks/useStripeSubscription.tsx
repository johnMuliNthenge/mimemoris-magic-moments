import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface StripeSubscription {
  subscribed: boolean;
  product_id: string | null;
  price_id: string | null;
  tier: 'basic' | 'standard' | 'premium' | null;
  subscription_end: string | null;
}

export function useStripeSubscription() {
  const { user } = useAuth();
  const [stripeSubscription, setStripeSubscription] = useState<StripeSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStripeSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');
      
      if (fnError) {
        throw new Error(fnError.message);
      }

      setStripeSubscription(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check subscription';
      setError(message);
      console.error('Error checking subscription:', message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Refresh every minute
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const createCheckout = async (priceId: string) => {
    if (!user) throw new Error('User must be logged in');

    const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
      body: { priceId },
    });

    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    
    return data.url;
  };

  const openCustomerPortal = async () => {
    if (!user) throw new Error('User must be logged in');

    const { data, error: fnError } = await supabase.functions.invoke('customer-portal');

    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    
    return data.url;
  };

  return {
    stripeSubscription,
    loading,
    error,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
