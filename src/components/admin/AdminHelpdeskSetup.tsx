import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageCircle, Save, Loader2 } from 'lucide-react';

export function AdminHelpdeskSetup() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('helpdesk_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWhatsappNumber(data.whatsapp_number);
        setIsActive(data.is_active ?? true);
        setExistingId(data.id);
      }
    } catch (err) {
      console.error('Error fetching helpdesk config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!whatsappNumber.trim()) {
      toast.error('Please enter a WhatsApp number');
      return;
    }

    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from('helpdesk_config')
          .update({
            whatsapp_number: whatsappNumber.trim(),
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('helpdesk_config')
          .insert({
            whatsapp_number: whatsappNumber.trim(),
            is_active: isActive,
          })
          .select()
          .single();
        if (error) throw error;
        setExistingId(data.id);
      }
      toast.success('Help desk settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Help Desk Setup
        </CardTitle>
        <CardDescription>
          Configure the WhatsApp number where user help requests will be sent.
          Users will see a floating help button to contact support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="whatsapp-number">WhatsApp Number</Label>
          <Input
            id="whatsapp-number"
            placeholder="e.g. 254712345678 (with country code, no +)"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter the full number with country code but without the + sign. Example: 254712345678
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Help Desk</Label>
            <p className="text-xs text-muted-foreground">Show the floating help button to users</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
