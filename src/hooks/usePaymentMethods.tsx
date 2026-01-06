import { useState, useEffect } from 'react';
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

  useEffect(() => {
    checkPaymentMethods();
  }, []);

  const checkPaymentMethods = async () => {
    try {
      // Check Stripe - we can assume it's configured if the project has Stripe secret
      // For now, we'll check via an edge function or assume it's available
      const stripeConfigured = true; // Stripe is pre-configured in this project

      // Check PayPal configuration from localStorage (admin sets this)
      const paypalConfig = localStorage.getItem('paypal_config');
      const paypalConfigured = paypalConfig ? JSON.parse(paypalConfig).isConfigured : false;

      // Check M-Pesa configuration from localStorage (admin sets this)
      const mpesaConfig = localStorage.getItem('mpesa_config');
      const mpesaConfigured = mpesaConfig ? JSON.parse(mpesaConfig).isConfigured : false;

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
  };

  return { configuredMethods, loading, refetch: checkPaymentMethods };
}
