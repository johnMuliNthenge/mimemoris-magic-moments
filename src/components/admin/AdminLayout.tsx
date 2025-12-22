import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/admin/users', icon: Users, label: t('manage_users') },
    { path: '/admin/plans', icon: CreditCard, label: t('manage_plans') },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-card border-r border-border">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-border">
            <Link to="/admin" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-collab flex items-center justify-center">
                <Shield className="w-6 h-6 text-collab-foreground" />
              </div>
              <div>
                <span className="font-display text-lg font-bold text-foreground">
                  Admin Panel
                </span>
                <p className="text-xs text-muted-foreground">Mimemoris</p>
              </div>
            </Link>
          </div>

          {/* Back to App */}
          <div className="px-4 py-3 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const active = isActive(item.path, item.exact);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    active
                      ? "bg-collab text-collab-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logout')}</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-collab flex items-center justify-center">
              <Shield className="w-5 h-5 text-collab-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Admin</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-x-0 top-16 bg-card border-b border-border z-40 shadow-lg"
          >
            <nav className="p-4 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground mb-2"
                onClick={() => {
                  navigate('/dashboard');
                  setMobileMenuOpen(false);
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to App
              </Button>
              {navItems.map((item) => {
                const active = isActive(item.path, item.exact);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                      active
                        ? "bg-collab text-collab-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-3 text-destructive"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
