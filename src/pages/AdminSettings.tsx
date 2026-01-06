import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminStripeSetup } from '@/components/admin/AdminStripeSetup';

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure payment settings and integrations
          </p>
        </div>
        <AdminStripeSetup />
      </div>
    </AdminLayout>
  );
}
