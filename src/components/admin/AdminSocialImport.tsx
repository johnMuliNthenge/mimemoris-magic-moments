import { useState, useEffect } from 'react';
import { Loader2, Save, MessageCircle, Send, Twitter, Music, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PlatformConfig {
  id: string;
  platform: string;
  display_name: string;
  is_active: boolean;
  config: Record<string, any>;
  contact_identifier: string | null;
}

interface PlanPlatform {
  plan_id: string;
  plan_name: string;
  plan_tier: string;
  platforms: Record<string, boolean>;
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

export function AdminSocialImport() {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [planPlatforms, setPlanPlatforms] = useState<PlanPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<PlatformConfig | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch platform configs
      const { data: configs } = await supabase
        .from('social_import_config')
        .select('*')
        .order('platform');

      // Fetch plans
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id, name, tier')
        .order('price_monthly', { ascending: true });

      // Fetch plan-platform mappings
      const { data: mappings } = await supabase
        .from('plan_social_platforms')
        .select('*');

      if (configs) {
        setPlatforms(configs as unknown as PlatformConfig[]);
      }

      if (plans) {
        const pp: PlanPlatform[] = plans.map((plan: any) => ({
          plan_id: plan.id,
          plan_name: plan.name,
          plan_tier: plan.tier,
          platforms: {},
        }));

        // Apply existing mappings
        for (const pp_item of pp) {
          const planMappings = (mappings || []).filter((m: any) => m.plan_id === pp_item.plan_id);
          for (const m of planMappings) {
            pp_item.platforms[m.platform] = m.is_enabled;
          }
        }

        setPlanPlatforms(pp);
      }
    } catch (error) {
      console.error('Error fetching social import data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlatformActive = async (platform: PlatformConfig) => {
    try {
      const { error } = await supabase
        .from('social_import_config')
        .update({ is_active: !platform.is_active })
        .eq('id', platform.id);

      if (error) throw error;
      toast({ title: `${platform.display_name} ${!platform.is_active ? 'activated' : 'deactivated'}` });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const savePlatformConfig = async (platform: PlatformConfig) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('social_import_config')
        .update({
          config: platform.config,
          contact_identifier: platform.contact_identifier,
        })
        .eq('id', platform.id);

      if (error) throw error;
      toast({ title: 'Configuration Saved', description: `${platform.display_name} settings updated.` });
      setEditingPlatform(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const togglePlanPlatform = async (planId: string, platform: string, enabled: boolean) => {
    try {
      // Upsert the mapping
      const { error } = await supabase
        .from('plan_social_platforms')
        .upsert(
          { plan_id: planId, platform, is_enabled: enabled },
          { onConflict: 'plan_id,platform' }
        );

      if (error) throw error;
      toast({ title: enabled ? 'Platform Enabled' : 'Platform Disabled' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const getConfigFields = (platform: string) => {
    switch (platform) {
      case 'whatsapp':
        return [
          { key: 'phone_number_id', label: 'Phone Number ID', type: 'text' },
          { key: 'access_token', label: 'Access Token', type: 'password' },
          { key: 'verify_token', label: 'Verify Token', type: 'text' },
        ];
      case 'telegram':
        return [
          { key: 'bot_token', label: 'Bot Token', type: 'password' },
          { key: 'bot_username', label: 'Bot Username', type: 'text' },
        ];
      case 'x':
        return [
          { key: 'api_key', label: 'API Key', type: 'password' },
          { key: 'api_secret', label: 'API Secret', type: 'password' },
          { key: 'bot_username', label: 'Bot Username', type: 'text' },
        ];
      case 'tiktok':
        return [
          { key: 'app_id', label: 'App ID', type: 'text' },
          { key: 'app_secret', label: 'App Secret', type: 'password' },
        ];
      case 'facebook':
        return [
          { key: 'page_id', label: 'Page ID', type: 'text' },
          { key: 'access_token', label: 'Page Access Token', type: 'password' },
          { key: 'verify_token', label: 'Verify Token', type: 'text' },
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="platforms">
        <TabsList>
          <TabsTrigger value="platforms">Platform Setup</TabsTrigger>
          <TabsTrigger value="plans">Plan Access</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Configure API credentials for each social media platform. Users can send messages to these platforms to capture memories automatically.
          </p>
          <div className="grid gap-4">
            {platforms.map((platform) => {
              const Icon = PLATFORM_ICONS[platform.platform] || MessageCircle;
              const colorClass = PLATFORM_COLORS[platform.platform] || 'text-foreground';
              const isEditing = editingPlatform?.id === platform.id;

              return (
                <Card key={platform.id} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className={`w-5 h-5 ${colorClass}`} />
                        {platform.display_name}
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <Badge variant={platform.is_active ? 'default' : 'secondary'}>
                          {platform.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch
                          checked={platform.is_active}
                          onCheckedChange={() => togglePlatformActive(platform)}
                        />
                      </div>
                    </div>
                    {platform.contact_identifier && (
                      <CardDescription>
                        Contact: <span className="font-mono text-foreground">{platform.contact_identifier}</span>
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Contact Identifier (Number/Username shown to users)</Label>
                          <Input
                            value={editingPlatform.contact_identifier || ''}
                            onChange={(e) =>
                              setEditingPlatform({
                                ...editingPlatform,
                                contact_identifier: e.target.value,
                              })
                            }
                            placeholder="e.g., +254700000000 or @mimemoris_bot"
                          />
                        </div>
                        {getConfigFields(platform.platform).map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label>{field.label}</Label>
                            <Input
                              type={field.type}
                              value={editingPlatform.config?.[field.key] || ''}
                              onChange={(e) =>
                                setEditingPlatform({
                                  ...editingPlatform,
                                  config: {
                                    ...editingPlatform.config,
                                    [field.key]: e.target.value,
                                  },
                                })
                              }
                              placeholder={`Enter ${field.label}`}
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => savePlatformConfig(editingPlatform)}
                            disabled={saving}
                            size="sm"
                          >
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPlatform(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPlatform({ ...platform })}
                      >
                        Configure API
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Control which social import platforms are available for each subscription tier.
          </p>
          <div className="grid gap-4">
            {planPlatforms.map((pp) => (
              <Card key={pp.plan_id} className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {pp.plan_name}
                    <Badge variant="outline">{pp.plan_tier}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {platforms.map((platform) => {
                      const Icon = PLATFORM_ICONS[platform.platform] || MessageCircle;
                      const colorClass = PLATFORM_COLORS[platform.platform] || 'text-foreground';
                      const isEnabled = pp.platforms[platform.platform] || false;

                      return (
                        <div
                          key={platform.platform}
                          className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border"
                        >
                          <Icon className={`w-6 h-6 ${colorClass}`} />
                          <span className="text-xs font-medium">{platform.display_name}</span>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              togglePlanPlatform(pp.plan_id, platform.platform, checked)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
