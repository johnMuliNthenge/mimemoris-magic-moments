import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { User, Globe, Moon, Sun, Loader2, CreditCard, ChevronRight, Share2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { SocialImportSettings } from '@/components/settings/SocialImportSettings';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'sw', name: 'Kiswahili' },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const { preferences: notifPrefs, updatePreference: updateNotifPref, loading: notifLoading } = useNotificationPreferences();

  const [fullName, setFullName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [loading, setLoading] = useState(false);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    if (user) {
      supabase
        .from('profiles')
        .update({ preferred_language: lang })
        .eq('user_id', user.id);
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };

  const updateProfile = async () => {
    if (!user || !fullName.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id);
      if (error) throw error;
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-3xl font-bold mb-2">{t('nav_settings')}</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </motion.div>

        {/* Subscription Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card
            className="border-border shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/subscription')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                {t('nav_subscription')}
              </CardTitle>
              <CardDescription>
                Manage your plan and billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={subscription?.plan ? 'default' : 'secondary'} className={subscription?.plan ? 'gradient-warm text-primary-foreground' : ''}>
                    {subscription?.plan?.name || 'No Plan'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {subscription?.status === 'active' ? 'Active' : 'Upgrade to unlock features'}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Profile Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {t('profile_settings')}
              </CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('full_name')}</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <Button
                onClick={updateProfile}
                disabled={loading || !fullName.trim()}
                className="gradient-warm text-primary-foreground"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('save')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Language Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-accent" />
                {t('language_settings')}
              </CardTitle>
              <CardDescription>
                Choose your preferred language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Social Import Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <SocialImportSettings />
        </motion.div>

        {/* Notification Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
        >
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'likes' as const, label: 'Likes', desc: 'When someone likes your memory or post' },
                { key: 'comments' as const, label: 'Comments', desc: 'When someone comments on your content' },
                { key: 'mentions' as const, label: 'Mentions', desc: 'When someone @mentions you' },
                { key: 'friend_requests' as const, label: 'Friend Requests', desc: 'When someone sends you a friend request' },
                { key: 'messages' as const, label: 'Messages', desc: 'When you receive a new chat message' },
                { key: 'trending' as const, label: 'Trending', desc: 'Activity on your Trending posts' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifPrefs[item.key]}
                    onCheckedChange={(val) => updateNotifPref(item.key, val)}
                    disabled={notifLoading}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Theme Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isDark ? <Moon className="w-5 h-5 text-collab" /> : <Sun className="w-5 h-5 text-warning" />}
                {t('theme_settings')}
              </CardTitle>
              <CardDescription>
                Switch between light and dark mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sun className="w-5 h-5 text-warning" />
                  <span className="text-sm">{t('light_mode')}</span>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                />
                <div className="flex items-center gap-3">
                  <span className="text-sm">{t('dark_mode')}</span>
                  <Moon className="w-5 h-5 text-collab" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
