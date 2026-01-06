import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminUsers as AdminUsersComponent } from '@/components/admin/AdminUsers';

export default function AdminUsers() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all users
          </p>
        </div>
        <AdminUsersComponent />
      </div>
    </AdminLayout>
  );
}
