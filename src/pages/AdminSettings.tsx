import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminStripeSetup } from '@/components/admin/AdminStripeSetup';
import { AdminEmailSetup } from '@/components/admin/AdminEmailSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Mail } from 'lucide-react';

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure payment settings, email, and integrations
          </p>
        </div>
        
        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="payments">
            <AdminStripeSetup />
          </TabsContent>
          
          <TabsContent value="email">
            <AdminEmailSetup />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
