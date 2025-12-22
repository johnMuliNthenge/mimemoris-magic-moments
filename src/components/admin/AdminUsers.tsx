import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  MoreVertical, 
  UserX, 
  Shield,
  Mail,
  Calendar,
  CreditCard
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface UserWithDetails {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  subscription?: {
    status: string;
    plan: {
      name: string;
      tier: string;
    };
  } | null;
  isAdmin: boolean;
}

export function AdminUsers() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch subscriptions for each user
      const usersWithDetails = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get subscription
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select(`
              status,
              plan:subscription_plans(name, tier)
            `)
            .eq('user_id', profile.user_id)
            .maybeSingle();

          // Check if admin
          const { data: adminRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .eq('role', 'admin')
            .maybeSingle();

          return {
            ...profile,
            subscription: subscription as any,
            isAdmin: !!adminRole,
          };
        })
      );

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      if (isCurrentlyAdmin) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
      }

      toast({
        title: 'Role Updated',
        description: isCurrentlyAdmin ? 'Admin role removed' : 'Admin role granted',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tierColors: Record<string, string> = {
    basic: 'bg-muted text-muted-foreground',
    standard: 'bg-primary/10 text-primary',
    premium: 'bg-collab/10 text-collab',
  };

  return (
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
              placeholder="Search users..."
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
                <TableHead>Subscription</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                        <div>
                          <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {user.user_id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.subscription ? (
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
                          <DropdownMenuItem onClick={() => toggleAdmin(user.user_id, user.isAdmin)}>
                            <Shield className="w-4 h-4 mr-2" />
                            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="w-4 h-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem>
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
  );
}
