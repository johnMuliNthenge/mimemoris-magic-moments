import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from 'date-fns';
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
  X,
  Search,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
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
  emotion_category?: string | null;
  event_category?: string | null;
  people_tags?: string[] | null;
  sentiment_score?: number | null;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(initialSelectedDate || searchParams.get('date'));
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract unique values for filter dropdowns
  const uniqueEmotions = useMemo(() => {
    const set = new Set<string>();
    memories.forEach(m => { if (m.emotion_category) set.add(m.emotion_category); });
    return Array.from(set).sort();
  }, [memories]);

  const uniqueEvents = useMemo(() => {
    const set = new Set<string>();
    memories.forEach(m => { if (m.event_category) set.add(m.event_category); });
    return Array.from(set).sort();
  }, [memories]);

  const uniquePeople = useMemo(() => {
    const set = new Set<string>();
    memories.forEach(m => { if (m.people_tags) m.people_tags.forEach(p => set.add(p)); });
    return Array.from(set).sort();
  }, [memories]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMood, filterType, filterEmotion, filterEvent, filterPerson, selectedDate, dateFrom, dateTo, pageSize]);

  const filteredMemories = useMemo(() => {
    return memories.filter(memory => {
      const matchesSearch = !searchQuery || 
        (memory.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (memory.content?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesMood = filterMood === 'all' || memory.mood === filterMood;
      const matchesType = filterType === 'all' || memory.memory_type === filterType;
      const matchesEmotion = filterEmotion === 'all' || memory.emotion_category === filterEmotion;
      const matchesEvent = filterEvent === 'all' || memory.event_category === filterEvent;
      const matchesPerson = filterPerson === 'all' || (memory.people_tags && memory.people_tags.includes(filterPerson));
      const matchesDate = !selectedDate || memory.memory_date === selectedDate;
      const matchesDateRange = (!dateFrom || parseISO(memory.memory_date) >= dateFrom) &&
        (!dateTo || parseISO(memory.memory_date) <= dateTo);
      return matchesSearch && matchesMood && matchesType && matchesEmotion && matchesEvent && matchesPerson && matchesDate && matchesDateRange;
    });
  }, [memories, searchQuery, filterMood, filterType, filterEmotion, filterEvent, filterPerson, selectedDate, dateFrom, dateTo]);

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
    setSearchQuery('');
    setFilterMood('all');
    setFilterType('all');
    setFilterEmotion('all');
    setFilterEvent('all');
    setFilterPerson('all');
    setSelectedDate(null);
    setDateFrom(undefined);
    setDateTo(undefined);
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

  const exportCSV = useCallback(() => {
    const headers = ['Date', 'Title', 'Type', 'Mood', 'Content', 'Emotion', 'Event Category', 'People Tags'];
    const rows = filteredMemories.map(m => [
      m.memory_date,
      (m.title || '').replace(/"/g, '""'),
      m.memory_type,
      m.mood || '',
      (m.content || '').replace(/"/g, '""').replace(/\n/g, ' '),
      m.emotion_category || '',
      m.event_category || '',
      (m.people_tags || []).join('; '),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memories-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredMemories]);

  const hasActiveFilters = searchQuery || filterMood !== 'all' || filterType !== 'all' || filterEmotion !== 'all' || filterEvent !== 'all' || filterPerson !== 'all' || selectedDate !== null || dateFrom || dateTo;

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
                  <div className="flex flex-wrap gap-1 mt-2">
                    {memory.emotion_category && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{memory.emotion_category}</Badge>
                    )}
                    {memory.event_category && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{memory.event_category}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
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
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {memory.memory_type}
                  </Badge>
                  {memory.emotion_category && (
                    <Badge variant="outline" className="text-xs">{memory.emotion_category}</Badge>
                  )}
                  {memory.event_category && (
                    <Badge variant="outline" className="text-xs">{memory.event_category}</Badge>
                  )}
                  {memory.people_tags && memory.people_tags.length > 0 && (
                    <Badge variant="outline" className="text-xs">👥 {memory.people_tags.length}</Badge>
                  )}
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
        {viewMode !== 'calendar' && (
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search memories by title or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
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

            <Button
              variant={showAdvanced ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
            </Button>
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

        {/* Advanced Filters */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-lg border border-border bg-muted/30">
                {/* Emotion Category */}
                {uniqueEmotions.length > 0 && (
                  <Select value={filterEmotion} onValueChange={setFilterEmotion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Emotion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Emotions</SelectItem>
                      {uniqueEmotions.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Event Category */}
                {uniqueEvents.length > 0 && (
                  <Select value={filterEvent} onValueChange={setFilterEvent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      {uniqueEvents.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* People Tags */}
                {uniquePeople.length > 0 && (
                  <Select value={filterPerson} onValueChange={setFilterPerson}>
                    <SelectTrigger>
                      <SelectValue placeholder="Person" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All People</SelectItem>
                      {uniquePeople.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Date From */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left text-xs h-9 w-full", !dateFrom && "text-muted-foreground")}>
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                {/* Date To */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left text-xs h-9 w-full", !dateTo && "text-muted-foreground")}>
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
