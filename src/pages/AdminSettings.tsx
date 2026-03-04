import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminStripeSetup } from '@/components/admin/AdminStripeSetup';
import { AdminPayPalSetup } from '@/components/admin/AdminPayPalSetup';
import { AdminMpesaSetup } from '@/components/admin/AdminMpesaSetup';
import { AdminEmailSetup } from '@/components/admin/AdminEmailSetup';
import { AdminHelpdeskSetup } from '@/components/admin/AdminHelpdeskSetup';
import { AdminSocialImport } from '@/components/admin/AdminSocialImport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Mail, Wallet, Smartphone, MessageCircle, Share2 } from 'lucide-react';

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
              Stripe
            </TabsTrigger>
            <TabsTrigger value="paypal" className="gap-2">
              <Wallet className="w-4 h-4" />
              PayPal
            </TabsTrigger>
            <TabsTrigger value="mpesa" className="gap-2">
              <Smartphone className="w-4 h-4" />
              M-Pesa
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="helpdesk" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Help Desk
            </TabsTrigger>
            <TabsTrigger value="social-import" className="gap-2">
              <Share2 className="w-4 h-4" />
              Social Import
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="payments">
            <AdminStripeSetup />
          </TabsContent>
          
          <TabsContent value="paypal">
            <AdminPayPalSetup />
          </TabsContent>
          
          <TabsContent value="mpesa">
            <AdminMpesaSetup />
          </TabsContent>
          
          <TabsContent value="email">
            <AdminEmailSetup />
          </TabsContent>
          
          <TabsContent value="helpdesk">
            <AdminHelpdeskSetup />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
