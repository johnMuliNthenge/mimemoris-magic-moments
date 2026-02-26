import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  BookHeart, 
  Users, 
  Settings, 
  Shield, 
  CreditCard,
  LogOut,
  Sun,
  Moon,
  Handshake,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { cn } from '@/lib/utils';
import { FloatingHelpButton } from '@/components/layout/FloatingHelpButton';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { pendingRequests } = useFriends();
  const [isDark, setIsDark] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const incomingRequestCount = pendingRequests.filter(r => r.is_follower).length;

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('nav_home'), badge: 0 },
    { path: '/memories', icon: BookHeart, label: t('nav_memories'), badge: 0 },
    { path: '/friends', icon: Users, label: t('nav_friends'), badge: incomingRequestCount },
    { path: '/collaborate', icon: Handshake, label: t('nav_collaborate'), badge: 0 },
    { path: '/subscription', icon: CreditCard, label: t('nav_subscription'), badge: 0 },
    { path: '/settings', icon: Settings, label: t('nav_settings'), badge: 0 },
  ];

  // Mobile: show first 4 + "more" button
  const mobileMainItems = navItems.slice(0, 4);
  const mobileMoreItems = navItems.slice(4);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar - Desktop */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-50 shadow-soft">
        <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl gradient-warm flex items-center justify-center">
              <BookHeart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">
              {t('app_name')}
            </span>
          </Link>

          {/* Desktop Nav Icons */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      className={cn(
                        "relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.badge > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs justify-center">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin"
                    className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                      location.pathname.startsWith('/admin')
                        ? "bg-collab text-collab-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <Shield className="w-5 h-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t('nav_admin')}
                </TooltipContent>
              </Tooltip>
            )}
          </nav>

          {/* Right Actions - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl">
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isDark ? t('light_mode') : t('dark_mode')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-xl text-destructive hover:text-destructive">
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t('logout')}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile: theme + logout in header */}
          <div className="flex md:hidden items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl h-9 w-9">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-xl h-9 w-9 text-destructive hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50 shadow-soft">
        <div className="flex items-center justify-around h-full px-2">
          {mobileMainItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                {item.badge > 0 && (
                  <Badge variant="destructive" className="absolute top-1.5 right-1/4 h-4 min-w-4 px-1 text-[9px] justify-center">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
              moreOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" popup */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="md:hidden fixed bottom-16 left-0 right-0 bg-card border-t border-border z-40 shadow-lg rounded-t-2xl"
          >
            <div className="p-4 grid grid-cols-3 gap-4">
              {mobileMoreItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                    location.pathname.startsWith('/admin')
                      ? "bg-collab text-collab-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Shield className="w-6 h-6" />
                  <span className="text-xs font-medium">{t('nav_admin')}</span>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-14 pb-16 md:pb-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <FloatingHelpButton />
    </div>
  );
}
