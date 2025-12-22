import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
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
  ArrowLeft,
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

interface MemoriesViewProps {
  memories: Memory[];
  onMemoryClick?: (memory: Memory) => void;
  onDeleteMemory?: (id: string) => void;
  onBack?: () => void;
  title?: string;
  showBackButton?: boolean;
  initialView?: 'list' | 'card' | 'calendar';
  selectedDate?: string | null;
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

export function MemoriesView({ 
  memories, 
  onMemoryClick, 
  onDeleteMemory,
  onBack,
  title = "Memories",
  showBackButton = true,
  initialView = 'list',
  selectedDate: initialSelectedDate
}: MemoriesViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'calendar'>(initialView);
  const [filterMood, setFilterMood] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(initialSelectedDate || searchParams.get('date'));
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMood, filterType, selectedDate, pageSize]);

  const filteredMemories = useMemo(() => {
    return memories.filter(memory => {
      const matchesMood = filterMood === 'all' || memory.mood === filterMood;
      const matchesType = filterType === 'all' || memory.memory_type === filterType;
      const matchesDate = !selectedDate || memory.memory_date === selectedDate;
      return matchesMood && matchesType && matchesDate;
    });
  }, [memories, filterMood, filterType, selectedDate]);

  // Pagination
  const totalPages = Math.ceil(filteredMemories.length / pageSize);
  const paginatedMemories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMemories.slice(start, start + pageSize);
  }, [filteredMemories, currentPage, pageSize]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const memoriesByDay = useMemo(() => {
    const map: Record<string, Memory[]> = {};
    memories.forEach(memory => {
      const dateStr = memory.memory_date;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(memory);
    });
    return map;
  }, [memories]);

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
    setSelectedDate(null);
    setSearchParams({});
  };

  const handleDateClick = (dateStr: string) => {
    const dayMemories = memoriesByDay[dateStr];
    if (dayMemories && dayMemories.length > 0) {
      setSelectedDate(dateStr);
      setViewMode('list');
      setSearchParams({ date: dateStr });
    }
  };

  const handleBack = () => {
    if (selectedDate) {
      setSelectedDate(null);
      setViewMode('calendar');
      setSearchParams({});
    } else if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const hasActiveFilters = filterMood !== 'all' || filterType !== 'all' || selectedDate !== null;

  const renderMemoryCard = (memory: Memory, index: number) => {
    const Icon = typeIcons[memory.memory_type];
    
    if (viewMode === 'card') {
      return (
        <motion.div
          key={memory.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all h-full overflow-hidden group"
            onClick={() => onMemoryClick?.(memory)}
          >
            {memory.media_url && memory.memory_type === 'photo' && (
              <div className="aspect-video overflow-hidden">
                <img
                  src={memory.media_url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg shrink-0", typeColors[memory.memory_type])}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate text-sm">
                      {memory.title || 'Untitled Memory'}
                    </h4>
                    {memory.mood && (
                      <span className="text-base">{memory.mood}</span>
                    )}
                  </div>
                  {memory.content && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {memory.content}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(parseISO(memory.memory_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={memory.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
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
                    {format(parseISO(memory.memory_date), 'MMM d, yyyy')} • {format(parseISO(memory.created_at), 'h:mm a')}
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
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-display font-bold">
            {selectedDate ? format(parseISO(selectedDate), 'MMMM d, yyyy') : title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filteredMemories.length} {filteredMemories.length === 1 ? 'memory' : 'memories'}
            {selectedDate && ' for this date'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              List
            </Button>
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="gap-2"
            >
              <LayoutGrid className="w-4 h-4" />
              Card
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setViewMode('calendar'); setSelectedDate(null); }}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Page Size */}
          {viewMode !== 'calendar' && (
            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          )}

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

      {/* List/Card View */}
      {(viewMode === 'list' || viewMode === 'card') && (
        <>
          <div className={cn(
            viewMode === 'card' 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          )}>
            <AnimatePresence mode="popLayout">
              {paginatedMemories.map((memory, index) => renderMemoryCard(memory, index))}
            </AnimatePresence>
          </div>

          {filteredMemories.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No memories found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters}>Clear filters</Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
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
                const hasMemories = dayMemories.length > 0;

                return (
                  <motion.div
                    key={dateStr}
                    whileHover={hasMemories ? { scale: 1.05 } : {}}
                    onClick={() => handleDateClick(dateStr)}
                    className={cn(
                      "aspect-square rounded-lg p-1 transition-colors",
                      isToday && "bg-primary/10 ring-2 ring-primary",
                      hasMemories && !isToday && "bg-secondary cursor-pointer",
                      hasMemories && "hover:bg-secondary/80 hover:shadow-md",
                      !hasMemories && "opacity-50"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-medium text-center mb-1",
                      hasMemories && "text-primary font-bold underline cursor-pointer"
                    )}>
                      {format(day, 'd')}
                    </div>
                    {hasMemories && (
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
              {Object.entries(typeIcons).map(([type]) => (
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

            <p className="text-center text-sm text-muted-foreground mt-4">
              Click on a date with memories to view them
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
