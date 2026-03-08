import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, WifiOff } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MemoriesView } from '@/components/memory/MemoriesView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { signMediaFields } from '@/lib/storage-utils';
import { cacheMemories, getCachedMemories, getAllOfflineMemories } from '@/lib/offline-store';
import { Badge } from '@/components/ui/badge';

interface Memory {
  id: string;
  memory_type: 'text' | 'audio' | 'video' | 'photo';
  memory_date: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
  mood: string | null;
  created_at: string;
  locked_until?: string | null;
  emotion_category?: string | null;
  event_category?: string | null;
  people_tags?: string[] | null;
  sentiment_score?: number | null;
}

export default function MemoriesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  
  const initialView = (searchParams.get('view') as 'list' | 'card' | 'calendar') || 'list';
  const initialDate = searchParams.get('date');

  useEffect(() => {
    if (user) {
      fetchMemories();
    }
  }, [user]);

  const fetchMemories = async () => {
    if (!navigator.onLine) {
      // Load from cache + offline store
      await loadOfflineMemories();
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('memories')
        .select('id, memory_type, memory_date, title, content, media_url, mood, created_at, locked_until, emotion_category, event_category, people_tags, sentiment_score')
        .eq('user_id', user?.id)
        .order('memory_date', { ascending: false });

      if (error) throw error;

      if (data) {
        const signedMemories = await signMediaFields(data as Memory[], ['media_url']);
        setMemories(signedMemories as Memory[]);
        setIsOfflineData(false);

        // Cache for offline viewing (without signed URLs — they expire)
        cacheMemories(data).catch(() => {});
      }
    } catch {
      // Network failure — fall back to cache
      await loadOfflineMemories();
    }
    setLoading(false);
  };

  const loadOfflineMemories = async () => {
    const cached = await getCachedMemories();
    const offlinePending = user ? await getAllOfflineMemories(user.id) : [];

    const cachedAsMemories: Memory[] = cached.map((c) => ({
      id: c.data.id,
      memory_type: c.data.memory_type,
      memory_date: c.data.memory_date,
      title: c.data.title,
      content: c.data.content,
      media_url: null, // signed URLs expired
      mood: c.data.mood,
      created_at: c.data.created_at,
      locked_until: c.data.locked_until,
      emotion_category: c.data.emotion_category,
      event_category: c.data.event_category,
      people_tags: c.data.people_tags,
      sentiment_score: c.data.sentiment_score,
    }));

    const pendingAsMemories: Memory[] = offlinePending.map((m) => ({
      id: m.id,
      memory_type: m.memory_type,
      memory_date: m.memory_date,
      title: m.title ? `📴 ${m.title}` : '📴 Pending sync',
      content: m.content,
      media_url: null,
      mood: m.mood,
      created_at: m.created_at,
      locked_until: m.locked_until,
      emotion_category: m.emotion_category,
      event_category: m.event_category,
      people_tags: m.people_tags,
      sentiment_score: m.sentiment_score,
    }));

    const all = [...pendingAsMemories, ...cachedAsMemories].sort(
      (a, b) => new Date(b.memory_date).getTime() - new Date(a.memory_date).getTime()
    );

    setMemories(all);
    setIsOfflineData(true);
  };

  const handleMemoryClick = (memory: Memory) => {
    console.log('Memory clicked:', memory.id);
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
      {isOfflineData && (
        <div className="mb-4 flex items-center gap-2 px-4">
          <Badge variant="outline" className="gap-1 text-warning border-warning/30">
            <WifiOff className="w-3 h-3" />
            Showing cached data — some media may be unavailable
          </Badge>
        </div>
      )}
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
