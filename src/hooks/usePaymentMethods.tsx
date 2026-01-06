import { useState, useEffect, useCallback } from 'react';

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

  const checkPaymentMethods = useCallback(() => {
    try {
      // Check Stripe - pre-configured in this project
      const stripeConfigured = true;

      // Check PayPal configuration from localStorage (admin sets this)
      const paypalConfig = localStorage.getItem('paypal_config');
      let paypalConfigured = false;
      if (paypalConfig) {
        try {
          const parsed = JSON.parse(paypalConfig);
          paypalConfigured = parsed.isConfigured === true;
        } catch {
          paypalConfigured = false;
        }
      }

      // Check M-Pesa configuration from localStorage (admin sets this)
      const mpesaConfig = localStorage.getItem('mpesa_config');
      let mpesaConfigured = false;
      if (mpesaConfig) {
        try {
          const parsed = JSON.parse(mpesaConfig);
          mpesaConfigured = parsed.isConfigured === true;
        } catch {
          mpesaConfigured = false;
        }
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
    
    // Listen for storage changes (when admin updates config in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'paypal_config' || e.key === 'mpesa_config') {
        checkPaymentMethods();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkPaymentMethods]);

  return { configuredMethods, loading, refetch: checkPaymentMethods };
}
