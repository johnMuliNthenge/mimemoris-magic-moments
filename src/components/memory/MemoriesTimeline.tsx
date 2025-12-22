import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Mic, 
  Video, 
  Image,
  Calendar,
  LayoutGrid,
  List,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

interface MemoriesTimelineProps {
  memories: Memory[];
  onMemoryClick?: (memory: Memory) => void;
  onDeleteMemory?: (id: string) => void;
}

const typeIcons = {
  text: FileText,
  audio: Mic,
  video: Video,
  photo: Image,
};

const typeColors = {
  text: 'bg-primary/10 text-primary border-primary/30',
  audio: 'bg-accent/10 text-accent border-accent/30',
  video: 'bg-collab/10 text-collab border-collab/30',
  photo: 'bg-success/10 text-success border-success/30',
};

const moods = ['😊', '😢', '😍', '🤔', '😴', '🎉', '😤', '😌', '🥰', '😎'];

export function MemoriesTimeline({ memories, onMemoryClick, onDeleteMemory }: MemoriesTimelineProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredMemories = useMemo(() => {
    return memories.filter(memory => {
      const matchesMood = filterMood === 'all' || memory.mood === filterMood;
      const matchesType = filterType === 'all' || memory.memory_type === filterType;
      return matchesMood && matchesType;
    });
  }, [memories, filterMood, filterType]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Memory[]> = {};
    filteredMemories.forEach(memory => {
      const date = memory.memory_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(memory);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [filteredMemories]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const memoriesByDay = useMemo(() => {
    const map: Record<string, Memory[]> = {};
    filteredMemories.forEach(memory => {
      const dateStr = memory.memory_date;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(memory);
    });
    return map;
  }, [filteredMemories]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const clearFilters = () => {
    setFilterMood('all');
    setFilterType('all');
  };

  const hasActiveFilters = filterMood !== 'all' || filterType !== 'all';

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border p-1">
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              Timeline
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Mood Filter */}
          <Select value={filterMood} onValueChange={setFilterMood}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Mood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Moods</SelectItem>
              {moods.map(mood => (
                <SelectItem key={mood} value={mood}>
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{mood}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredMemories.length} of {memories.length} memories
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <AnimatePresence mode="popLayout">
            {groupedByDate.map(([date, dayMemories], groupIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: groupIndex * 0.05 }}
                className="relative pl-12 pb-8"
              >
                {/* Date marker */}
                <div className="absolute left-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">
                    {format(parseISO(date), 'd')}
                  </span>
                </div>

                {/* Date header */}
                <div className="mb-4">
                  <h3 className="font-semibold text-lg">
                    {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {dayMemories.length} {dayMemories.length === 1 ? 'memory' : 'memories'}
                  </p>
                </div>

                {/* Memories for this date */}
                <div className="space-y-3">
                  {dayMemories.map((memory, index) => {
                    const Icon = typeIcons[memory.memory_type];
                    return (
                      <motion.div
                        key={memory.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card 
                          className={cn(
                            "cursor-pointer hover:shadow-md transition-all border-l-4",
                            typeColors[memory.memory_type].replace('bg-', 'border-l-').split(' ')[0]
                          )}
                          onClick={() => onMemoryClick?.(memory)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={cn("p-2 rounded-lg shrink-0", typeColors[memory.memory_type])}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">
                                    {memory.title || 'Untitled Memory'}
                                  </h4>
                                  {memory.mood && (
                                    <span className="text-lg">{memory.mood}</span>
                                  )}
                                </div>
                                {memory.content && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {memory.content}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {memory.memory_type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(parseISO(memory.created_at), 'h:mm a')}
                                  </span>
                                </div>
                              </div>
                              {memory.media_url && memory.memory_type === 'photo' && (
                                <img
                                  src={memory.media_url}
                                  alt=""
                                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                                />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredMemories.length === 0 && (
            <div className="text-center py-12 pl-12">
              <p className="text-muted-foreground">No memories match your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <CardContent className="p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h3 className="font-display text-xl font-semibold">
                {format(currentDate, 'MMMM yyyy')}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before the first of the month */}
              {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {calendarDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayMemories = memoriesByDay[dateStr] || [];
                const isToday = isSameDay(day, new Date());

                return (
                  <motion.div
                    key={dateStr}
                    whileHover={{ scale: 1.05 }}
                    className={cn(
                      "aspect-square rounded-lg p-1 cursor-pointer transition-colors",
                      isToday && "bg-primary/10 ring-2 ring-primary",
                      dayMemories.length > 0 && !isToday && "bg-secondary",
                      "hover:bg-secondary/80"
                    )}
                  >
                    <div className="text-xs font-medium text-center mb-1">
                      {format(day, 'd')}
                    </div>
                    {dayMemories.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {dayMemories.slice(0, 3).map(memory => (
                          <div
                            key={memory.id}
                            className={cn(
                              "w-2 h-2 rounded-full",
                              memory.memory_type === 'text' && "bg-primary",
                              memory.memory_type === 'audio' && "bg-accent",
                              memory.memory_type === 'video' && "bg-collab",
                              memory.memory_type === 'photo' && "bg-success"
                            )}
                          />
                        ))}
                        {dayMemories.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayMemories.length - 3}</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t">
              {Object.entries(typeIcons).map(([type, Icon]) => (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    type === 'text' && "bg-primary",
                    type === 'audio' && "bg-accent",
                    type === 'video' && "bg-collab",
                    type === 'photo' && "bg-success"
                  )} />
                  <span className="capitalize text-muted-foreground">{type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
