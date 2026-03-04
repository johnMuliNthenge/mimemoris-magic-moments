import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Activity, CalendarDays, Layers, Target,
  ExternalLink, ChevronDown,
} from 'lucide-react';
import {
  format, parseISO, subWeeks, startOfWeek, endOfWeek,
  eachWeekOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth,
  getDay,
} from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'hsl(142, 70%, 45%)',
  negative: 'hsl(0, 70%, 55%)',
  neutral: 'hsl(220, 15%, 55%)',
  mixed: 'hsl(270, 50%, 55%)',
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

interface MoodTrendsSectionProps {
  memories: Memory[];
}

export function MoodTrendsSection({ memories }: MoodTrendsSectionProps) {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'8w' | '12w' | '6m' | '12m'>('12w');

  const navigateToMemoriesByMonth = (fullMonth: string) => {
    navigate(`/memories?date=${fullMonth}-01`);
  };

  // Weekly mood trend
  const weeklyTrend = useMemo(() => {
    const weeksBack = timeRange === '8w' ? 8 : timeRange === '12w' ? 12 : timeRange === '6m' ? 26 : 52;
    const start = startOfWeek(subWeeks(new Date(), weeksBack - 1));
    const end = endOfWeek(new Date());
    const weeks = eachWeekOfInterval({ start, end });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart);
      const weekMemories = memories.filter((m) => {
        const d = parseISO(m.memory_date);
        return d >= weekStart && d <= weekEnd && m.mood;
      });
      const scores = weekMemories.map((m) => MOOD_MAP[m.mood!]?.score || 5);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const positive = weekMemories.filter(m => {
        const s = MOOD_MAP[m.mood!]?.score;
        return s !== undefined && s >= 7;
      }).length;
      const negative = weekMemories.filter(m => {
        const s = MOOD_MAP[m.mood!]?.score;
        return s !== undefined && s <= 3;
      }).length;

      return {
        week: format(weekStart, 'MMM d'),
        score: avg ? Math.round(avg * 10) / 10 : null,
        count: weekMemories.length,
        positive,
        negative,
        neutral: weekMemories.length - positive - negative,
      };
    }).filter((d) => d.score !== null);
  }, [memories, timeRange]);

  // Day-of-week mood patterns (radar)
  const dayOfWeekPattern = useMemo(() => {
    const dayData = DAY_NAMES.map((name, i) => {
      const dayMemories = memories.filter((m) => {
        const d = parseISO(m.memory_date);
        return getDay(d) === i && m.mood;
      });
      const scores = dayMemories.map((m) => MOOD_MAP[m.mood!]?.score || 5);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
      return { day: name, score: Math.round(avg * 10) / 10, count: dayMemories.length };
    });
    return dayData;
  }, [memories]);

  // Emotion category breakdown over months
  const emotionCategoryTrend = useMemo(() => {
    const memoriesWithCategory = memories.filter((m) => m.emotion_category);
    if (memoriesWithCategory.length === 0) return [];

    const allCategories = new Set<string>();
    memoriesWithCategory.forEach((m) => allCategories.add(m.emotion_category!));

    const sortedDates = memoriesWithCategory.map(m => parseISO(m.memory_date)).sort((a, b) => a.getTime() - b.getTime());
    if (sortedDates.length === 0) return [];

    const months = eachMonthOfInterval({
      start: startOfMonth(sortedDates[0]),
      end: endOfMonth(new Date()),
    }).slice(-6);

    return months.map((month) => {
      const monthStr = format(month, 'yyyy-MM');
      const monthMemories = memoriesWithCategory.filter(
        (m) => format(parseISO(m.memory_date), 'yyyy-MM') === monthStr
      );
      const entry: Record<string, any> = { month: format(month, 'MMM') };
      allCategories.forEach((cat) => {
        entry[cat] = monthMemories.filter((m) => m.emotion_category === cat).length;
      });
      return entry;
    });
  }, [memories]);

  const emotionCategories = useMemo(() => {
    const cats = new Set<string>();
    memories.forEach((m) => { if (m.emotion_category) cats.add(m.emotion_category); });
    return Array.from(cats);
  }, [memories]);

  const CATEGORY_COLORS = [
    'hsl(15, 80%, 55%)', 'hsl(175, 50%, 45%)', 'hsl(270, 60%, 55%)',
    'hsl(48, 90%, 55%)', 'hsl(340, 70%, 55%)', 'hsl(142, 70%, 45%)',
    'hsl(200, 60%, 50%)', 'hsl(30, 90%, 55%)',
  ];

  // Sentiment distribution
  const sentimentDistribution = useMemo(() => {
    const counts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    memories.forEach((m) => {
      if (m.ai_analysis && typeof m.ai_analysis === 'object') {
        const sentiment = (m.ai_analysis as any).sentiment;
        if (sentiment && counts[sentiment] !== undefined) {
          counts[sentiment]++;
        }
      }
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        color: SENTIMENT_COLORS[key],
      }));
  }, [memories]);

  // Mood streaks
  const streaks = useMemo(() => {
    const sorted = [...memories]
      .filter((m) => m.mood && MOOD_MAP[m.mood])
      .sort((a, b) => parseISO(a.memory_date).getTime() - parseISO(b.memory_date).getTime());

    let currentPositive = 0;
    let maxPositive = 0;
    let currentNegative = 0;
    let maxNegative = 0;

    sorted.forEach((m) => {
      const s = MOOD_MAP[m.mood!]?.score || 5;
      if (s >= 7) {
        currentPositive++;
        maxPositive = Math.max(maxPositive, currentPositive);
        currentNegative = 0;
      } else if (s <= 3) {
        currentNegative++;
        maxNegative = Math.max(maxNegative, currentNegative);
        currentPositive = 0;
      } else {
        currentPositive = 0;
        currentNegative = 0;
      }
    });

    return { maxPositive, maxNegative };
  }, [memories]);

  // Weekly average change
  const weeklyChange = useMemo(() => {
    if (weeklyTrend.length < 2) return null;
    const latest = weeklyTrend[weeklyTrend.length - 1]?.score || 0;
    const previous = weeklyTrend[weeklyTrend.length - 2]?.score || 0;
    return Math.round((latest - previous) * 10) / 10;
  }, [weeklyTrend]);

  // Event category mood averages
  const eventCategoryMoods = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    memories.forEach((m) => {
      if (m.event_category && m.mood && MOOD_MAP[m.mood]) {
        if (!grouped[m.event_category]) grouped[m.event_category] = [];
        grouped[m.event_category].push(MOOD_MAP[m.mood].score);
      }
    });
    return Object.entries(grouped)
      .map(([cat, scores]) => ({
        category: cat.charAt(0).toUpperCase() + cat.slice(1),
        avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        count: scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [memories]);

  if (memories.filter((m) => m.mood).length < 3) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Mood Trends & Emotional Patterns
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track how your emotional well-being evolves over time
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="8w">8 Weeks</SelectItem>
            <SelectItem value="12w">12 Weeks</SelectItem>
            <SelectItem value="6m">6 Months</SelectItem>
            <SelectItem value="12m">12 Months</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Streak & Change Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Weekly Change</p>
              <div className="flex items-center gap-2 mt-1">
                {weeklyChange !== null ? (
                  <>
                    {weeklyChange >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-success" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-destructive" />
                    )}
                    <span className={cn('text-2xl font-bold', weeklyChange >= 0 ? 'text-success' : 'text-destructive')}>
                      {weeklyChange > 0 ? '+' : ''}{weeklyChange}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">—</span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Best Streak 🔥</p>
              <p className="text-2xl font-bold text-success mt-1">{streaks.maxPositive} <span className="text-sm font-normal text-muted-foreground">days</span></p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tough Streak</p>
              <p className="text-2xl font-bold text-warning mt-1">{streaks.maxNegative} <span className="text-sm font-normal text-muted-foreground">days</span></p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sentiments</p>
              <div className="flex gap-1 mt-2">
                {sentimentDistribution.map((s) => (
                  <Badge key={s.name} variant="secondary" className="text-xs" style={{ borderColor: s.color, color: s.color }}>
                    {s.name}: {s.value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Weekly Mood Trend (Stacked) */}
      {weeklyTrend.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                Weekly Mood Score
              </CardTitle>
              <CardDescription>Average emotional wellness per week with positive/negative breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyTrend}>
                  <defs>
                    <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={50} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
                          <p className="font-semibold">Week of {d.week}</p>
                          <p className="text-muted-foreground">Score: <strong>{d.score}</strong>/10</p>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-success">✓ {d.positive} positive</span>
                            <span className="text-destructive">✗ {d.negative} negative</span>
                            <span className="text-muted-foreground">○ {d.neutral} neutral</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="url(#weeklyGrad)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Day of Week Radar */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border shadow-soft h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-accent" />
                Mood by Day of Week
              </CardTitle>
              <CardDescription>Which days tend to be your happiest?</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={dayOfWeekPattern}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} />
                  <Radar
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {dayOfWeekPattern
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3)
                  .map((d) => (
                    <Badge key={d.day} variant="secondary" className="text-xs">
                      {d.day}: {d.score}/10 ({d.count} memories)
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Event Category Mood Averages */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-border shadow-soft h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-collab" />
                Mood by Life Category
              </CardTitle>
              <CardDescription>How different activities affect your mood</CardDescription>
            </CardHeader>
            <CardContent>
              {eventCategoryMoods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No event categories detected yet. Keep adding memories!
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={eventCategoryMoods} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
                    <RechartsTooltip content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-sm">
                            <p className="font-semibold">{d.category}</p>
                            <p className="text-muted-foreground">Avg Mood: <strong>{d.avgScore}</strong>/10</p>
                            <p className="text-xs text-muted-foreground">{d.count} memories</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="avgScore" radius={[0, 6, 6, 0]}>
                      {eventCategoryMoods.map((entry, i) => (
                        <Cell
                          key={entry.category}
                          fill={entry.avgScore >= 7 ? 'hsl(var(--success))' : entry.avgScore >= 4 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Emotion Category Trend */}
      {emotionCategoryTrend.length > 0 && emotionCategories.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5 text-accent" />
                Emotion Category Trends
              </CardTitle>
              <CardDescription>How your emotional categories evolve month by month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={emotionCategoryTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  {emotionCategories.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="a"
                      fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                      radius={i === emotionCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-3">
                {emotionCategories.map((cat, i) => (
                  <div key={cat} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    <span className="capitalize">{cat}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
