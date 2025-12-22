import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parse, isValid } from 'date-fns';
import { Search, Calendar, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Memory {
  id: string;
  memory_type: 'text' | 'audio' | 'video' | 'photo';
  memory_date: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  created_at: string;
}

interface MemoryQueryProps {
  onMemoryFound?: (memory: Memory) => void;
}

export function MemoryQuery({ onMemoryFound }: MemoryQueryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ memory: Memory | null; summary: string } | null>(null);

  const extractDateFromQuestion = (text: string): Date | null => {
    // Try to extract date patterns like "Sep 3, 2023", "3 sep 2023", "2023-09-03", etc.
    const patterns = [
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          let dateStr = match[0];
          const parsed = new Date(dateStr);
          if (isValid(parsed)) return parsed;
        } catch {
          continue;
        }
      }
    }
    return null;
  };

  const queryMemoryByDate = async (date: Date) => {
    if (!user) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .eq('memory_date', dateStr)
      .maybeSingle();

    if (error) {
      console.error('Error fetching memory:', error);
      return null;
    }

    return data as Memory | null;
  };

  const generateSummary = (memory: Memory, queryType: 'feeling' | 'doing' | 'general'): string => {
    const dateFormatted = format(new Date(memory.memory_date), 'MMMM d, yyyy');
    const moodEmoji = memory.mood || '';
    
    if (queryType === 'feeling') {
      if (memory.mood) {
        return `On ${dateFormatted}, you were feeling ${moodEmoji}. ${memory.content ? `You wrote: "${memory.content.substring(0, 150)}${memory.content.length > 150 ? '...' : ''}"` : ''}`;
      }
      return `On ${dateFormatted}, you captured a memory but didn't record a specific mood. ${memory.content ? `Your entry: "${memory.content.substring(0, 150)}${memory.content.length > 150 ? '...' : ''}"` : ''}`;
    }
    
    if (queryType === 'doing') {
      const typeDescriptions = {
        text: 'wrote a journal entry',
        audio: 'recorded an audio memory',
        video: 'captured a video memory',
        photo: 'took a photo memory'
      };
      return `On ${dateFormatted}, you ${typeDescriptions[memory.memory_type]}${memory.title ? ` titled "${memory.title}"` : ''}. ${memory.content ? `Details: "${memory.content.substring(0, 150)}${memory.content.length > 150 ? '...' : ''}"` : ''}`;
    }

    return `On ${dateFormatted}${memory.mood ? ` (feeling ${moodEmoji})` : ''}, you ${memory.memory_type === 'text' ? 'wrote' : 'captured'} a memory${memory.title ? ` titled "${memory.title}"` : ''}. ${memory.content ? `"${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''}"` : ''}`;
  };

  const determineQueryType = (text: string): 'feeling' | 'doing' | 'general' => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('feeling') || lowerText.includes('felt') || lowerText.includes('mood') || lowerText.includes('emotion')) {
      return 'feeling';
    }
    if (lowerText.includes('doing') || lowerText.includes('did') || lowerText.includes('happen') || lowerText.includes('activity')) {
      return 'doing';
    }
    return 'general';
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setLoading(true);
    setResult(null);

    try {
      const memory = await queryMemoryByDate(date);
      if (memory) {
        const summary = generateSummary(memory, 'general');
        setResult({ memory, summary });
        onMemoryFound?.(memory);
      } else {
        setResult({ memory: null, summary: `No memory found for ${format(date, 'MMMM d, yyyy')}.` });
      }
    } catch (error) {
      toast.error('Failed to query memory');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const extractedDate = extractDateFromQuestion(question);
      if (!extractedDate) {
        setResult({ memory: null, summary: "I couldn't find a date in your question. Please include a specific date like 'Sep 3, 2023' or use the calendar to select a date." });
        setLoading(false);
        return;
      }

      setSelectedDate(extractedDate);
      const memory = await queryMemoryByDate(extractedDate);
      const queryType = determineQueryType(question);

      if (memory) {
        const summary = generateSummary(memory, queryType);
        setResult({ memory, summary });
        onMemoryFound?.(memory);
      } else {
        setResult({ memory: null, summary: `No memory found for ${format(extractedDate, 'MMMM d, yyyy')}. Try another date!` });
      }
    } catch (error) {
      toast.error('Failed to query memory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-secondary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" />
          Query Your Memories
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="question" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="question" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Ask a Question
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="w-4 h-4" />
              Pick a Date
            </TabsTrigger>
          </TabsList>

          <TabsContent value="question" className="space-y-4">
            <form onSubmit={handleQuestionSubmit} className="flex gap-2">
              <Input
                placeholder="What was I feeling on Sep 3, 2023?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !question.trim()}>
                <Search className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Try: "What did I do on Jan 15, 2024?" or "How was I feeling on Dec 25, 2023?"
            </p>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <div className="flex justify-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Select a date to query"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="mt-4 p-4 rounded-lg bg-secondary/50 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        )}

        {result && !loading && (
          <div className={cn(
            "mt-4 p-4 rounded-lg",
            result.memory ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"
          )}>
            <p className="text-sm leading-relaxed">{result.summary}</p>
            {result.memory && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 p-0 h-auto text-primary"
                onClick={() => onMemoryFound?.(result.memory!)}
              >
                View full memory →
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
