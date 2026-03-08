import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  BookHeart, 
  Users, 
  Settings, 
  Shield, 
  BarChart3,
  LogOut,
  Sun,
  Moon,
  Handshake,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { cn } from '@/lib/utils';
import { FloatingHelpButton } from '@/components/layout/FloatingHelpButton';
import { OfflineBanner } from '@/components/layout/OfflineBanner';

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

  const incomingRequestCount = pendingRequests.filter(r => r.is_follower).length;

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('nav_home'), badge: 0 },
    { path: '/memories', icon: BookHeart, label: t('nav_memories'), badge: 0 },
    { path: '/friends', icon: Users, label: t('nav_friends'), badge: incomingRequestCount },
    { path: '/analytics', icon: BarChart3, label: t('nav_analytics'), badge: 0 },
    { path: '/future-messages', icon: Mail, label: t('nav_future_messages'), badge: 0 },
    { path: '/collaborate', icon: Handshake, label: t('nav_collaborate'), badge: 0 },
    { path: '/settings', icon: Settings, label: t('nav_settings'), badge: 0 },
  ];


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
      <header className="fixed top-0 left-0 right-0 bg-card border-b border-border z-50 shadow-soft">
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

        {/* Mobile Nav Icons Row - below header */}
        <div className="md:hidden flex items-center justify-around px-1 h-12 border-t border-border/50 bg-card">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 px-2 h-full transition-all duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200",
                  isActive && "bg-primary text-primary-foreground shadow-glow"
                )}>
                  <item.icon className="w-3.5 h-3.5" />
                </div>
                <span className={cn(
                  "text-[9px] font-medium leading-tight",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>{item.label}</span>
                {item.badge > 0 && (
                  <Badge variant="destructive" className="absolute top-0 right-0 h-4 min-w-4 px-1 text-[9px] justify-center">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 px-2 h-full transition-all duration-200",
                location.pathname.startsWith('/admin')
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200",
                location.pathname.startsWith('/admin') && "bg-collab text-collab-foreground"
              )}>
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] font-medium leading-tight">{t('nav_admin')}</span>
            </Link>
          )}
        </div>
      </header>

      {/* Offline Banner */}
      <div className="pt-[6.5rem] md:pt-14">
        <OfflineBanner />
      </div>

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <FloatingHelpButton />
    </div>
  );
}
