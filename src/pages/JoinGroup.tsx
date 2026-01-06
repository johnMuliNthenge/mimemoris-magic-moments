import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useGroupChat } from '@/hooks/useGroupChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
}

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { joinGroupByCode } = useGroupChat();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      fetchGroupInfo();
    }
  }, [code]);

  const fetchGroupInfo = async () => {
    if (!code) return;

    const { data, error } = await supabase
      .rpc('get_group_by_invite_code', { code });

    if (error || !data || data.length === 0) {
      setError('Invalid or expired invite link');
      setLoading(false);
      return;
    }

    setGroupInfo(data[0] as GroupInfo);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!code || !user) {
      navigate('/auth');
      return;
    }

    setJoining(true);
    const result = await joinGroupByCode(code);
    setJoining(false);

    if (result.error) {
      if (result.error === 'Already a member of this group') {
        navigate('/friends');
        toast.info('You are already a member of this group');
      } else {
        toast.error(result.error);
      }
    } else {
      toast.success('Joined group successfully!');
      navigate('/friends');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Invalid Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!groupInfo) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={groupInfo.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {groupInfo.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle>{groupInfo.name}</CardTitle>
            {groupInfo.description && (
              <CardDescription>{groupInfo.description}</CardDescription>
            )}
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{groupInfo.member_count} members</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {user ? (
              <Button 
                className="w-full gap-2" 
                onClick={handleJoin} 
                disabled={joining}
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Join Group
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">
                  You need to sign in to join this group
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate(`/auth?redirect=/join-group/${code}`)}
                >
                  Sign In to Join
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
