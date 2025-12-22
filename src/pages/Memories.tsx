import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  FileText,
  Mic,
  Video,
  Image,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

const typeIcons = {
  text: FileText,
  audio: Mic,
  video: Video,
  photo: Image,
};

const typeColors = {
  text: 'bg-primary/10 text-primary',
  audio: 'bg-accent/10 text-accent',
  video: 'bg-collab/10 text-collab',
  photo: 'bg-success/10 text-success',
};

export default function MemoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

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
    const matchesSearch = memory.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || memory.memory_type === filterType;
    return matchesSearch && matchesType;
  });

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

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('search_memories')}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="text">{t('memory_type_text')}</SelectItem>
              <SelectItem value="audio">{t('memory_type_audio')}</SelectItem>
              <SelectItem value="video">{t('memory_type_video')}</SelectItem>
              <SelectItem value="photo">{t('memory_type_photo')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Memories Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-3 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredMemories.length === 0 ? (
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredMemories.map((memory, index) => {
                const Icon = typeIcons[memory.memory_type];
                return (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="group hover:shadow-lg transition-all cursor-pointer border-border">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-2 rounded-lg ${typeColors[memory.memory_type]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/memories/${memory.id}/edit`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                {t('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteMemory(memory.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {memory.media_url && memory.memory_type === 'photo' && (
                          <div className="mb-4 -mx-2 -mt-2 rounded-lg overflow-hidden">
                            <img 
                              src={memory.media_url} 
                              alt={memory.title || 'Memory'} 
                              className="w-full h-32 object-cover"
                            />
                          </div>
                        )}

                        <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                          {memory.title || 'Untitled Memory'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {format(new Date(memory.memory_date), 'MMMM d, yyyy')}
                        </p>
                        {memory.content && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {memory.content}
                          </p>
                        )}
                        {memory.mood && (
                          <div className="mt-4 flex items-center gap-2">
                            <span className="text-2xl">{memory.mood}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
