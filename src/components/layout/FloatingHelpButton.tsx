import { useState, useEffect } from 'react';
import { MessageCircle, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function FloatingHelpButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [userName, setUserName] = useState('Unknown User');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch helpdesk config
      const { data: config } = await supabase
        .from('helpdesk_config')
        .select('whatsapp_number')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (config) {
        setWhatsappNumber(config.whatsapp_number);
      }

      // Fetch user profile name
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        } else if (user.email) {
          setUserName(user.email);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Don't render if no helpdesk is configured
  if (loading || !whatsappNumber) return null;

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Please describe your issue');
      return;
    }

    const fullMessage = `🆘 *Help Request*\n\n👤 *User:* ${userName}\n📧 *Email:* ${user?.email || 'N/A'}\n\n📝 *Message:*\n${message.trim()}`;
    const encoded = encodeURIComponent(fullMessage);
    const url = `https://wa.me/${whatsappNumber}?text=${encoded}`;

    window.open(url, '_blank');
    setMessage('');
    setOpen(false);
    toast.success('Redirecting to WhatsApp...');
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Need Help?
            </DialogTitle>
            <DialogDescription>
              Describe your issue and we'll assist you via WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Sending as: <span className="font-medium text-foreground">{userName}</span>
            </div>

            <Textarea
              placeholder="Describe your issue or question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
            />

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} className="gap-2">
                <Send className="w-4 h-4" />
                Send via WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
