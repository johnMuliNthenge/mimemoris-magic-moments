import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, MessageCircle, Send, Twitter, Music, Facebook, Link, Copy, Check, ExternalLink, Lock, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PlatformInfo {
  platform: string;
  display_name: string;
  is_active: boolean;
  contact_identifier: string | null;
}

const PLATFORM_ICONS: Record<string, any> = {
  whatsapp: MessageCircle,
  telegram: Send,
  x: Twitter,
  tiktok: Music,
  facebook: Facebook,
};

const PLATFORM_COLORS: Record<string, string> = {
  whatsapp: 'text-[#25D366]',
  telegram: 'text-[#0088cc]',
  x: 'text-foreground',
  tiktok: 'text-foreground',
  facebook: 'text-[#1877F2]',
};

const PLATFORM_BG: Record<string, string> = {
  whatsapp: 'bg-[#25D366]/10',
  telegram: 'bg-[#0088cc]/10',
  x: 'bg-muted',
  tiktok: 'bg-muted',
  facebook: 'bg-[#1877F2]/10',
};

const PLATFORM_INSTRUCTIONS: Record<string, (contact: string | null) => string> = {
  whatsapp: (contact) => contact
    ? `Save ${contact} to your contacts, then send any message, photo, video, or voice note to capture it as a memory.`
    : 'WhatsApp import is configured. Contact info will appear here.',
  telegram: (contact) => contact
    ? `Open Telegram and message ${contact}. Use the link below to connect your account first.`
    : 'Telegram import is configured. Bot info will appear here.',
  x: () => 'Send a DM to our bot to capture tweets as memories.',
  tiktok: () => 'Share your TikTok videos to our platform to save as memories.',
  facebook: () => 'Message our Facebook page to capture posts as memories.',
};

export function SocialImportSettings() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [enabledPlatforms, setEnabledPlatforms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlatforms();
  }, [subscription]);

  const fetchPlatforms = async () => {
    try {
      // Fetch active platform configs via secure RPC (no API keys exposed)
      const { data: configs } = await supabase.rpc('get_active_social_platforms');

      if (configs) {
        setPlatforms(configs as PlatformInfo[]);
      }

      // Fetch which platforms are enabled for user's plan
      if (subscription?.plan?.id) {
        const { data: planPlatforms } = await supabase
          .from('plan_social_platforms')
          .select('platform, is_enabled')
          .eq('plan_id', subscription.plan.id)
          .eq('is_enabled', true);

        if (planPlatforms) {
          setEnabledPlatforms(new Set(planPlatforms.map((p: any) => p.platform)));
        }
      }
    } catch (error) {
      console.error('Error fetching platforms:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied!', description: 'Copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTelegramLinkUrl = () => {
    const telegramPlatform = platforms.find(p => p.platform === 'telegram');
    const botUsername = telegramPlatform?.contact_identifier?.replace('@', '') || '';
    return `https://t.me/${botUsername}?start=${user?.id}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <Card className="border-border shadow-soft">
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Social Import Not Available</p>
          <p className="text-sm mt-1">No social media platforms are currently configured. Check back later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Social Memory Import
        </CardTitle>
        <CardDescription>
          Capture memories directly from your social media platforms. Send messages to the contacts below and they'll automatically be saved as your memories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map((platform) => {
          const Icon = PLATFORM_ICONS[platform.platform] || MessageCircle;
          const colorClass = PLATFORM_COLORS[platform.platform] || 'text-foreground';
          const bgClass = PLATFORM_BG[platform.platform] || 'bg-muted';
          const isEnabled = enabledPlatforms.has(platform.platform);
          const instructions = PLATFORM_INSTRUCTIONS[platform.platform]?.(platform.contact_identifier) || '';

          return (
            <div
              key={platform.platform}
              className={cn(
                'relative p-4 rounded-lg border transition-all',
                isEnabled ? 'border-border' : 'border-border opacity-60'
              )}
            >
              {!isEnabled && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] rounded-lg flex items-center justify-center z-10">
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-medium">Upgrade your plan to access</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className={cn('p-3 rounded-xl', bgClass)}>
                  <Icon className={cn('w-6 h-6', colorClass)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{platform.display_name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {isEnabled ? 'Available' : 'Locked'}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">{instructions}</p>

                  {isEnabled && platform.contact_identifier && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(platform.contact_identifier!, platform.platform)}
                        className="gap-2"
                      >
                        {copiedId === platform.platform ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {platform.contact_identifier}
                      </Button>

                      {platform.platform === 'telegram' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => window.open(getTelegramLinkUrl(), '_blank')}
                          className="gap-2"
                        >
                          <Link className="w-3 h-3" />
                          Link Telegram Account
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}

                      {platform.platform === 'whatsapp' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `https://wa.me/${platform.contact_identifier?.replace(/[^0-9]/g, '')}?text=Hi%20Mimemoris!`,
                              '_blank'
                            )
                          }
                          className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                        >
                          <MessageCircle className="w-3 h-3" />
                          Open WhatsApp
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
