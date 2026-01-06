import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check,
  X,
  DollarSign,
  Users,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SubscriptionPlan {
  id: string;
  tier: 'basic' | 'standard' | 'premium';
  name: string;
  price_monthly: number;
  daily_memory_limit: number;
  languages_limited: boolean;
  features: string[];
  is_active: boolean;
  subscriber_count?: number;
  stripe_price_id?: string;
  stripe_product_id?: string;
}

export function AdminPlans() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true });

      if (error) throw error;

      // Get subscriber counts for each plan
      const plansWithCounts = await Promise.all(
        (data || []).map(async (plan) => {
          const { count } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', plan.id)
            .eq('status', 'active');

          return {
            ...plan,
            features: Array.isArray(plan.features) 
              ? plan.features 
              : JSON.parse(plan.features as string || '[]'),
            subscriber_count: count || 0,
          };
        })
      );

      setPlans(plansWithCounts as SubscriptionPlan[]);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan({ ...plan });
    setOriginalPrice(plan.price_monthly);
    setShowEditDialog(true);
  };

  const savePlan = async () => {
    if (!editingPlan) return;
    setSaving(true);

    try {
      const priceChanged = originalPrice !== editingPlan.price_monthly;

      // If price changed, update Stripe first
      if (priceChanged) {
        const { data, error: stripeError } = await supabase.functions.invoke('update-stripe-price', {
          body: {
            planId: editingPlan.id,
            newPrice: editingPlan.price_monthly,
            tier: editingPlan.tier,
          },
        });

        if (stripeError) throw new Error(stripeError.message);
        if (data?.error) throw new Error(data.error);

        toast({
          title: 'Stripe Price Updated',
          description: 'New price has been synced with Stripe.',
        });
      } else {
        // Only update non-price fields in database
        const { error } = await supabase
          .from('subscription_plans')
          .update({
            name: editingPlan.name,
            daily_memory_limit: editingPlan.daily_memory_limit,
            languages_limited: editingPlan.languages_limited,
            features: editingPlan.features,
            is_active: editingPlan.is_active,
          })
          .eq('id', editingPlan.id);

        if (error) throw error;
      }

      toast({
        title: 'Plan Updated',
        description: 'The subscription plan has been updated successfully.',
      });

      setShowEditDialog(false);
      fetchPlans();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePlanActive = async (planId: string, currentStatus: boolean) => {
    try {
      await supabase
        .from('subscription_plans')
        .update({ is_active: !currentStatus })
        .eq('id', planId);

      toast({
        title: currentStatus ? 'Plan Deactivated' : 'Plan Activated',
        description: `The plan has been ${currentStatus ? 'deactivated' : 'activated'}.`,
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const tierColors: Record<string, string> = {
    basic: 'border-muted-foreground/50',
    standard: 'border-primary',
    premium: 'border-collab',
  };

  const tierBg: Record<string, string> = {
    basic: '',
    standard: '',
    premium: 'gradient-collab',
  };

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-success" />
            Subscription Plans
          </CardTitle>
          <CardDescription>
            Manage pricing, features, and limits for each subscription tier
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={cn(
                    "relative border-2 transition-all",
                    tierColors[plan.tier],
                    !plan.is_active && "opacity-60"
                  )}>
                    {plan.tier === 'premium' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-collab text-collab-foreground text-xs font-semibold rounded-full">
                        Popular
                      </div>
                    )}
                    <CardHeader className={cn(
                      "text-center pb-4",
                      plan.tier === 'premium' && "gradient-collab rounded-t-lg"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardTitle className={cn(
                        "font-display text-xl",
                        plan.tier === 'premium' && "text-collab-foreground"
                      )}>
                        {plan.name}
                      </CardTitle>
                      <div className={cn(
                        "mt-2",
                        plan.tier === 'premium' && "text-collab-foreground"
                      )}>
                        <span className="text-3xl font-bold">${plan.price_monthly}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Daily Memories</span>
                        <span className="font-bold">{plan.daily_memory_limit}/day</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Subscribers
                        </span>
                        <span className="font-bold">{plan.subscriber_count}</span>
                      </div>
                      <ul className="space-y-2 text-sm">
                        {plan.features.slice(0, 3).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => togglePlanActive(plan.id, plan.is_active)}
                      >
                        {plan.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Plan Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingPlan?.name}</DialogTitle>
            <DialogDescription>
              Update the plan details and pricing
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name</Label>
                <Input
                  id="planName"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($/month)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={editingPlan.price_monthly}
                    onChange={(e) => setEditingPlan({ 
                      ...editingPlan, 
                      price_monthly: parseFloat(e.target.value) 
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Daily Memory Limit</Label>
                  <Input
                    id="limit"
                    type="number"
                    value={editingPlan.daily_memory_limit}
                    onChange={(e) => setEditingPlan({ 
                      ...editingPlan, 
                      daily_memory_limit: parseInt(e.target.value) 
                    })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <Label htmlFor="languages">Limit Languages (English only)</Label>
                <Switch
                  id="languages"
                  checked={editingPlan.languages_limited}
                  onCheckedChange={(checked) => setEditingPlan({ 
                    ...editingPlan, 
                    languages_limited: checked 
                  })}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <Label htmlFor="active">Plan Active</Label>
                <Switch
                  id="active"
                  checked={editingPlan.is_active}
                  onCheckedChange={(checked) => setEditingPlan({ 
                    ...editingPlan, 
                    is_active: checked 
                  })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('cancel')}
            </Button>
            <Button 
              onClick={savePlan} 
              disabled={saving}
              className="gradient-collab text-collab-foreground"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
