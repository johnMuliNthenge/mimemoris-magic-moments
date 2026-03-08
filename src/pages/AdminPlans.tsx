import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPlans as AdminPlansComponent } from '@/components/admin/AdminPlans';
import { AdminCoupons } from '@/components/admin/AdminCoupons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Ticket } from 'lucide-react';

export default function AdminPlans() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage subscription plans, pricing, and coupons
          </p>
        </div>
        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList>
            <TabsTrigger value="plans" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2">
              <Ticket className="w-4 h-4" />
              Coupons
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plans">
            <AdminPlansComponent />
          </TabsContent>
          <TabsContent value="coupons">
            <AdminCoupons />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
