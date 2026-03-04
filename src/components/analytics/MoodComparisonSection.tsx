import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  format, parseISO, isWithinInterval, differenceInDays,
  subMonths, subWeeks, startOfDay, endOfDay,
} from 'date-fns';
import { CalendarIcon, ArrowLeftRight, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MOOD_MAP: Record<string, { label: string; score: number; color: string }> = {
  '😊': { label: 'Happy', score: 8, color: 'hsl(48, 90%, 55%)' },
  '😢': { label: 'Sad', score: 2, color: 'hsl(210, 60%, 55%)' },
  '😍': { label: 'Love', score: 9, color: 'hsl(340, 70%, 55%)' },
  '🤔': { label: 'Thoughtful', score: 5, color: 'hsl(270, 50%, 55%)' },
  '😴': { label: 'Tired', score: 3, color: 'hsl(220, 30%, 55%)' },
  '🎉': { label: 'Excited', score: 10, color: 'hsl(30, 90%, 55%)' },
  '😤': { label: 'Frustrated', score: 2, color: 'hsl(0, 70%, 55%)' },
  '😌': { label: 'Calm', score: 7, color: 'hsl(160, 50%, 50%)' },
  '🥰': { label: 'Adored', score: 9, color: 'hsl(350, 80%, 60%)' },
  '😎': { label: 'Confident', score: 8, color: 'hsl(200, 60%, 50%)' },
  '😰': { label: 'Anxious', score: 2, color: 'hsl(40, 70%, 50%)' },
  '😡': { label: 'Angry', score: 1, color: 'hsl(0, 80%, 50%)' },
  '🥺': { label: 'Vulnerable', score: 3, color: 'hsl(280, 40%, 60%)' },
  '😐': { label: 'Neutral', score: 5, color: 'hsl(0, 0%, 60%)' },
};

interface Memory {
  id: string;
  memory_type: string;
  memory_date: string;
  mood: string | null;
  ai_analysis: any;
  created_at: string;
  title: string | null;
  content: string | null;
  emotion_category: string | null;
  sentiment_score: number | null;
  event_category: string | null;
}

interface MoodComparisonSectionProps {
  memories: Memory[];
}

interface PeriodStats {
  avgScore: number;
  totalMemories: number;
  moodedMemories: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topMood: { emoji: string; label: string; count: number } | null;
  topEmotion: string | null;
  sentimentBreakdown: Record<string, number>;
  moodDistribution: Record<string, number>;
  emotionCounts: Record<string, number>;
}

function computeStats(mems: Memory[]): PeriodStats {
  const moodedMems = mems.filter((m) => m.mood && MOOD_MAP[m.mood]);
  const scores = moodedMems.map((m) => MOOD_MAP[m.mood!].score);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const moodCounts: Record<string, number> = {};
  moodedMems.forEach((m) => {
    moodCounts[m.mood!] = (moodCounts[m.mood!] || 0) + 1;
  });
  const topMoodEntry = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  const sentimentBreakdown: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  const emotionCounts: Record<string, number> = {};
  mems.forEach((m) => {
    if (m.ai_analysis && typeof m.ai_analysis === 'object') {
      const a = m.ai_analysis as any;
      if (a.sentiment && sentimentBreakdown[a.sentiment] !== undefined) {
        sentimentBreakdown[a.sentiment]++;
      }
      if (Array.isArray(a.emotions)) {
        a.emotions.forEach((e: string) => {
          const key = e.charAt(0).toUpperCase() + e.slice(1).toLowerCase();
          emotionCounts[key] = (emotionCounts[key] || 0) + 1;
        });
      }
    }
  });

  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    avgScore: Math.round(avg * 10) / 10,
    totalMemories: mems.length,
    moodedMemories: moodedMems.length,
    positiveCount: moodedMems.filter((m) => MOOD_MAP[m.mood!].score >= 7).length,
    negativeCount: moodedMems.filter((m) => MOOD_MAP[m.mood!].score <= 3).length,
    neutralCount: moodedMems.filter((m) => { const s = MOOD_MAP[m.mood!].score; return s > 3 && s < 7; }).length,
    topMood: topMoodEntry ? { emoji: topMoodEntry[0], label: MOOD_MAP[topMoodEntry[0]]?.label || topMoodEntry[0], count: topMoodEntry[1] } : null,
    topEmotion,
    sentimentBreakdown,
    moodDistribution: moodCounts,
    emotionCounts,
  };
}

const PRESETS = [
  { label: 'This vs Last Week', id: 'week' },
  { label: 'This vs Last Month', id: 'month' },
  { label: 'Last 3 vs Prior 3 Months', id: '3m' },
  { label: 'Custom', id: 'custom' },
] as const;

export function MoodComparisonSection({ memories }: MoodComparisonSectionProps) {
  const [preset, setPreset] = useState<string>('month');
  const [periodAStart, setPeriodAStart] = useState<Date | undefined>(undefined);
  const [periodAEnd, setPeriodAEnd] = useState<Date | undefined>(undefined);
  const [periodBStart, setPeriodBStart] = useState<Date | undefined>(undefined);
  const [periodBEnd, setPeriodBEnd] = useState<Date | undefined>(undefined);

  const { rangeA, rangeB } = useMemo(() => {
    const now = new Date();
    if (preset === 'week') {
      return {
        rangeA: { start: subWeeks(now, 1), end: now, label: 'This Week' },
        rangeB: { start: subWeeks(now, 2), end: subWeeks(now, 1), label: 'Last Week' },
      };
    } else if (preset === 'month') {
      return {
        rangeA: { start: subMonths(now, 1), end: now, label: 'This Month' },
        rangeB: { start: subMonths(now, 2), end: subMonths(now, 1), label: 'Last Month' },
      };
    } else if (preset === '3m') {
      return {
        rangeA: { start: subMonths(now, 3), end: now, label: 'Last 3 Months' },
        rangeB: { start: subMonths(now, 6), end: subMonths(now, 3), label: 'Prior 3 Months' },
      };
    } else {
      return {
        rangeA: {
          start: periodAStart || subMonths(now, 1),
          end: periodAEnd || now,
          label: periodAStart && periodAEnd ? `${format(periodAStart, 'MMM d')} – ${format(periodAEnd, 'MMM d')}` : 'Period A',
        },
        rangeB: {
          start: periodBStart || subMonths(now, 2),
          end: periodBEnd || subMonths(now, 1),
          label: periodBStart && periodBEnd ? `${format(periodBStart, 'MMM d')} – ${format(periodBEnd, 'MMM d')}` : 'Period B',
        },
      };
    }
  }, [preset, periodAStart, periodAEnd, periodBStart, periodBEnd]);

  const memoriesA = useMemo(() =>
    memories.filter((m) => {
      const d = parseISO(m.memory_date);
      return isWithinInterval(d, { start: startOfDay(rangeA.start), end: endOfDay(rangeA.end) });
    }), [memories, rangeA]);

  const memoriesB = useMemo(() =>
    memories.filter((m) => {
      const d = parseISO(m.memory_date);
      return isWithinInterval(d, { start: startOfDay(rangeB.start), end: endOfDay(rangeB.end) });
    }), [memories, rangeB]);

  const statsA = useMemo(() => computeStats(memoriesA), [memoriesA]);
  const statsB = useMemo(() => computeStats(memoriesB), [memoriesB]);

  const scoreDiff = Math.round((statsA.avgScore - statsB.avgScore) * 10) / 10;

  // Merged mood distribution for side-by-side bar chart
  const moodComparisonData = useMemo(() => {
    const allMoods = new Set([...Object.keys(statsA.moodDistribution), ...Object.keys(statsB.moodDistribution)]);
    return Array.from(allMoods).map((mood) => ({
      mood,
      label: MOOD_MAP[mood]?.label || mood,
      periodA: statsA.moodDistribution[mood] || 0,
      periodB: statsB.moodDistribution[mood] || 0,
    })).sort((a, b) => (b.periodA + b.periodB) - (a.periodA + a.periodB));
  }, [statsA, statsB]);

  // Emotion radar comparison
  const emotionRadarData = useMemo(() => {
    const allEmotions = new Set([...Object.keys(statsA.emotionCounts), ...Object.keys(statsB.emotionCounts)]);
    return Array.from(allEmotions)
      .map((e) => ({
        emotion: e,
        periodA: statsA.emotionCounts[e] || 0,
        periodB: statsB.emotionCounts[e] || 0,
      }))
      .sort((a, b) => (b.periodA + b.periodB) - (a.periodA + a.periodB))
      .slice(0, 8);
  }, [statsA, statsB]);

  // Sentiment comparison
  const sentimentComparisonData = useMemo(() => {
    return ['positive', 'negative', 'neutral', 'mixed']
      .filter((s) => (statsA.sentimentBreakdown[s] || 0) + (statsB.sentimentBreakdown[s] || 0) > 0)
      .map((s) => ({
        sentiment: s.charAt(0).toUpperCase() + s.slice(1),
        periodA: statsA.sentimentBreakdown[s] || 0,
        periodB: statsB.sentimentBreakdown[s] || 0,
      }));
  }, [statsA, statsB]);

  if (memories.filter((m) => m.mood).length < 3) return null;

  const StatCard = ({ label, valueA, valueB, suffix = '' }: { label: string; valueA: string | number; valueB: string | number; suffix?: string }) => (
    <div className="p-3 rounded-lg bg-muted/50 border border-border">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="text-center flex-1">
          <p className="text-lg font-bold text-primary">{valueA}{suffix}</p>
          <p className="text-[10px] text-muted-foreground">{rangeA.label}</p>
        </div>
        <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="text-center flex-1">
          <p className="text-lg font-bold text-accent">{valueB}{suffix}</p>
          <p className="text-[10px] text-muted-foreground">{rangeB.label}</p>
        </div>
      </div>
    </div>
  );

  const DatePicker = ({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start text-left text-xs h-8", !value && "text-muted-foreground")}>
          <CalendarIcon className="w-3 h-3 mr-1" />
          {value ? format(value, 'MMM d, yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={(date) => date > new Date()}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
          Mood Period Comparison
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare your emotional patterns across two time periods
        </p>
      </div>

      {/* Preset Selector */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={preset === p.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreset(p.id)}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary">Period A</p>
                <div className="flex gap-2">
                  <DatePicker value={periodAStart} onChange={setPeriodAStart} label="Start" />
                  <DatePicker value={periodAEnd} onChange={setPeriodAEnd} label="End" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-accent">Period B</p>
                <div className="flex gap-2">
                  <DatePicker value={periodBStart} onChange={setPeriodBStart} label="Start" />
                  <DatePicker value={periodBEnd} onChange={setPeriodBEnd} label="End" />
                </div>
              </div>
            </div>
          )}

          {/* Period labels */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>{rangeA.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-accent" />
              <span>{rangeB.label}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Difference Banner */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <Card className={cn(
          "border-2",
          scoreDiff > 0 ? "border-success/30 bg-success/5" : scoreDiff < 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"
        )}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mood Score Change</p>
              <div className="flex items-center gap-2 mt-1">
                {scoreDiff > 0 ? (
                  <TrendingUp className="w-6 h-6 text-success" />
                ) : scoreDiff < 0 ? (
                  <TrendingDown className="w-6 h-6 text-destructive" />
                ) : (
                  <Minus className="w-6 h-6 text-muted-foreground" />
                )}
                <span className={cn(
                  "text-3xl font-bold",
                  scoreDiff > 0 ? "text-success" : scoreDiff < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                </span>
                <span className="text-sm text-muted-foreground">/10</span>
              </div>
            </div>
            <div className="text-right text-sm">
              <p><span className="font-semibold text-primary">{statsA.avgScore}</span> → <span className="font-semibold text-accent">{statsB.avgScore}</span></p>
              <p className="text-xs text-muted-foreground mt-1">
                {scoreDiff > 0.5 ? "Your mood improved! 🎉" : scoreDiff < -0.5 ? "Your mood dipped. Take care of yourself 💛" : "Mood stayed consistent 😌"}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stat Comparison Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Memories" valueA={statsA.totalMemories} valueB={statsB.totalMemories} />
        <StatCard label="Avg Mood Score" valueA={statsA.avgScore} valueB={statsB.avgScore} suffix="/10" />
        <StatCard label="Positive Moods" valueA={statsA.positiveCount} valueB={statsB.positiveCount} />
        <StatCard
          label="Top Mood"
          valueA={statsA.topMood ? `${statsA.topMood.emoji} ${statsA.topMood.label}` : '—'}
          valueB={statsB.topMood ? `${statsB.topMood.emoji} ${statsB.topMood.label}` : '—'}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Mood Distribution Comparison Bar Chart */}
        {moodComparisonData.length > 0 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border shadow-soft h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Mood Distribution
                </CardTitle>
                <CardDescription>Side-by-side mood comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={moodComparisonData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip content={({ active, payload, label }) => {
                      if (active && payload?.length) {
                        return (
                          <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-sm">
                            <p className="font-semibold">{label}</p>
                            <p style={{ color: 'hsl(var(--primary))' }}>{rangeA.label}: {payload[0]?.value}</p>
                            <p style={{ color: 'hsl(var(--accent))' }}>{rangeB.label}: {payload[1]?.value}</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="periodA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={rangeA.label} />
                    <Bar dataKey="periodB" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name={rangeB.label} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Emotion Radar Comparison */}
        {emotionRadarData.length > 0 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-border shadow-soft h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  Emotion Radar
                </CardTitle>
                <CardDescription>AI-detected emotions overlay</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={emotionRadarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis tick={false} />
                    <Radar dataKey="periodA" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} name={rangeA.label} />
                    <Radar dataKey="periodB" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} name={rangeB.label} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Sentiment Comparison */}
      {sentimentComparisonData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg">Sentiment Breakdown</CardTitle>
              <CardDescription>How overall sentiment shifted between periods</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sentimentComparisonData} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="sentiment" type="category" tick={{ fontSize: 12 }} width={70} />
                  <RechartsTooltip />
                  <Bar dataKey="periodA" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={rangeA.label} />
                  <Bar dataKey="periodB" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name={rangeB.label} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
