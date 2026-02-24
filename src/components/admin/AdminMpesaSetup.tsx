import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  X, 
  Key,
  Loader2,
  Shield,
  Smartphone
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MpesaConfig {
  id?: string;
  is_active: boolean;
  shortcode: string;
  environment: string;
}

export function AdminMpesaSetup() {
  const { toast } = useToast();
  const [config, setConfig] = useState<MpesaConfig | null>(null);
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [shortcode, setShortcode] = useState('');
  const [passkey, setPasskey] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [loading, setLoading] = useState(false);
  const [fetchingConfig, setFetchingConfig] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setFetchingConfig(true);
    const { data } = await supabase
      .from('mpesa_config')
      .select('id, is_active, shortcode, environment')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setConfig(data);
    }
    setFetchingConfig(false);
  };

  const handleSaveConfig = async () => {
    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      toast({
        variant: 'destructive',
        title: 'Missing Credentials',
        description: 'Please fill in all required fields',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        shortcode,
        passkey,
        environment,
        is_active: true,
      };

      if (config?.id) {
        // Update existing
        const { error } = await supabase
          .from('mpesa_config')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('mpesa_config')
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: 'M-Pesa Configured',
        description: `M-Pesa Daraja API (${environment}) has been set up successfully.`,
      });

      setShowForm(false);
      setConsumerSecret('');
      setPasskey('');
      setConsumerKey('');
      fetchConfig();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save M-Pesa configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!config?.id) return;
    const { error } = await supabase
      .from('mpesa_config')
      .update({ is_active: false })
      .eq('id', config.id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'M-Pesa Disconnected', description: 'M-Pesa integration has been deactivated' });
      fetchConfig();
    }
  };

  if (fetchingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = config?.is_active === true;

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#4CAF50]/10">
                <Smartphone className="w-6 h-6 text-[#4CAF50]" />
              </div>
              <div>
                <CardTitle>M-Pesa Payments</CardTitle>
                <CardDescription>Accept mobile money payments via Safaricom M-Pesa</CardDescription>
              </div>
            </div>
            <Badge 
              variant={isConfigured ? 'default' : 'secondary'}
              className={isConfigured ? 'bg-success' : ''}
            >
              {isConfigured ? (
                <><Check className="w-3 h-3 mr-1" /> Connected</>
              ) : (
                <><X className="w-3 h-3 mr-1" /> Not Configured</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Daraja API</span>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    <Check className="w-3 h-3 mr-1" /> Configured
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Environment</span>
                  </div>
                  <Badge variant="outline" className={config?.environment === 'production' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                    {config?.environment === 'production' ? 'Production' : 'Sandbox'}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Business Shortcode</p>
                <code className="text-sm">{config?.shortcode}</code>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowForm(true)}>Update Credentials</Button>
                <Button variant="destructive" onClick={handleDisconnect}>Disconnect</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Connect your M-Pesa Daraja API to accept mobile money payments
              </p>
              <Button onClick={() => setShowForm(true)} className="bg-[#4CAF50] hover:bg-[#43A047] text-white">
                <Smartphone className="w-4 h-4 mr-2" />
                Set Up M-Pesa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Configure M-Pesa Daraja API</CardTitle>
              <CardDescription>
                Get your API credentials from the{' '}
                <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Safaricom Developer Portal
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your credentials are stored securely in the database with admin-only access.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Environment</Label>
                <div className="flex gap-3">
                  <Button type="button" variant={environment === 'sandbox' ? 'default' : 'outline'} size="sm" onClick={() => setEnvironment('sandbox')}>
                    Sandbox (Test)
                  </Button>
                  <Button type="button" variant={environment === 'production' ? 'default' : 'outline'} size="sm" onClick={() => setEnvironment('production')}>
                    Production (Live)
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mpesa-consumer-key">Consumer Key</Label>
                  <Input id="mpesa-consumer-key" placeholder="Your Consumer Key" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mpesa-consumer-secret">Consumer Secret</Label>
                  <Input id="mpesa-consumer-secret" type="password" placeholder="Your Consumer Secret" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mpesa-shortcode">Business Shortcode</Label>
                  <Input id="mpesa-shortcode" placeholder="e.g., 174379" value={shortcode} onChange={(e) => setShortcode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mpesa-passkey">Lipa Na M-Pesa Passkey</Label>
                  <Input id="mpesa-passkey" type="password" placeholder="Your Passkey" value={passkey} onChange={(e) => setPasskey(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={loading || !consumerKey || !consumerSecret || !shortcode || !passkey}
                  className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
                >
                  {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Integration Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {[
              { title: 'Register on Safaricom Developer Portal', desc: 'Create an account at developer.safaricom.co.ke' },
              { title: 'Create an App', desc: 'Select Lipa Na M-Pesa Online (STK Push) API' },
              { title: 'Get your credentials', desc: 'Copy Consumer Key, Secret, Shortcode, and Passkey' },
              { title: 'Go live', desc: 'Apply for production credentials after testing in sandbox' },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4CAF50]/10 text-[#4CAF50] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
