import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const tierColors = {
  basic: 'border-muted-foreground',
  standard: 'border-primary',
  premium: 'border-collab gradient-collab',
};

const tierBg = {
  basic: 'bg-card',
  standard: 'bg-card',
  premium: 'gradient-collab text-collab-foreground',
};

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, plans, loading, refetch } = useSubscription();
  const { toast } = useToast();

  const selectPlan = async (planId: string) => {
    if (!user) return;

    try {
      const selectedPlan = plans.find(p => p.id === planId);
      const currentPlan = subscription?.plan;
      
      if (subscription) {
        // Update existing subscription
        await supabase
          .from('user_subscriptions')
          .update({ plan_id: planId })
          .eq('id', subscription.id);

        // Determine if upgrade or downgrade
        const planTiers = { basic: 1, standard: 2, premium: 3 };
        const currentTier = currentPlan?.tier ? planTiers[currentPlan.tier as keyof typeof planTiers] : 0;
        const newTier = selectedPlan?.tier ? planTiers[selectedPlan.tier as keyof typeof planTiers] : 0;
        const type = newTier > currentTier ? 'upgrade' : 'downgrade';

        // Send notification
        await supabase.functions.invoke('subscription-notification', {
          body: {
            userId: user.id,
            userEmail: user.email,
            newPlanName: selectedPlan?.name || 'Unknown',
            previousPlanName: currentPlan?.name,
            type
          }
        });
      } else {
        // Create new subscription
        await supabase.from('user_subscriptions').insert({
          user_id: user.id,
          plan_id: planId,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // Send welcome notification
        await supabase.functions.invoke('subscription-notification', {
          body: {
            userId: user.id,
            userEmail: user.email,
            newPlanName: selectedPlan?.name || 'Unknown',
            type: 'new'
          }
        });
      }

      toast({
        title: 'Plan Updated!',
        description: 'Your subscription has been updated successfully.',
      });

      refetch();
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  if (loading) {
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

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const isCurrentPlan = subscription?.plan_id === plan.id;
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
                      disabled={isCurrentPlan}
                      onClick={() => selectPlan(plan.id)}
                    >
                      {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {subscription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-sm text-muted-foreground"
          >
            <p>
              Your current billing period ends on{' '}
              {subscription.current_period_end 
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : 'N/A'
              }
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
