import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Heart, Lightbulb, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MoodAnalysisProps {
  content: string;
  memoryType: string;
  mood: string | null;
  onAnalysisComplete?: (analysis: any) => void;
}

interface Analysis {
  sentiment: string;
  emotions: string[];
  themes: string[];
  insight: string;
  suggestedActions: string[];
}

export function MoodAnalysis({ content, memoryType, mood, onAnalysisComplete }: MoodAnalysisProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const analyzeMemory = async () => {
    if (!content && !mood) {
      setError('Please add some content or select a mood first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-mood', {
        body: { content, memoryType, mood },
      });

      if (fnError) throw fnError;

      setAnalysis(data);
      onAnalysisComplete?.(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze memory');
    } finally {
      setLoading(false);
    }
  };

  const sentimentColors: Record<string, string> = {
    positive: 'bg-success/20 text-success',
    negative: 'bg-destructive/20 text-destructive',
    neutral: 'bg-muted text-muted-foreground',
    mixed: 'bg-accent/20 text-accent',
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium">AI Memory Analysis</span>
          </div>
          {analysis && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {!analysis && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Get AI-powered insights about your memory's emotions and themes
            </p>
            <Button
              onClick={analyzeMemory}
              disabled={loading}
              className="gradient-warm text-primary-foreground"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze Memory
                </>
              )}
            </Button>
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </div>
        )}

        <AnimatePresence>
          {analysis && expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Sentiment */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sentiment:</span>
                <Badge className={cn(sentimentColors[analysis.sentiment] || 'bg-muted')}>
                  {analysis.sentiment}
                </Badge>
              </div>

              {/* Emotions */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">Emotions Detected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.emotions.map((emotion, i) => (
                    <Badge key={i} variant="outline" className="bg-accent/10">
                      {emotion}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Themes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Life Themes</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.themes.map((theme, i) => (
                    <Badge key={i} variant="secondary">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Insight */}
              <div className="p-3 bg-background/50 rounded-lg border border-border">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-warning mt-0.5" />
                  <p className="text-sm">{analysis.insight}</p>
                </div>
              </div>

              {/* Suggestions */}
              {analysis.suggestedActions.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <strong>Suggestions:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {analysis.suggestedActions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Re-analyze button */}
              <Button
                variant="outline"
                size="sm"
                onClick={analyzeMemory}
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Re-analyze'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
