import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Trash2,
  Ticket,
  Loader2,
  Copy,
  Check,
  CalendarDays,
  Percent,
  History,
  Users,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Coupon {
  id: string;
  code: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  max_uses: number | null;
  times_used: number;
  created_at: string;
}

interface Redemption {
  id: string;
  coupon_id: string;
  user_id: string;
  plan_id: string | null;
  discount_percentage: number;
  original_price: number;
  discounted_price: number;
  payment_method: string | null;
  created_at: string;
  coupon_code?: string;
  user_email?: string;
  user_name?: string;
  plan_name?: string;
}

export function AdminCoupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redemptionsLoading, setRedemptionsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_percentage: 10,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    max_uses: '',
  });

  useEffect(() => {
    fetchCoupons();
    fetchRedemptions();
  }, []);

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCoupons(data as Coupon[]);
    }
    setLoading(false);
  };

  const fetchRedemptions = async () => {
    setRedemptionsLoading(true);
    const { data, error } = await supabase
      .from('coupon_redemptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Enrich with coupon codes, user profiles, and plan names
      const couponIds = [...new Set(data.map(r => r.coupon_id))];
      const userIds = [...new Set(data.map(r => r.user_id))];
      const planIds = [...new Set(data.map(r => r.plan_id).filter(Boolean))];

      const [couponsRes, profilesRes, plansRes] = await Promise.all([
        couponIds.length > 0
          ? supabase.from('coupons').select('id, code').in('id', couponIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : { data: [] },
        planIds.length > 0
          ? supabase.from('subscription_plans').select('id, name').in('id', planIds as string[])
          : { data: [] },
      ]);

      const enriched = data.map(r => ({
        ...r,
        coupon_code: (couponsRes.data as any[])?.find(c => c.id === r.coupon_id)?.code || 'Unknown',
        user_name: (profilesRes.data as any[])?.find(p => p.user_id === r.user_id)?.full_name || 'Unknown User',
        plan_name: r.plan_id ? (plansRes.data as any[])?.find(p => p.id === r.plan_id)?.name || 'Unknown' : '—',
      })) as Redemption[];

      setRedemptions(enriched);
    }
    setRedemptionsLoading(false);
  };

  const createCoupon = async () => {
    if (!newCoupon.code.trim() || !newCoupon.end_date) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Code and end date are required.' });
      return;
    }

    if (newCoupon.discount_percentage < 1 || newCoupon.discount_percentage > 100) {
      toast({ variant: 'destructive', title: 'Invalid Discount', description: 'Discount must be between 1% and 100%.' });
      return;
    }

    if (new Date(newCoupon.end_date) <= new Date(newCoupon.start_date)) {
      toast({ variant: 'destructive', title: 'Invalid Dates', description: 'End date must be after start date.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('coupons').insert({
        code: newCoupon.code.toUpperCase().trim(),
        discount_percentage: newCoupon.discount_percentage,
        start_date: newCoupon.start_date,
        end_date: newCoupon.end_date,
        max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
      });

      if (error) throw error;

      toast({ title: 'Coupon Created', description: `Coupon "${newCoupon.code.toUpperCase()}" has been created.` });
      setShowCreateDialog(false);
      setNewCoupon({ code: '', discount_percentage: 10, start_date: new Date().toISOString().split('T')[0], end_date: '', max_uses: '' });
      fetchCoupons();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message.includes('duplicate') ? 'A coupon with this code already exists.' : error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (id: string, currentActive: boolean) => {
    await supabase.from('coupons').update({ is_active: !currentActive }).eq('id', id);
    toast({ title: currentActive ? 'Coupon Deactivated' : 'Coupon Activated' });
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from('coupons').delete().eq('id', id);
    toast({ title: 'Coupon Deleted' });
    fetchCoupons();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (endDate: string) => new Date(endDate) < new Date();
  const isNotStarted = (startDate: string) => new Date(startDate) > new Date();

  const getStatus = (coupon: Coupon) => {
    if (!coupon.is_active) return { label: 'Inactive', variant: 'secondary' as const };
    if (isExpired(coupon.end_date)) return { label: 'Expired', variant: 'destructive' as const };
    if (isNotStarted(coupon.start_date)) return { label: 'Scheduled', variant: 'outline' as const };
    if (coupon.max_uses && coupon.times_used >= coupon.max_uses) return { label: 'Maxed Out', variant: 'secondary' as const };
    return { label: 'Active', variant: 'default' as const };
  };

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Coupon Management
              </CardTitle>
              <CardDescription>Create and manage discount coupon codes</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Coupon
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No coupons created yet</p>
              <p className="text-sm">Create your first coupon to offer discounts</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Valid Period</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon, index) => {
                    const status = getStatus(coupon);
                    return (
                      <motion.tr
                        key={coupon.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-border last:border-0"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-muted rounded text-sm font-mono font-bold">
                              {coupon.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyCode(coupon.code, coupon.id)}
                            >
                              {copiedId === coupon.id ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">{coupon.discount_percentage}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <CalendarDays className="w-3 h-3" />
                            {new Date(coupon.start_date).toLocaleDateString()} — {new Date(coupon.end_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {coupon.times_used}{coupon.max_uses ? ` / ${coupon.max_uses}` : ' / ∞'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={coupon.is_active}
                              onCheckedChange={() => toggleCoupon(coupon.id, coupon.is_active)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteCoupon(coupon.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Coupon Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Create New Coupon
            </DialogTitle>
            <DialogDescription>
              Set up a unique discount code for your users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Coupon Code</Label>
              <Input
                id="coupon-code"
                placeholder="e.g., SAVE20"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                className="font-mono uppercase"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">Letters and numbers only, auto-uppercased</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Discount Percentage</Label>
              <div className="relative">
                <Input
                  id="discount"
                  type="number"
                  min={1}
                  max={100}
                  value={newCoupon.discount_percentage}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discount_percentage: parseInt(e.target.value) || 0 })}
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={newCoupon.start_date}
                  onChange={(e) => setNewCoupon({ ...newCoupon, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={newCoupon.end_date}
                  onChange={(e) => setNewCoupon({ ...newCoupon, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-uses">Max Uses (optional)</Label>
              <Input
                id="max-uses"
                type="number"
                min={1}
                placeholder="Unlimited"
                value={newCoupon.max_uses}
                onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited uses</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createCoupon} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redemption History */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Redemption History
          </CardTitle>
          <CardDescription>Track which users redeemed coupons and when</CardDescription>
        </CardHeader>
        <CardContent>
          {redemptionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : redemptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No redemptions yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Discounted</TableHead>
                    <TableHead>Saved</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.user_name}</TableCell>
                      <TableCell>
                        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{r.coupon_code}</code>
                      </TableCell>
                      <TableCell className="text-sm">{r.plan_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">${r.original_price}</TableCell>
                      <TableCell className="text-sm font-semibold">${r.discounted_price}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          -{r.discount_percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{r.payment_method || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
