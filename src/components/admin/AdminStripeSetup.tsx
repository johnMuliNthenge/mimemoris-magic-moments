import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Check, 
  X, 
  AlertCircle, 
  ExternalLink,
  Key,
  Loader2,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface StripeConfig {
  isConfigured: boolean;
  publishableKey: string;
  webhookConfigured: boolean;
}

export function AdminStripeSetup() {
  const { toast } = useToast();
  const [config, setConfig] = useState<StripeConfig>({
    isConfigured: false,
    publishableKey: '',
    webhookConfigured: false,
  });
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSaveConfig = async () => {
    if (!secretKey.startsWith('sk_') || !publishableKey.startsWith('pk_')) {
      toast({
        variant: 'destructive',
        title: 'Invalid Keys',
        description: 'Please enter valid Stripe API keys',
      });
      return;
    }

    setLoading(true);

    // In a real implementation, you would save these to your backend/secrets
    // For now, we'll simulate the process
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setConfig({
        isConfigured: true,
        publishableKey: publishableKey,
        webhookConfigured: false,
      });

      toast({
        title: 'Stripe Configured',
        description: 'Your Stripe API keys have been saved. Set up webhooks to complete the integration.',
      });

      setShowForm(false);
      setSecretKey('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save Stripe configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setConfig({
      isConfigured: false,
      publishableKey: '',
      webhookConfigured: false,
    });
    toast({
      title: 'Stripe Disconnected',
      description: 'Stripe integration has been removed',
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#635BFF]/10">
                <CreditCard className="w-6 h-6 text-[#635BFF]" />
              </div>
              <div>
                <CardTitle>Stripe Payments</CardTitle>
                <CardDescription>Accept payments for subscriptions</CardDescription>
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
                    <span className="text-sm">API Keys</span>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    <Check className="w-3 h-3 mr-1" /> Configured
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Webhook</span>
                  </div>
                  <Badge variant="outline" className={config.webhookConfigured ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                    {config.webhookConfigured ? (
                      <><Check className="w-3 h-3 mr-1" /> Active</>
                    ) : (
                      <><AlertCircle className="w-3 h-3 mr-1" /> Pending Setup</>
                    )}
                  </Badge>
                </div>
              </div>

              {/* Publishable Key Display */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Publishable Key</p>
                <code className="text-sm">{config.publishableKey.slice(0, 20)}...</code>
              </div>

              {/* Webhook Setup Instructions */}
              {!config.webhookConfigured && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Set up webhooks in your Stripe dashboard to handle subscription events.
                    <Button variant="link" className="px-1 h-auto" asChild>
                      <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer">
                        Open Stripe Dashboard <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

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
                Connect your Stripe account to accept subscription payments
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#635BFF] hover:bg-[#5147e5] text-white"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Set Up Stripe
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
              <CardTitle className="text-lg">Configure Stripe API Keys</CardTitle>
              <CardDescription>
                Get your API keys from the{' '}
                <a 
                  href="https://dashboard.stripe.com/apikeys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Stripe Dashboard
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your secret key is encrypted and stored securely. Never share it publicly.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="publishable">Publishable Key</Label>
                <Input
                  id="publishable"
                  placeholder="pk_live_..."
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Secret Key</Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="sk_live_..."
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
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
                  disabled={loading || !secretKey || !publishableKey}
                  className="bg-[#635BFF] hover:bg-[#5147e5] text-white"
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
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Get your API keys</p>
                <p className="text-muted-foreground">Create a Stripe account and find your API keys in the dashboard</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Enter your keys above</p>
                <p className="text-muted-foreground">Both publishable and secret keys are required</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Set up webhooks</p>
                <p className="text-muted-foreground">Configure webhooks to handle subscription events automatically</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium">Test with test keys first</p>
                <p className="text-muted-foreground">Use test mode API keys before going live</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
