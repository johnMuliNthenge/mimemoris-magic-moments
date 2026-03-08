import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Loader2, CreditCard, ExternalLink, Smartphone, Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, SubscriptionPlan } from '@/hooks/useSubscription';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { StripeTier } from '@/lib/stripe-config';
import { PaymentMethodDialog } from '@/components/subscription/PaymentMethodDialog';
import { supabase } from '@/integrations/supabase/client';

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { plans, loading: plansLoading, refetch: refetchSubscription } = useSubscription();
  const { 
    stripeSubscription, 
    loading: stripeLoading, 
    createCheckout, 
    openCustomerPortal,
    checkSubscription 
  } = useStripeSubscription();
  const { configuredMethods, refetch: refetchPaymentMethods } = usePaymentMethods();
  const { toast } = useToast();
  const [processingMethod, setProcessingMethod] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  // M-Pesa state
  const [showMpesaDialog, setShowMpesaDialog] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [mpesaPolling, setMpesaPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon_id: string;
    code: string;
    discount_percentage: number;
  } | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({ title: 'Payment Successful!', description: 'Your subscription has been activated.' });
      checkSubscription();
      navigate('/subscription', { replace: true });
    } else if (searchParams.get('canceled') === 'true') {
      toast({ variant: 'destructive', title: 'Payment Canceled', description: 'You can try again when ready.' });
      navigate('/subscription', { replace: true });
    }
  }, [searchParams, toast, navigate, checkSubscription]);

  const handleOpenPaymentDialog = (plan: SubscriptionPlan) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Login Required', description: 'Please log in to subscribe.' });
      return;
    }
    refetchPaymentMethods();
    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase.rpc('validate_coupon', { _code: couponCode.trim() }) as { data: any; error: any };
      if (error) throw error;
      if (!data?.valid) {
        toast({ variant: 'destructive', title: 'Invalid Coupon', description: data?.error || 'Could not apply coupon.' });
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          coupon_id: data.coupon_id,
          code: data.code,
          discount_percentage: data.discount_percentage,
        });
        toast({ title: `Coupon Applied! 🎉`, description: `You get ${data.discount_percentage}% off!` });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const getDiscountedPrice = (price: number) => {
    if (!appliedCoupon) return price;
    return Math.round((price * (100 - appliedCoupon.discount_percentage)) * 100) / 100 / 100;
  };

  const handleMpesaPayment = async () => {
    if (!selectedPlan || !mpesaPhone || !user) return;

    const phoneClean = mpesaPhone.replace(/\s+/g, '');
    if (phoneClean.length < 9) {
      toast({ variant: 'destructive', title: 'Invalid Phone', description: 'Please enter a valid M-Pesa phone number.' });
      return;
    }

    setMpesaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone_number: phoneClean,
          plan_id: selectedPlan.id,
          amount: selectedPlan.price_monthly,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Check Your Phone 📱',
        description: 'An M-Pesa payment prompt has been sent to your phone. Enter your PIN to complete.',
      });

      // Start polling for payment status
      const checkoutRequestId = data.checkout_request_id;
      setMpesaPolling(true);
      setMpesaLoading(false);

      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const { data: statusData } = await supabase.functions.invoke('mpesa-check-status', {
            body: { checkout_request_id: checkoutRequestId },
          });

          if (statusData?.status === 'completed') {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setMpesaPolling(false);
            setShowMpesaDialog(false);
            setMpesaPhone('');
            toast({ title: '🎉 Payment Successful!', description: 'Your subscription has been activated.' });
            refetchSubscription();
            checkSubscription();
          } else if (statusData?.status === 'failed') {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setMpesaPolling(false);
            toast({
              variant: 'destructive',
              title: 'Payment Failed',
              description: statusData.result_desc || 'M-Pesa payment was not completed.',
            });
          }
        } catch { /* keep polling */ }

        if (attempts >= 30) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setMpesaPolling(false);
          toast({ title: 'Timeout', description: 'Payment status check timed out. If you completed the payment, your subscription will activate shortly.' });
        }
      }, 5000);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'M-Pesa Error', description: error.message || 'Failed to initiate M-Pesa payment.' });
      setMpesaLoading(false);
    }
  };

  const handlePaymentMethodSelect = async (method: 'stripe' | 'paypal' | 'mpesa') => {
    if (!selectedPlan) return;

    if (method === 'stripe') {
      if (!selectedPlan.stripe_price_id) {
        toast({ variant: 'destructive', title: 'Configuration Error', description: 'Stripe is not properly configured for this plan.' });
        return;
      }
      try {
        setProcessingMethod('stripe');
        const url = await createCheckout(selectedPlan.stripe_price_id);
        if (url) window.open(url, '_blank');
        setShowPaymentDialog(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to start checkout' });
      } finally {
        setProcessingMethod(null);
      }
    } else if (method === 'paypal') {
      toast({ title: 'PayPal', description: 'PayPal checkout coming soon. Please use another payment method.' });
    } else if (method === 'mpesa') {
      setShowPaymentDialog(false);
      setShowMpesaDialog(true);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const url = await openCustomerPortal();
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to open billing portal',
      });
    }
  };

  if (plansLoading || stripeLoading) {
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
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="font-display text-3xl font-bold mb-2">{t('choose_plan')}</h1>
          <p className="text-muted-foreground">
            Select the perfect plan for capturing your memories
          </p>
        </motion.div>

        {stripeSubscription?.subscribed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              className="gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Manage Subscription
              <ExternalLink className="w-3 h-3" />
            </Button>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const tier = plan.tier as StripeTier;
            const isCurrentPlan = stripeSubscription?.tier === tier;
            const isPremium = plan.tier === 'premium';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={cn(
                    "relative h-full border-2 transition-all hover:shadow-lg",
                    isCurrentPlan ? 'ring-2 ring-primary' : '',
                    isPremium ? 'border-collab shadow-glow' : 'border-border'
                  )}
                >
                  {isPremium && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-collab text-collab-foreground text-xs font-semibold rounded-full">
                      Most Popular
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4 px-3 py-1 bg-success text-success-foreground text-xs font-semibold rounded-full">
                      {t('current_plan')}
                    </div>
                  )}
                  <CardHeader className={cn("text-center pb-4", isPremium && "gradient-collab rounded-t-lg")}>
                    <CardTitle className={cn("font-display text-2xl", isPremium && "text-collab-foreground")}>
                      {plan.name}
                    </CardTitle>
                    <div className={cn("mt-4", isPremium && "text-collab-foreground")}>
                      <span className="text-4xl font-bold">${plan.price_monthly}</span>
                      <span className="text-muted-foreground">{t('per_month')}</span>
                    </div>
                    <CardDescription className={cn(isPremium && "text-collab-foreground/80")}>
                      {plan.daily_memory_limit} memories per day
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn(
                        "w-full mt-6",
                        isPremium ? "gradient-collab text-collab-foreground" : "",
                        isCurrentPlan ? "bg-muted text-muted-foreground" : ""
                      )}
                      variant={isPremium ? "default" : "outline"}
                      disabled={isCurrentPlan || !!processingMethod}
                      onClick={() => handleOpenPaymentDialog(plan)}
                    >
                      {isCurrentPlan ? (
                        'Current Plan'
                      ) : stripeSubscription?.subscribed ? (
                        'Change Plan'
                      ) : (
                        'Subscribe Now'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {stripeSubscription?.subscribed && stripeSubscription.subscription_end && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-sm text-muted-foreground"
          >
            <p>
              Your current billing period ends on{' '}
              {new Date(stripeSubscription.subscription_end).toLocaleDateString()}
            </p>
          </motion.div>
        )}

        {/* Payment Method Dialog */}
        {selectedPlan && (
          <PaymentMethodDialog
            open={showPaymentDialog}
            onOpenChange={setShowPaymentDialog}
            planName={selectedPlan.name}
            planPrice={selectedPlan.price_monthly}
            onSelectMethod={handlePaymentMethodSelect}
            processingMethod={processingMethod}
            configuredMethods={configuredMethods}
          />
        )}

        {/* M-Pesa Phone Number Dialog */}
        <Dialog open={showMpesaDialog} onOpenChange={(open) => {
          if (!mpesaPolling) setShowMpesaDialog(open);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#4CAF50]" />
                M-Pesa Payment
              </DialogTitle>
              <DialogDescription>
                {selectedPlan && (
                  <>Subscribe to <span className="font-semibold text-foreground">{selectedPlan.name}</span> for <span className="font-semibold text-foreground">KES {selectedPlan.price_monthly}/month</span></>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
                <Input
                  id="mpesa-phone"
                  placeholder="e.g., 0712345678 or 254712345678"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  disabled={mpesaLoading || mpesaPolling}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the Safaricom number registered with M-Pesa
                </p>
              </div>

              {mpesaPolling && (
                <div className="flex items-center gap-3 p-4 bg-[#4CAF50]/10 rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-[#4CAF50]" />
                  <div>
                    <p className="text-sm font-medium">Waiting for payment confirmation...</p>
                    <p className="text-xs text-muted-foreground">Check your phone and enter your M-Pesa PIN</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  setMpesaPolling(false);
                  setShowMpesaDialog(false);
                  setMpesaPhone('');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#4CAF50] hover:bg-[#43A047] text-white"
                onClick={handleMpesaPayment}
                disabled={mpesaLoading || mpesaPolling || !mpesaPhone}
              >
                {mpesaLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                ) : mpesaPolling ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirming...</>
                ) : (
                  'Pay with M-Pesa'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
