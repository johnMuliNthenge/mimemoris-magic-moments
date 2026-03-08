import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isPast, parseISO } from 'date-fns';
import {
  Mail,
  Lock,
  Unlock,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Send,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FutureMessage {
  id: string;
  title: string | null;
  content: string;
  deliver_at: string;
  is_delivered: boolean;
  created_at: string;
}

export default function FutureMessages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<FutureMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deliverAt, setDeliverAt] = useState('');

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('future_messages')
      .select('*')
      .eq('user_id', user!.id)
      .order('deliver_at', { ascending: true });

    if (data) {
      // Mark newly delivered ones
      const now = new Date();
      const updated = (data as FutureMessage[]).map(m => ({
        ...m,
        is_delivered: m.is_delivered || isPast(parseISO(m.deliver_at)),
      }));
      setMessages(updated);
    }
    setLoading(false);
  };

  const startEdit = (msg: FutureMessage) => {
    setEditingId(msg.id);
    setTitle(msg.title || '');
    setContent(msg.content);
    setDeliverAt(msg.deliver_at.slice(0, 16));
    setShowForm(true);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setDeliverAt('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !deliverAt) return;

    const deliverDate = new Date(deliverAt);
    if (deliverDate <= new Date()) {
      toast({ variant: 'destructive', title: t('future_msg_error_past') });
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from('future_messages').update({
        title: title.trim() || null,
        content: content.trim(),
        deliver_at: deliverDate.toISOString(),
      }).eq('id', editingId);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Message updated!' });
        resetForm();
        fetchMessages();
      }
    } else {
      const { error } = await supabase.from('future_messages').insert({
        user_id: user!.id,
        title: title.trim() || null,
        content: content.trim(),
        deliver_at: deliverDate.toISOString(),
      });

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: t('future_msg_saved') });
        resetForm();
        fetchMessages();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('future_messages').delete().eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
    toast({ title: t('delete') });
  };

  const deliveredMessages = messages.filter(m => isPast(parseISO(m.deliver_at)));
  const pendingMessages = messages.filter(m => !isPast(parseISO(m.deliver_at)));

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-3">
              <Mail className="w-8 h-8 text-primary" />
              {t('future_msg_title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('future_msg_subtitle')}</p>
          </div>
          <Button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="gradient-warm text-primary-foreground gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('future_msg_new')}
          </Button>
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Send className="w-5 h-5 text-primary" />
                    {t('future_msg_compose')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('memory_title')}</Label>
                      <Input
                        placeholder={t('future_msg_title_placeholder')}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('future_msg_message')}</Label>
                      <Textarea
                        placeholder={t('future_msg_message_placeholder')}
                        className="min-h-32"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {t('future_msg_deliver_at')}
                      </Label>
                      <Input
                        type="datetime-local"
                        value={deliverAt}
                        onChange={e => setDeliverAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                        {t('cancel')}
                      </Button>
                      <Button type="submit" className="flex-1 gradient-warm text-primary-foreground" disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {t('future_msg_send')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 && !showForm ? (
          <Card className="text-center py-16">
            <CardContent>
              <Mail className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('future_msg_empty')}</h2>
              <p className="text-muted-foreground mb-6">{t('future_msg_empty_desc')}</p>
              <Button onClick={() => setShowForm(true)} className="gradient-warm text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                {t('future_msg_new')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Pending Messages */}
            {pendingMessages.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  {t('future_msg_pending')} ({pendingMessages.length})
                </h2>
                <div className="space-y-3">
                  {pendingMessages.map(msg => (
                    <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Card className="border-l-4 border-l-muted-foreground/50 opacity-80">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-muted">
                                <Lock className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <h3 className="font-medium">{msg.title || t('future_msg_no_title')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{t('future_msg_locked_content')}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Clock className="w-3 h-3" />
                                    {t('future_msg_opens')} {format(parseISO(msg.deliver_at), 'PPP p')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(msg.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivered Messages */}
            {deliveredMessages.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Unlock className="w-5 h-5 text-primary" />
                  {t('future_msg_delivered')} ({deliveredMessages.length})
                </h2>
                <div className="space-y-3">
                  {deliveredMessages.map(msg => (
                    <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Card className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Unlock className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium">{msg.title || t('future_msg_no_title')}</h3>
                                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{msg.content}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <CalendarIcon className="w-3 h-3" />
                                    {t('future_msg_written')} {format(parseISO(msg.created_at), 'PPP')}
                                  </Badge>
                                  <Badge className="text-xs gap-1 bg-primary/20 text-primary border-0">
                                    <Clock className="w-3 h-3" />
                                    {t('future_msg_delivered_on')} {format(parseISO(msg.deliver_at), 'PPP')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(msg.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
