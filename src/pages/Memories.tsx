import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Search, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/layout/AppLayout';
import { MemoriesTimeline } from '@/components/memory/MemoriesTimeline';
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

export default function MemoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const deleteMemory = async (id: string) => {
    await supabase.from('memories').delete().eq('id', id);
    setMemories(memories.filter(m => m.id !== id));
  };

  const filteredMemories = memories.filter(memory => {
    const matchesSearch = !searchQuery || 
      memory.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleMemoryClick = (memory: Memory) => {
    // Navigate to list view filtered to this memory's date
    navigate(`/memories/list?view=list&date=${memory.memory_date}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{t('my_memories')}</h1>
            <p className="text-muted-foreground">
              {memories.length} memories captured
            </p>
          </div>
          <Button 
            onClick={() => navigate('/memories/new')}
            className="gradient-warm text-primary-foreground gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('create_memory')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('search_memories')}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : memories.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <Calendar className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('no_memories')}</h2>
            <p className="text-muted-foreground mb-6">Start by creating your first memory</p>
            <Button onClick={() => navigate('/memories/new')} className="gradient-warm text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              {t('create_memory')}
            </Button>
          </motion.div>
        ) : (
          <MemoriesTimeline 
            memories={filteredMemories}
            onMemoryClick={handleMemoryClick}
            onDeleteMemory={deleteMemory}
          />
        )}
      </div>
    </AppLayout>
  );
}
