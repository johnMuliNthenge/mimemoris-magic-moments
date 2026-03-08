import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isPast, parseISO, formatDistanceToNow } from 'date-fns';
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
  Edit3,
  Eye,
  AlignLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

function WordCounter({ text }: { text: string }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <AlignLeft className="w-3 h-3" />
        {words} word{words !== 1 ? 's' : ''}
      </span>
      <span>{chars} character{chars !== 1 ? 's' : ''}</span>
      {chars > 5000 && (
        <span className="text-destructive font-medium">Max 5000 characters</span>
      )}
    </div>
  );
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
  const [previewMessage, setPreviewMessage] = useState<FutureMessage | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deliverAt, setDeliverAt] = useState('');

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  // Auto-mark delivered messages on load
  useEffect(() => {
    const delivered = messages.filter(m => !m.is_delivered && isPast(parseISO(m.deliver_at)));
    if (delivered.length > 0) {
      delivered.forEach(async (msg) => {
        await supabase.from('future_messages').update({ is_delivered: true }).eq('id', msg.id);
      });
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('future_messages')
      .select('*')
      .eq('user_id', user!.id)
      .order('deliver_at', { ascending: true });

    if (data) {
      setMessages(data as FutureMessage[]);
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

    if (content.length > 5000) {
      toast({ variant: 'destructive', title: 'Message too long', description: 'Maximum 5000 characters.' });
      return;
    }

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
        toast({ title: '✅ Message updated!' });
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
    toast({ title: 'Message deleted' });
  };

  const deliveredMessages = messages.filter(m => m.is_delivered || isPast(parseISO(m.deliver_at)));
  const pendingMessages = messages.filter(m => !m.is_delivered && !isPast(parseISO(m.deliver_at)));

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

        {/* Stats bar */}
        {messages.length > 0 && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{pendingMessages.length} pending</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
              <Unlock className="w-3.5 h-3.5 text-primary" />
              <span>{deliveredMessages.length} delivered</span>
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
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
                    {editingId ? 'Edit Message' : t('future_msg_compose')}
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
                        maxLength={5000}
                        required
                      />
                      <WordCounter text={content} />
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
                      {deliverAt && new Date(deliverAt) > new Date() && (
                        <p className="text-xs text-muted-foreground">
                          ⏰ Will be delivered {formatDistanceToNow(new Date(deliverAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                        {t('cancel')}
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 gradient-warm text-primary-foreground"
                        disabled={saving || content.length > 5000}
                      >
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingId ? t('save') : t('future_msg_send')}
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
                      <Card className="border-l-4 border-l-muted-foreground/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-muted">
                                <Lock className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <h3 className="font-medium">{msg.title || t('future_msg_no_title')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{t('future_msg_locked_content')}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Clock className="w-3 h-3" />
                                    {t('future_msg_opens')} {format(parseISO(msg.deliver_at), 'PPP p')}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {formatDistanceToNow(parseISO(msg.deliver_at), { addSuffix: true })}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => startEdit(msg)} title="Edit">
                                <Edit3 className="w-4 h-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(msg.id)} title="Delete">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
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
                                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                                  {msg.content}
                                </p>
                                {msg.content.length > 200 && (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="px-0 h-auto text-xs"
                                    onClick={() => setPreviewMessage(msg)}
                                  >
                                    Read full message
                                  </Button>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setPreviewMessage(msg)} title="View">
                                <Eye className="w-4 h-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(msg.id)} title="Delete">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
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

        {/* Full Message Preview Dialog */}
        <Dialog open={!!previewMessage} onOpenChange={(open) => !open && setPreviewMessage(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                {previewMessage?.title || 'Your Message'}
              </DialogTitle>
            </DialogHeader>
            {previewMessage && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    Written {format(parseISO(previewMessage.created_at), 'PPP')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Delivered {format(parseISO(previewMessage.deliver_at), 'PPP')}
                  </Badge>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{previewMessage.content}</p>
                </div>
                <WordCounter text={previewMessage.content} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
