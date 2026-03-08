import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentMethodsConfig {
  stripe: boolean;
  paypal: boolean;
  mpesa: boolean;
}

export function usePaymentMethods() {
  const [configuredMethods, setConfiguredMethods] = useState<PaymentMethodsConfig>({
    stripe: false,
    paypal: false,
    mpesa: false,
  });
  const [loading, setLoading] = useState(true);

  const checkPaymentMethods = useCallback(async () => {
    try {
      // Stripe is always configured
      const stripeConfigured = true;

      // Check PayPal from localStorage
      const paypalConfig = localStorage.getItem('paypal_config');
      let paypalConfigured = false;
      if (paypalConfig) {
        try {
          paypalConfigured = JSON.parse(paypalConfig).isConfigured === true;
        } catch { paypalConfigured = false; }
      }

      // Check M-Pesa availability via restricted RPC (no credential exposure)
      let mpesaConfigured = false;
      const { data: mpesaStatusRows, error: mpesaStatusError } = await (supabase as any)
        .rpc('get_mpesa_public_status');

      if (!mpesaStatusError && Array.isArray(mpesaStatusRows)) {
        mpesaConfigured = mpesaStatusRows.some((row: { is_active?: boolean }) => row?.is_active === true);
      }

      setConfiguredMethods({
        stripe: stripeConfigured,
        paypal: paypalConfigured,
        mpesa: mpesaConfigured,
      });
    } catch (error) {
      console.error('Error checking payment methods:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPaymentMethods();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'paypal_config') {
        checkPaymentMethods();
      }
    };
    
    const handlePaymentConfigUpdated = () => {
      checkPaymentMethods();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('paymentConfigUpdated', handlePaymentConfigUpdated);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('paymentConfigUpdated', handlePaymentConfigUpdated);
    };
  }, [checkPaymentMethods]);

  return { configuredMethods, loading, refetch: checkPaymentMethods };
}
