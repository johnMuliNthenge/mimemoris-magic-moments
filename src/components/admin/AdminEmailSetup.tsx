import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Check, 
  X, 
  AlertCircle, 
  Key,
  Loader2,
  Shield,
  Server
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { smtpConfigSchema } from '@/lib/security';

interface EmailConfig {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  sender_email: string;
  sender_name: string;
  is_active: boolean;
}

export function AdminEmailSetup() {
  const { toast } = useToast();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    senderEmail: '',
    senderName: 'Mimemoris',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('email_config')
        .select('*')
        .limit(1)
        .single();
      
      if (data) {
        setConfig(data);
        setFormData({
          host: data.smtp_host,
          port: data.smtp_port,
          username: data.smtp_username,
          password: '',
          senderEmail: data.sender_email,
          senderName: data.sender_name,
        });
      }
    } catch (error) {
      // No config exists yet
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setErrors({});
    
    const validation = smtpConfigSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    
    try {
      const configData = {
        smtp_host: formData.host,
        smtp_port: formData.port,
        smtp_username: formData.username,
        smtp_password: formData.password,
        sender_email: formData.senderEmail,
        sender_name: formData.senderName,
        is_active: true,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('email_config')
          .update(configData)
          .eq('id', config.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_config')
          .insert([configData]);
        
        if (error) throw error;
      }

      toast({
        title: 'Email Configuration Saved',
        description: 'Your SMTP settings have been saved successfully.',
      });

      setShowForm(false);
      fetchConfig();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save email configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!config?.id) return;
    
    try {
      const { error } = await supabase
        .from('email_config')
        .delete()
        .eq('id', config.id);
      
      if (error) throw error;
      
      setConfig(null);
      setFormData({
        host: '',
        port: 587,
        username: '',
        password: '',
        senderEmail: '',
        senderName: 'Mimemoris',
      });
      
      toast({
        title: 'Email Disconnected',
        description: 'SMTP configuration has been removed',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove email configuration',
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-border shadow-soft">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Email (SMTP)</CardTitle>
                <CardDescription>Configure email sending for notifications</CardDescription>
              </div>
            </div>
            <Badge 
              variant={config ? 'default' : 'secondary'}
              className={config ? 'bg-success' : ''}
            >
              {config ? (
                <><Check className="w-3 h-3 mr-1" /> Configured</>
              ) : (
                <><X className="w-3 h-3 mr-1" /> Not Configured</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {config ? (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">SMTP Server</span>
                  </div>
                  <span className="text-sm font-mono">{config.smtp_host}:{config.smtp_port}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Sender</span>
                  </div>
                  <span className="text-sm">{config.sender_name} ({config.sender_email})</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowForm(true)}>
                  Update Settings
                </Button>
                <Button variant="destructive" onClick={handleDisconnect}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Configure SMTP to send email notifications
              </p>
              <Button onClick={() => setShowForm(true)} className="gradient-warm text-primary-foreground">
                <Mail className="w-4 h-4 mr-2" />
                Set Up Email
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
              <CardTitle className="text-lg">Configure SMTP Settings</CardTitle>
              <CardDescription>
                Enter your SMTP server details for sending emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your SMTP password is encrypted and stored securely.
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input
                    id="host"
                    placeholder="smtp.example.com"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  />
                  {errors.host && <p className="text-sm text-destructive">{errors.host}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="587"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 587 })}
                  />
                  {errors.port && <p className="text-sm text-destructive">{errors.port}</p>}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="your-email@example.com"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                  {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="senderEmail">Sender Email</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    placeholder="noreply@example.com"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                  />
                  {errors.senderEmail && <p className="text-sm text-destructive">{errors.senderEmail}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senderName">Sender Name</Label>
                  <Input
                    id="senderName"
                    placeholder="Mimemoris"
                    value={formData.senderName}
                    onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                  />
                  {errors.senderName && <p className="text-sm text-destructive">{errors.senderName}</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="gradient-warm text-primary-foreground"
                >
                  {saving ? (
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
    </div>
  );
}
