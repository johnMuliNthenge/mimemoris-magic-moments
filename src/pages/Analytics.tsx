import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  Heart,
  Brain,
  Calendar,
  BarChart3,
  Sparkles,
  Loader2,
  ExternalLink,
  Download,
  Users,
  MapPin,
} from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval, subDays, getDay } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MoodTrendsSection } from '@/components/analytics/MoodTrendsSection';
import { MoodComparisonSection } from '@/components/analytics/MoodComparisonSection';
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
};

const TYPE_COLORS: Record<string, string> = {
  text: 'hsl(15, 80%, 55%)',
  photo: 'hsl(142, 70%, 45%)',
  video: 'hsl(270, 60%, 55%)',
  audio: 'hsl(175, 50%, 45%)',
};

const HEATMAP_COLORS = [
  'hsl(var(--muted))',
  'hsl(142, 70%, 85%)',
  'hsl(142, 70%, 65%)',
  'hsl(142, 70%, 45%)',
  'hsl(142, 70%, 30%)',
];

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
  people_tags: string[] | null;
}

export default function Analytics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMemories();
  }, [user]);

  const fetchMemories = async () => {
    const { data } = await supabase
      .from('memories')
      .select('id, memory_type, memory_date, mood, ai_analysis, created_at, title, content, emotion_category, sentiment_score, event_category, people_tags')
      .eq('user_id', user!.id)
      .order('memory_date', { ascending: true });

    if (data) setMemories(data as Memory[]);
    setLoading(false);
  };

  // Mood trend over time (monthly avg)
  const moodTrend = useMemo(() => {
    if (memories.length === 0) return [];
    const start = startOfMonth(parseISO(memories[0].memory_date));
    const end = endOfMonth(new Date());
    const months = eachMonthOfInterval({ start, end });

    return months.map((month) => {
      const monthStr = format(month, 'yyyy-MM');
      const monthMemories = memories.filter(
        (m) => m.mood && format(parseISO(m.memory_date), 'yyyy-MM') === monthStr
      );
      const scores = monthMemories.map((m) => MOOD_MAP[m.mood!]?.score || 5);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return {
        month: format(month, 'MMM yy'),
        fullMonth: format(month, 'yyyy-MM'),
        score: avg ? Math.round(avg * 10) / 10 : null,
        count: monthMemories.length,
      };
    }).filter(d => d.score !== null);
  }, [memories]);

  // Memory type distribution
  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    memories.forEach((m) => {
      counts[m.memory_type] = (counts[m.memory_type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      type,
      value: count,
      color: TYPE_COLORS[type] || 'hsl(0, 0%, 60%)',
    }));
  }, [memories]);

  // Mood frequency
  const moodFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    memories.forEach((m) => {
      if (m.mood) counts[m.mood] = (counts[m.mood] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([mood, count]) => ({
        mood,
        label: MOOD_MAP[mood]?.label || mood,
        count,
        color: MOOD_MAP[mood]?.color || 'hsl(0,0%,60%)',
      }))
      .sort((a, b) => b.count - a.count);
  }, [memories]);

  // Wellness score
  const wellnessScore = useMemo(() => {
    const scored = memories.filter((m) => m.mood && MOOD_MAP[m.mood]);
    if (scored.length === 0) return null;
    const avg = scored.reduce((sum, m) => sum + MOOD_MAP[m.mood!].score, 0) / scored.length;
    return Math.round(avg * 10);
  }, [memories]);

  // AI emotions aggregate
  const emotionAgg = useMemo(() => {
    const counts: Record<string, number> = {};
    memories.forEach((m) => {
      if (m.ai_analysis && typeof m.ai_analysis === 'object') {
        const analysis = m.ai_analysis as any;
        const emotions: string[] = analysis.emotions || [];
        emotions.forEach((e: string) => {
          counts[e] = (counts[e] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .map(([emotion, count]) => ({ emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [memories]);

  // Memories per month for activity
  const activityData = useMemo(() => {
    if (memories.length === 0) return [];
    const last6 = subMonths(new Date(), 5);
    const months = eachMonthOfInterval({ start: startOfMonth(last6), end: endOfMonth(new Date()) });
    return months.map((month) => {
      const monthStr = format(month, 'yyyy-MM');
      const count = memories.filter(
        (m) => format(parseISO(m.memory_date), 'yyyy-MM') === monthStr
      ).length;
      return { month: format(month, 'MMM'), fullMonth: format(month, 'yyyy-MM'), count };
    });
  }, [memories]);

  // Happiest and most stressed periods
  const extremePeriods = useMemo(() => {
    if (moodTrend.length === 0) return { happiest: null, stressed: null };
    const sorted = [...moodTrend].sort((a, b) => (b.score || 0) - (a.score || 0));
    return {
      happiest: sorted[0],
      stressed: sorted[sorted.length - 1],
    };
  }, [moodTrend]);

  // Recent memories for quick access
  const recentMemories = useMemo(() => {
    return [...memories].reverse().slice(0, 5);
  }, [memories]);

  // Top people tags
  const topPeople = useMemo(() => {
    const counts: Record<string, number> = {};
    memories.forEach(m => {
      if (m.people_tags) {
        m.people_tags.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [memories]);

  // Activity heatmap (last 16 weeks)
  const heatmapData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 16 * 7 - 1);
    const days = eachDayOfInterval({ start, end: today });
    const countByDate: Record<string, number> = {};
    memories.forEach(m => {
      countByDate[m.memory_date] = (countByDate[m.memory_date] || 0) + 1;
    });
    const maxCount = Math.max(1, ...Object.values(countByDate));
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = countByDate[dateStr] || 0;
      const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
      return { date: dateStr, count, level, dayOfWeek: getDay(day) };
    });
  }, [memories]);

  // Group heatmap by weeks
  const heatmapWeeks = useMemo(() => {
    const weeks: typeof heatmapData[] = [];
    let currentWeek: typeof heatmapData = [];
    heatmapData.forEach((day, i) => {
      if (i > 0 && day.dayOfWeek === 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [heatmapData]);

  const navigateToMemories = (date?: string) => {
    if (date) {
      navigate(`/memories?date=${date}`);
    } else {
      navigate('/memories');
    }
  };

  const navigateToMemoriesByMonth = (fullMonth: string) => {
    navigate(`/memories?date=${fullMonth}-01`);
  };

  const exportCSV = useCallback(() => {
    const headers = ['Date', 'Title', 'Type', 'Mood', 'Content', 'Emotion', 'Event Category', 'People Tags', 'Sentiment Score'];
    const rows = memories.map(m => [
      m.memory_date,
      (m.title || '').replace(/"/g, '""'),
      m.memory_type,
      m.mood || '',
      (m.content || '').replace(/"/g, '""').replace(/\n/g, ' '),
      m.emotion_category || '',
      m.event_category || '',
      (m.people_tags || []).join('; '),
      m.sentiment_score?.toString() || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [memories]);

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
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{t('analytics_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('analytics_subtitle')}</p>
          </div>
          {memories.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}
        </motion.div>

        {memories.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('analytics_no_data')}</p>
              <Button className="mt-4" onClick={() => navigate('/memories/new')}>
                {t('create_memory')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-border shadow-soft cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToMemories()}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('analytics_wellness')}</p>
                        <p className="text-3xl font-bold text-primary mt-1">{wellnessScore ?? '—'}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                      </div>
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Heart className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <p className="text-xs text-primary flex items-center gap-1 mt-2">
                      <ExternalLink className="w-3 h-3" /> {t('analytics_view_all')}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-border shadow-soft cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToMemories()}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('analytics_total')}</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{memories.length}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-accent/10">
                        <BarChart3 className="w-5 h-5 text-accent" />
                      </div>
                    </div>
                    <p className="text-xs text-primary flex items-center gap-1 mt-2">
                      <ExternalLink className="w-3 h-3" /> {t('analytics_view_all')}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card
                  className="border-border shadow-soft cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => extremePeriods.happiest?.fullMonth && navigateToMemoriesByMonth(extremePeriods.happiest.fullMonth)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('analytics_happiest')}</p>
                        <p className="text-lg font-bold text-success mt-1">{extremePeriods.happiest?.month ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{t('analytics_score')}: {extremePeriods.happiest?.score ?? '—'}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-success/10">
                        <Sparkles className="w-5 h-5 text-success" />
                      </div>
                    </div>
                    {extremePeriods.happiest && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-2">
                        <ExternalLink className="w-3 h-3" /> {t('analytics_view_memories')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card
                  className="border-border shadow-soft cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => extremePeriods.stressed?.fullMonth && navigateToMemoriesByMonth(extremePeriods.stressed.fullMonth)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('analytics_toughest')}</p>
                        <p className="text-lg font-bold text-warning mt-1">{extremePeriods.stressed?.month ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{t('analytics_score')}: {extremePeriods.stressed?.score ?? '—'}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-warning/10">
                        <Brain className="w-5 h-5 text-warning" />
                      </div>
                    </div>
                    {extremePeriods.stressed && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-2">
                        <ExternalLink className="w-3 h-3" /> {t('analytics_view_memories')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Activity Heatmap */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}>
              <Card className="border-border shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Memory Activity
                  </CardTitle>
                  <CardDescription>Your memory recording consistency over the last 16 weeks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-[3px] min-w-fit">
                      {heatmapWeeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                          {/* Pad first week if it doesn't start on Sunday */}
                          {wi === 0 && week[0] && Array.from({ length: week[0].dayOfWeek }).map((_, i) => (
                            <div key={`pad-${i}`} className="w-3 h-3" />
                          ))}
                          {week.map(day => (
                            <div
                              key={day.date}
                              className="w-3 h-3 rounded-[2px] cursor-pointer transition-colors hover:ring-1 hover:ring-foreground/30"
                              style={{ backgroundColor: HEATMAP_COLORS[day.level] }}
                              title={`${day.date}: ${day.count} ${day.count === 1 ? 'memory' : 'memories'}`}
                              onClick={() => day.count > 0 && navigateToMemories(day.date)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground justify-end">
                      <span>Less</span>
                      {HEATMAP_COLORS.map((color, i) => (
                        <div key={i} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: color }} />
                      ))}
                      <span>More</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Memories Quick Links */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <Card className="border-border shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      {t('analytics_recent')}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => navigateToMemories()} className="text-primary text-xs">
                      {t('analytics_view_all')} <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentMemories.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigateToMemories(m.memory_date)}
                      >
                        <span className="text-lg">{m.mood || '📝'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.title || m.content?.slice(0, 50) || t('analytics_untitled')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(m.memory_date), 'MMM dd, yyyy')} · {m.memory_type}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Mood Trend Chart */}
            {moodTrend.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-border shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      {t('analytics_mood_trend')}
                    </CardTitle>
                    <CardDescription>{t('analytics_mood_trend_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={moodTrend} onClick={(data) => {
                        if (data?.activePayload?.[0]?.payload?.fullMonth) {
                          navigateToMemoriesByMonth(data.activePayload[0].payload.fullMonth);
                        }
                      }} style={{ cursor: 'pointer' }}>
                        <defs>
                          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(15, 80%, 55%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(15, 80%, 55%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 85%)" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                        <RechartsTooltip content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-sm">
                                <p className="font-medium">{d.month}</p>
                                <p className="text-muted-foreground">Score: {d.score}</p>
                                <p className="text-xs text-primary flex items-center gap-1 mt-1">
                                  <ExternalLink className="w-3 h-3" /> Click to view memories
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Area type="monotone" dataKey="score" stroke="hsl(15, 80%, 55%)" fill="url(#moodGrad)" strokeWidth={2} name="Mood Score" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Activity (memories per month) */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                <Card className="border-border shadow-soft h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-accent" />
                      {t('analytics_activity')}
                    </CardTitle>
                    <CardDescription>{t('analytics_activity_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={activityData} onClick={(data) => {
                        if (data?.activePayload?.[0]?.payload?.fullMonth) {
                          navigateToMemoriesByMonth(data.activePayload[0].payload.fullMonth);
                        }
                      }} style={{ cursor: 'pointer' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 85%)" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <RechartsTooltip content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-sm">
                                <p className="font-medium">{d.month}</p>
                                <p className="text-muted-foreground">{d.count} memories</p>
                                <p className="text-xs text-primary flex items-center gap-1 mt-1">
                                  <ExternalLink className="w-3 h-3" /> Click to view
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar dataKey="count" fill="hsl(175, 50%, 45%)" radius={[6, 6, 0, 0]} name="Memories" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Memory Type Distribution */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <Card className="border-border shadow-soft h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-collab" />
                      {t('analytics_types')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {typeDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {typeDistribution.map((t) => (
                        <Badge
                          key={t.type}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => navigateToMemories()}
                        >
                          {t.name}: {t.value}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Mood Frequency + AI Emotions */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Mood Frequency */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <Card className="border-border shadow-soft">
                  <CardHeader>
                    <CardTitle>{t('analytics_mood_freq')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {moodFrequency.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{t('analytics_no_moods')}</p>
                    ) : (
                      <div className="space-y-3">
                        {moodFrequency.map((m) => (
                          <div
                            key={m.mood}
                            className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1 transition-colors"
                            onClick={() => navigateToMemories()}
                          >
                            <span className="text-2xl">{m.mood}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{m.label}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  {m.count} <ExternalLink className="w-3 h-3" />
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${(m.count / (moodFrequency[0]?.count || 1)) * 100}%`,
                                    backgroundColor: m.color,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* AI Detected Emotions */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Card className="border-border shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-collab" />
                      {t('analytics_ai_emotions')}
                    </CardTitle>
                    <CardDescription>{t('analytics_ai_emotions_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {emotionAgg.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{t('analytics_no_ai')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {emotionAgg.map((e) => (
                          <Badge
                            key={e.emotion}
                            variant="secondary"
                            className="text-sm px-3 py-1.5 cursor-pointer hover:bg-primary/10 transition-colors"
                            onClick={() => navigateToMemories()}
                          >
                            {e.emotion} <span className="ml-1 text-xs text-muted-foreground">×{e.count}</span>
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Top People Tags */}
            {topPeople.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
                <Card className="border-border shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      People in Your Memories
                    </CardTitle>
                    <CardDescription>Who appears most frequently in your memories</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {topPeople.map((person, i) => (
                        <div
                          key={person.name}
                          className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => navigateToMemories()}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                            i === 0 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                          )}>
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{person.name}</p>
                            <p className="text-xs text-muted-foreground">{person.count} {person.count === 1 ? 'memory' : 'memories'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Mood Trends Dashboard */}
            <MoodTrendsSection memories={memories} />
            {/* Mood Period Comparison */}
            <MoodComparisonSection memories={memories} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
