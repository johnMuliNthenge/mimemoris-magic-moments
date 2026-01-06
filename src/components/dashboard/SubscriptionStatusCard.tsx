import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Crown, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { STRIPE_TIERS } from '@/lib/stripe-config';
import { cn } from '@/lib/utils';

export function SubscriptionStatusCard() {
  const navigate = useNavigate();
  const { stripeSubscription, loading, openCustomerPortal } = useStripeSubscription();

  const handleManageSubscription = async () => {
    try {
      const url = await openCustomerPortal();
      if (url) window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening portal:', error);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="border-border shadow-soft">
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const isSubscribed = stripeSubscription?.subscribed;
  const tier = stripeSubscription?.tier;
  const tierConfig = tier ? STRIPE_TIERS[tier] : null;
  const renewalDate = stripeSubscription?.subscription_end;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <Card className={cn(
        "border-border shadow-soft overflow-hidden",
        isSubscribed && tier === 'premium' && "border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5"
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                isSubscribed ? "bg-primary/10" : "bg-muted"
              )}>
                {isSubscribed ? (
                  <Crown className="w-6 h-6 text-primary" />
                ) : (
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">
                    {isSubscribed ? tierConfig?.name || 'Active Plan' : 'No Active Plan'}
                  </h3>
                  {isSubscribed && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                      Active
                    </Badge>
                  )}
                </div>
                {isSubscribed && renewalDate ? (
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Renews {format(parseISO(renewalDate), 'MMMM d, yyyy')}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Subscribe to unlock premium features
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {isSubscribed ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleManageSubscription}
                >
                  Manage
                </Button>
              ) : (
                <Button 
                  size="sm"
                  className="gradient-warm text-primary-foreground"
                  onClick={() => navigate('/subscription')}
                >
                  Subscribe
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
