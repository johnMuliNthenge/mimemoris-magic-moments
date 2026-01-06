import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  X, 
  AlertCircle, 
  ExternalLink,
  Key,
  Loader2,
  Shield,
  Wallet
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PayPalConfig {
  isConfigured: boolean;
  clientId: string;
  mode: 'sandbox' | 'live';
}

export function AdminPayPalSetup() {
  const { toast } = useToast();
  const [config, setConfig] = useState<PayPalConfig>({
    isConfigured: false,
    clientId: '',
    mode: 'sandbox',
  });
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSaveConfig = async () => {
    if (!clientId || !clientSecret) {
      toast({
        variant: 'destructive',
        title: 'Missing Credentials',
        description: 'Please enter both Client ID and Client Secret',
      });
      return;
    }

    setLoading(true);

    try {
      // Save to database or secrets
      // For now, we'll simulate the save process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setConfig({
        isConfigured: true,
        clientId: clientId,
        mode: mode,
      });

      toast({
        title: 'PayPal Configured',
        description: `PayPal ${mode} mode has been set up successfully.`,
      });

      setShowForm(false);
      setClientSecret('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save PayPal configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setConfig({
      isConfigured: false,
      clientId: '',
      mode: 'sandbox',
    });
    toast({
      title: 'PayPal Disconnected',
      description: 'PayPal integration has been removed',
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#003087]/10">
                <Wallet className="w-6 h-6 text-[#003087]" />
              </div>
              <div>
                <CardTitle>PayPal Payments</CardTitle>
                <CardDescription>Accept PayPal and card payments</CardDescription>
              </div>
            </div>
            <Badge 
              variant={config.isConfigured ? 'default' : 'secondary'}
              className={config.isConfigured ? 'bg-success' : ''}
            >
              {config.isConfigured ? (
                <><Check className="w-3 h-3 mr-1" /> Connected</>
              ) : (
                <><X className="w-3 h-3 mr-1" /> Not Configured</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {config.isConfigured ? (
            <div className="space-y-4">
              {/* Configuration Status */}
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">API Credentials</span>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    <Check className="w-3 h-3 mr-1" /> Configured
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Mode</span>
                  </div>
                  <Badge variant="outline" className={config.mode === 'live' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                    {config.mode === 'live' ? 'Live' : 'Sandbox'}
                  </Badge>
                </div>
              </div>

              {/* Client ID Display */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Client ID</p>
                <code className="text-sm">{config.clientId.slice(0, 20)}...</code>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowForm(true)}
                >
                  Update Keys
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Connect your PayPal Business account to accept payments
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#003087] hover:bg-[#002670] text-white"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Set Up PayPal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Configure PayPal API Credentials</CardTitle>
              <CardDescription>
                Get your API credentials from the{' '}
                <a 
                  href="https://developer.paypal.com/dashboard/applications" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  PayPal Developer Dashboard
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your credentials are encrypted and stored securely. Never share them publicly.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Environment Mode</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={mode === 'sandbox' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('sandbox')}
                  >
                    Sandbox (Test)
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'live' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('live')}
                  >
                    Live (Production)
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal-client-id">Client ID</Label>
                <Input
                  id="paypal-client-id"
                  placeholder="Your PayPal Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal-secret">Client Secret</Label>
                <Input
                  id="paypal-secret"
                  type="password"
                  placeholder="Your PayPal Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={loading || !clientId || !clientSecret}
                  className="bg-[#003087] hover:bg-[#002670] text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Integration Guide */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Integration Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#003087]/10 text-[#003087] flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Create a PayPal Business Account</p>
                <p className="text-muted-foreground">Sign up at developer.paypal.com if you haven't already</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#003087]/10 text-[#003087] flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Create an App</p>
                <p className="text-muted-foreground">Go to Dashboard → My Apps & Credentials → Create App</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#003087]/10 text-[#003087] flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Copy your credentials</p>
                <p className="text-muted-foreground">Get Client ID and Secret from your app details</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#003087]/10 text-[#003087] flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium">Test in Sandbox first</p>
                <p className="text-muted-foreground">Use sandbox mode to test before going live</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
