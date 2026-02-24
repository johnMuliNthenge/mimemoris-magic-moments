import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  MoreVertical, 
  Shield,
  Mail,
  Calendar,
  CreditCard,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface UserWithDetails {
  id: string;
  email: string | null;
  full_name: string | null;
  whatsapp_number: string | null;
  created_at: string;
  subscription: {
    id: string;
    status: string;
    plan_id: string;
    plan: {
      id: string;
      name: string;
      tier: string;
    };
  } | null;
  isAdmin: boolean;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
}

export function AdminUsers() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [manageSubUser, setManageSubUser] = useState<UserWithDetails | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('admin-list-users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      setUsers(response.data.users || []);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      if (isCurrentlyAdmin) {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      } else {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
      }
      toast({ title: 'Role Updated', description: isCurrentlyAdmin ? 'Admin role removed' : 'Admin role granted' });
      fetchUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const openManageSub = (user: UserWithDetails) => {
    setManageSubUser(user);
    setSelectedPlanId(user.subscription?.plan_id || '');
  };

  const handleSaveSubscription = async () => {
    if (!manageSubUser || !selectedPlanId) return;
    setSavingSub(true);
    try {
      if (manageSubUser.subscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ plan_id: selectedPlanId, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', manageSubUser.subscription.id);
        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: manageSubUser.id,
            plan_id: selectedPlanId,
            status: 'active',
            current_period_start: new Date().toISOString(),
          });
        if (error) throw error;
      }
      toast({ title: 'Subscription Updated', description: 'User subscription has been updated.' });
      setManageSubUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSavingSub(false);
    }
  };

  const handleRemoveSubscription = async () => {
    if (!manageSubUser?.subscription) return;
    setSavingSub(true);
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', manageSubUser.subscription.id);
      if (error) throw error;
      toast({ title: 'Subscription Canceled', description: 'User subscription has been canceled.' });
      setManageSubUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSavingSub(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tierColors: Record<string, string> = {
    basic: 'bg-muted text-muted-foreground',
    standard: 'bg-primary/10 text-primary',
    premium: 'bg-collab/10 text-collab',
  };

  return (
    <>
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-collab" />
              User Management
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                            {user.full_name?.charAt(0) || 'U'}
                          </div>
                          <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[180px]">{user.email || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{user.whatsapp_number || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.subscription && user.subscription.status === 'active' ? (
                          <Badge className={tierColors[user.subscription.plan?.tier || 'basic']}>
                            {user.subscription.plan?.name || 'Unknown'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No subscription</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge className="bg-collab/10 text-collab">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toggleAdmin(user.id, user.isAdmin)}>
                              <Shield className="w-4 h-4 mr-2" />
                              {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openManageSub(user)}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Manage Subscription
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manage Subscription Dialog */}
      <Dialog open={!!manageSubUser} onOpenChange={(open) => !open && setManageSubUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              {manageSubUser?.full_name || manageSubUser?.email || 'User'} — 
              Current: {manageSubUser?.subscription?.plan?.name || 'None'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — ${plan.price_monthly}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {manageSubUser?.subscription && manageSubUser.subscription.status === 'active' && (
              <Button variant="destructive" onClick={handleRemoveSubscription} disabled={savingSub}>
                Cancel Subscription
              </Button>
            )}
            <Button onClick={handleSaveSubscription} disabled={!selectedPlanId || savingSub}>
              {savingSub ? 'Saving...' : manageSubUser?.subscription ? 'Update Plan' : 'Assign Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
