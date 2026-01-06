import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPlans as AdminPlansComponent } from '@/components/admin/AdminPlans';

export default function AdminPlans() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage subscription plans and pricing
          </p>
        </div>
        <AdminPlansComponent />
      </div>
    </AdminLayout>
  );
}
