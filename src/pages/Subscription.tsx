import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Loader2, CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, SubscriptionPlan } from '@/hooks/useSubscription';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { StripeTier } from '@/lib/stripe-config';
import { PaymentMethodDialog } from '@/components/subscription/PaymentMethodDialog';

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { plans, loading: plansLoading } = useSubscription();
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

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: 'Payment Successful!',
        description: 'Your subscription has been activated.',
      });
      checkSubscription();
      navigate('/subscription', { replace: true });
    } else if (searchParams.get('canceled') === 'true') {
      toast({
        variant: 'destructive',
        title: 'Payment Canceled',
        description: 'You can try again when ready.',
      });
      navigate('/subscription', { replace: true });
    }
  }, [searchParams, toast, navigate, checkSubscription]);

  const handleOpenPaymentDialog = (plan: SubscriptionPlan) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Login Required',
        description: 'Please log in to subscribe.',
      });
      return;
    }
    // Refresh payment methods config before showing dialog
    refetchPaymentMethods();
    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const handlePaymentMethodSelect = async (method: 'stripe' | 'paypal' | 'mpesa') => {
    if (!selectedPlan) return;

    if (method === 'stripe') {
      if (!selectedPlan.stripe_price_id) {
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'Stripe is not properly configured for this plan.',
        });
        return;
      }

      try {
        setProcessingMethod('stripe');
        const url = await createCheckout(selectedPlan.stripe_price_id);
        
        if (url) {
          window.open(url, '_blank');
        }
        setShowPaymentDialog(false);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to start checkout',
        });
      } finally {
        setProcessingMethod(null);
      }
    } else if (method === 'paypal') {
      if (!configuredMethods.paypal) {
        toast({
          variant: 'destructive',
          title: 'Not Available',
          description: 'PayPal payment is not configured. Please contact support.',
        });
        return;
      }
      
      toast({
        title: 'PayPal',
        description: 'PayPal checkout coming soon. Please use another payment method.',
      });
    } else if (method === 'mpesa') {
      if (!configuredMethods.mpesa) {
        toast({
          variant: 'destructive',
          title: 'Not Available',
          description: 'M-Pesa payment is not configured. Please contact support.',
        });
        return;
      }
      
      toast({
        title: 'M-Pesa',
        description: 'M-Pesa checkout coming soon. Please use another payment method.',
      });
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
      </div>
    </AppLayout>
  );
}
