import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Users, Loader2, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface Collaboration {
  id: string;
  title: string | null;
  session_date: string | null;
  is_active: boolean;
  created_at: string;
  host_user_id: string;
  participant_count?: number;
}

export default function CollaborationsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCollaborations();
    }
  }, [user]);

  const fetchCollaborations = async () => {
    // Fetch collaborations where user is host or participant
    const { data: hostCollabs, error: hostError } = await supabase
      .from('collaboration_sessions')
      .select('*')
      .eq('host_user_id', user?.id)
      .order('created_at', { ascending: false });

    const { data: participantData, error: partError } = await supabase
      .from('collaboration_participants')
      .select('collaboration_id')
      .eq('user_id', user?.id);

    let allCollabIds = (hostCollabs || []).map(c => c.id);
    
    if (participantData) {
      const participantCollabIds = participantData.map(p => p.collaboration_id);
      allCollabIds = [...new Set([...allCollabIds, ...participantCollabIds])];
    }

    // Get full details for participant collabs
    if (participantData && participantData.length > 0) {
      const { data: participantCollabs } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .in('id', participantData.map(p => p.collaboration_id));
      
      if (participantCollabs) {
        const existingIds = new Set((hostCollabs || []).map(c => c.id));
        const newCollabs = participantCollabs.filter(c => !existingIds.has(c.id));
        setCollaborations([...(hostCollabs || []), ...newCollabs]);
      } else {
        setCollaborations(hostCollabs || []);
      }
    } else {
      setCollaborations(hostCollabs || []);
    }

    setLoading(false);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-display font-bold">Collaborations</h2>
            <p className="text-sm text-muted-foreground">
              {collaborations.length} {collaborations.length === 1 ? 'collaboration' : 'collaborations'}
            </p>
          </div>
          <Button onClick={() => navigate('/collaborate')} className="gradient-collab text-collab-foreground gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        {collaborations.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No collaborations yet</h3>
              <p className="text-muted-foreground mb-4">Start creating memories with friends and family</p>
              <Button onClick={() => navigate('/collaborate')} className="gradient-collab text-collab-foreground">
                Start Collaboration
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collaborations.map((collab, index) => (
              <motion.div
                key={collab.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all h-full"
                  onClick={() => navigate(`/collaborate?id=${collab.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg truncate">
                        {collab.title || 'Untitled Collaboration'}
                      </CardTitle>
                      <Badge variant={collab.is_active ? 'default' : 'secondary'}>
                        {collab.is_active ? 'Active' : 'Ended'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {collab.session_date 
                          ? format(new Date(collab.session_date), 'MMM d, yyyy')
                          : 'No date'}
                      </div>
                      {collab.host_user_id === user?.id && (
                        <Badge variant="outline" className="text-xs">Host</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
