import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Copy, 
  Check,
  Clock,
  UserPlus,
  Video,
  Mic,
  StopCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  id: string;
  user_id: string;
  profile?: {
    full_name: string;
  };
}

export default function CollaboratePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showJoinDialog, setShowJoinDialog] = useState(searchParams.get('join') === 'true');
  const [showHostDialog, setShowHostDialog] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(60);
  const [copied, setCopied] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    checkActiveSession();
  }, [user]);

  useEffect(() => {
    if (generatedOtp && otpExpiry > 0) {
      const timer = setInterval(() => {
        setOtpExpiry(prev => {
          if (prev <= 1) {
            setGeneratedOtp('');
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [generatedOtp, otpExpiry]);

  useEffect(() => {
    if (activeSession) {
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`collaboration-${activeSession.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collaboration_participants',
            filter: `collaboration_id=eq.${activeSession.id}`,
          },
          () => {
            fetchParticipants(activeSession.id);
          }
        )
        .subscribe();

      fetchParticipants(activeSession.id);

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeSession]);

  const checkActiveSession = async () => {
    if (!user) return;

    // Check if user is host of an active session
    const { data: hostedSession } = await supabase
      .from('collaboration_sessions')
      .select('*')
      .eq('host_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (hostedSession) {
      setActiveSession(hostedSession);
      return;
    }

    // Check if user is participant in an active session
    const { data: participation } = await supabase
      .from('collaboration_participants')
      .select(`
        *,
        collaboration:collaboration_sessions(*)
      `)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (participation?.collaboration?.is_active) {
      setActiveSession(participation.collaboration);
    }
  };

  const fetchParticipants = async (sessionId: string) => {
    const { data } = await supabase
      .from('collaboration_participants')
      .select('*')
      .eq('collaboration_id', sessionId)
      .is('left_at', null);

    if (data) {
      setParticipants(data as Participant[]);
    }
  };

  const generateOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setOtpExpiry(60);
    return otp;
  };

  const startCollaboration = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 60000).toISOString();

      const { data: session, error } = await supabase
        .from('collaboration_sessions')
        .insert({
          host_user_id: user.id,
          otp_expires_at: expiresAt,
          title: `Collaboration ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single();

      if (error) throw error;

      // Store OTP in separate secure table
      await supabase.from('collaboration_otp').insert({
        collaboration_id: session.id,
        otp_code: otp,
      });

      // Add host as participant
      await supabase.from('collaboration_participants').insert({
        collaboration_id: session.id,
        user_id: user.id,
      });

      setActiveSession(session);
      setShowHostDialog(true);

      toast({
        title: 'Collaboration Started!',
        description: 'Share the OTP code with your friends.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const joinCollaboration = async () => {
    if (!user || !otpCode) return;
    setLoading(true);

    try {
      // Find session by OTP using secure RPC (doesn't expose OTP in response)
      const { data: sessions, error: findError } = await supabase.rpc('find_collaboration_by_otp', {
        _otp_code: otpCode,
      });

      if (findError) throw findError;

      const session = sessions?.[0];
      if (!session) {
        toast({
          variant: 'destructive',
          title: 'Invalid OTP',
          description: 'The OTP code is invalid or expired.',
        });
        setLoading(false);
        return;
      }

      // Join using secure RPC that validates OTP server-side
      const { error: joinError } = await supabase.rpc('join_collaboration_with_otp', {
        _collaboration_id: session.id,
        _otp_code: otpCode,
      });

      if (joinError) throw joinError;

      setActiveSession(session);
      setShowJoinDialog(false);

      toast({
        title: 'Joined Successfully!',
        description: 'You are now part of the collaboration.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    await supabase
      .from('collaboration_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', activeSession.id);

    setActiveSession(null);
    setParticipants([]);

    toast({
      title: 'Session Ended',
      description: 'The collaboration has been ended.',
    });
  };

  const copyOtp = () => {
    navigator.clipboard.writeText(generatedOtp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-3xl font-bold mb-2">{t('nav_collaborate')}</h1>
          <p className="text-muted-foreground">
            Create shared memories with friends and family in real-time
          </p>
        </motion.div>

        {!activeSession ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Start Collaboration */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full border-border shadow-soft hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl gradient-collab flex items-center justify-center mb-4">
                    <Plus className="w-6 h-6 text-collab-foreground" />
                  </div>
                  <CardTitle>{t('start_collaboration')}</CardTitle>
                  <CardDescription>
                    Host a new collaboration session and invite friends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={startCollaboration}
                    className="w-full gradient-collab text-collab-foreground"
                    disabled={loading}
                  >
                    Create Session
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Join Collaboration */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full border-border shadow-soft hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                    <UserPlus className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <CardTitle>{t('join_collaboration')}</CardTitle>
                  <CardDescription>
                    Join an existing session with an OTP code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowJoinDialog(true)}
                  >
                    Enter OTP Code
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="border-collab/50 shadow-lg">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                    <CardTitle>{t('live_now')}</CardTitle>
                  </div>
                  <Button variant="destructive" size="sm" onClick={endSession}>
                    {t('end_session')}
                  </Button>
                </div>
                <CardDescription>{activeSession.title}</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Participants */}
                  <div className="md:col-span-1 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {t('participants')} ({participants.length})
                    </h3>
                    <div className="space-y-2">
                      {participants.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                            {p.profile?.full_name?.charAt(0) || 'U'}
                          </div>
                          <span className="text-sm">{p.profile?.full_name || 'User'}</span>
                        </div>
                      ))}
                    </div>

                    {/* OTP for inviting more */}
                    {activeSession.host_user_id === user?.id && (
                      <div className="pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            generateOtp();
                            setShowHostDialog(true);
                          }}
                        >
                          Generate New OTP
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Recording Area */}
                  <div className="md:col-span-2">
                    <div className="aspect-video bg-muted rounded-xl flex flex-col items-center justify-center gap-4">
                      {isRecording ? (
                        <>
                          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-destructive" />
                          </div>
                          <p className="text-lg font-medium">Recording...</p>
                          <Button
                            variant="destructive"
                            onClick={() => setIsRecording(false)}
                            className="gap-2"
                          >
                            <StopCircle className="w-4 h-4" />
                            Stop Recording
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-muted-foreground">Ready to capture memories</p>
                          <div className="flex gap-4">
                            <Button
                              onClick={() => setIsRecording(true)}
                              className="gap-2"
                            >
                              <Video className="w-4 h-4" />
                              Record Video
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setIsRecording(true)}
                              className="gap-2"
                            >
                              <Mic className="w-4 h-4" />
                              Record Audio
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Host Dialog - Show OTP */}
        <Dialog open={showHostDialog} onOpenChange={setShowHostDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share This Code</DialogTitle>
              <DialogDescription>
                Share this OTP with friends to let them join
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 p-6 bg-muted rounded-xl">
                <span className="font-mono text-4xl font-bold tracking-widest">
                  {generatedOtp}
                </span>
                <Button variant="ghost" size="icon" onClick={copyOtp}>
                  {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {t('otp_expires', { seconds: otpExpiry })}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Join Dialog */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('join_collaboration')}</DialogTitle>
              <DialogDescription>
                Enter the 6-digit OTP code shared by the host
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">{t('enter_otp')}</Label>
                <Input
                  id="otp"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <Button
                className="w-full gradient-collab text-collab-foreground"
                onClick={joinCollaboration}
                disabled={otpCode.length !== 6 || loading}
              >
                {t('join_collaboration')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
