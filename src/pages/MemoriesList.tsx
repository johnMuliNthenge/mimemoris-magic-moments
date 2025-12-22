import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MemoriesView } from '@/components/memory/MemoriesView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Memory {
  id: string;
  memory_type: 'text' | 'audio' | 'video' | 'photo';
  memory_date: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
  mood: string | null;
  created_at: string;
}

export default function MemoriesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const initialView = (searchParams.get('view') as 'list' | 'card' | 'calendar') || 'list';
  const initialDate = searchParams.get('date');

  useEffect(() => {
    if (user) {
      fetchMemories();
    }
  }, [user]);

  const fetchMemories = async () => {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', user?.id)
      .order('memory_date', { ascending: false });

    if (data) {
      setMemories(data as Memory[]);
    }
    setLoading(false);
  };

  const handleMemoryClick = (memory: Memory) => {
    navigate(`/memories/${memory.id}/edit`);
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
      <MemoriesView
        memories={memories}
        onMemoryClick={handleMemoryClick}
        onBack={handleBack}
        title="All Memories"
        showBackButton={true}
        initialView={initialView}
        selectedDate={initialDate}
      />
    </AppLayout>
  );
}
