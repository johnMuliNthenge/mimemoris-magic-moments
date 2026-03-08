import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_MEMORY_TYPES = new Set(['text', 'audio', 'video', 'photo']);
const MAX_CONTENT_LENGTH = 5000;
const MAX_MOOD_LENGTH = 100;
const MAX_MEDIA_URL_LENGTH = 2048;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function isWithinRateLimit(userId: string) {
  const now = Date.now();
  const current = rateLimitMap.get(userId);

  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Comprehensive emoji mapping for moods
const moodEmojiMap: Record<string, string> = {
  // Positive
  joy: '😊', happy: '😊', happiness: '😊',
  love: '🥰', loving: '🥰', romantic: '💕',
  excited: '🤩', excitement: '🤩', thrilled: '🤩',
  grateful: '🙏', gratitude: '🙏', thankful: '🙏',
  proud: '😎', pride: '😎', confident: '😎',
  peaceful: '😌', calm: '😌', serene: '😌', relaxed: '😌',
  hopeful: '🌟', optimistic: '🌟', inspired: '✨',
  amused: '😄', funny: '😂', laughing: '😂',
  celebratory: '🎉', celebrating: '🎉', party: '🥳',
  nostalgic: '🥹', sentimental: '🥹',
  curious: '🤔', wondering: '🤔', thoughtful: '🤔',
  playful: '😜', silly: '🤪',
  determined: '💪', motivated: '🔥',
  surprised: '😲', amazed: '😮',
  relieved: '😮‍💨', comfort: '🤗',
  // Negative
  sad: '😢', sadness: '😢', crying: '😭', grief: '😭',
  angry: '😤', anger: '😤', frustrated: '😤', annoyed: '😒',
  anxious: '😰', anxiety: '😰', worried: '😟', nervous: '😬',
  tired: '😴', exhausted: '😴', sleepy: '😴',
  lonely: '🥺', alone: '🥺', missing: '🥺',
  confused: '😵‍💫', overwhelmed: '🤯',
  scared: '😨', fearful: '😨', afraid: '😱',
  disappointed: '😞', let_down: '😞',
  bored: '😐', indifferent: '😐',
  jealous: '😒', envious: '😒',
  guilty: '😔', ashamed: '😔', regretful: '😔',
  stressed: '😫', pressured: '😫',
  heartbroken: '💔', devastated: '💔',
  // Neutral
  neutral: '😐', okay: '🙂', fine: '🙂',
  reflective: '🪞', contemplative: '🧘',
  focused: '🎯', working: '💻',
};

function mapEmoji(emotions: string[], sentiment: string): string {
  // Try to find the best emoji from detected emotions
  for (const emotion of emotions) {
    const key = emotion.toLowerCase().replace(/\s+/g, '_');
    if (moodEmojiMap[key]) return moodEmojiMap[key];
  }
  // Fallback to sentiment
  if (sentiment === 'positive') return '😊';
  if (sentiment === 'negative') return '😢';
  if (sentiment === 'mixed') return '🤔';
  return '😐';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing backend env vars for auth validation');
      return jsonResponse({ error: 'Service temporarily unavailable' }, 503);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!isWithinRateLimit(user.id)) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again shortly.' }, 429);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid request payload' }, 400);
    }

    const rawContent = typeof payload.content === 'string' ? payload.content : '';
    const rawMemoryType = typeof payload.memoryType === 'string' ? payload.memoryType : '';
    const rawMood = typeof payload.mood === 'string' ? payload.mood : '';
    const rawMediaUrl = typeof payload.mediaUrl === 'string' ? payload.mediaUrl : '';

    const memoryType = rawMemoryType.trim().toLowerCase();
    if (!ALLOWED_MEMORY_TYPES.has(memoryType)) {
      return jsonResponse({ error: 'Invalid memory type' }, 400);
    }

    const content = rawContent.trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, MAX_CONTENT_LENGTH);
    const mood = rawMood.trim().replace(/[\r\n]+/g, ' ').slice(0, MAX_MOOD_LENGTH);
    const mediaUrl = rawMediaUrl.trim().slice(0, MAX_MEDIA_URL_LENGTH);

    if (rawContent.length > MAX_CONTENT_LENGTH) {
      return jsonResponse({ error: 'Content is too long' }, 400);
    }

    if (rawMood.length > MAX_MOOD_LENGTH) {
      return jsonResponse({ error: 'Mood value is too long' }, 400);
    }

    if (rawMediaUrl.length > MAX_MEDIA_URL_LENGTH) {
      return jsonResponse({ error: 'Media URL is too long' }, 400);
    }

    // Build a context-aware prompt depending on what content is available
    let contentDescription = '';
    if (content) {
      contentDescription += `Text Content: ${content}\n`;
    }
    if (mediaUrl) {
      contentDescription += `Media URL (${memoryType}): ${mediaUrl}\n`;
      if (memoryType === 'photo') {
        contentDescription += `This is a photo memory. Analyze the context from any text provided and the fact that the user chose to capture a visual moment.\n`;
      } else if (memoryType === 'video') {
        contentDescription += `This is a video memory. Consider the emotional significance of capturing a video moment.\n`;
      } else if (memoryType === 'audio') {
        contentDescription += `This is an audio memory. Consider the emotional significance of capturing a voice/sound moment.\n`;
      }
    }
    if (mood) {
      contentDescription += `User's manually selected mood emoji: ${mood}\n`;
    }
    if (!content && !mood && !mediaUrl) {
      contentDescription = 'No content provided yet.\n';
    }

    const prompt = `You are an expert emotion and mood analyst. Analyze this memory and detect the user's emotional state with high precision.

Memory Type: ${memoryType}
${contentDescription}

You MUST respond with ONLY valid JSON (no markdown, no code blocks) with these fields:
1. "sentiment": overall sentiment - one of: "positive", "negative", "neutral", "mixed"
2. "sentiment_score": a number from -1.0 (most negative) to 1.0 (most positive) representing the emotional intensity
3. "primary_emotion": the single strongest emotion detected (e.g., "joy", "nostalgia", "gratitude", "sadness", "excitement", "love", "anxiety", "pride", "calm", "anger", "hope", "loneliness")
4. "emotion_category": broad category - one of: "joy", "sadness", "anger", "fear", "surprise", "disgust", "trust", "anticipation", "love", "nostalgia", "neutral"
5. "emotions": array of ALL detected emotions (be thorough, detect subtle emotions too)
6. "themes": array of life themes present (e.g., "family", "friendship", "achievement", "growth", "travel", "work", "health", "romance", "loss", "adventure")
7. "people_tags": array of people mentioned or implied (e.g., "mom", "best friend", "partner", "colleague", "family"). Extract from context clues.
8. "event_category": classify the memory event - one of: "daily_life", "celebration", "travel", "work", "social", "family", "health", "achievement", "loss", "romantic", "creative", "spiritual", "education", "other"
9. "location_hint": any location mentioned or implied (e.g., "home", "office", "beach", "restaurant", city names). Return null if none detected.
10. "insight": a brief, warm 2-3 sentence reflection about this memory
11. "suggestedActions": array of 1-2 suggestions
12. "confidence": a number 0-1 indicating how confident you are in the mood detection

Be empathetic and thorough. Even short text can reveal deep emotions. Consider word choice, tone, punctuation, and context.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are an empathetic emotion analyst specializing in detecting moods and feelings from text, context, and media descriptions. Always respond with valid JSON only, no markdown formatting.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error response:', response.status, errorText);

      if (response.status === 429) {
        return jsonResponse({ error: 'Rate limit exceeded. Please try again shortly.' }, 429);
      }

      if (response.status === 402) {
        return jsonResponse({ error: 'AI credits exhausted. Please add credits.' }, 402);
      }

      return jsonResponse({ error: 'Failed to analyze mood right now. Please try again.' }, 502);
    }

    const data = await response.json();
    const analysisText = data?.choices?.[0]?.message?.content;

    // Parse the JSON response - handle potential markdown wrapping
    let analysis: Record<string, unknown>;
    try {
      let cleanText = typeof analysisText === 'string' ? analysisText.trim() : '';
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      analysis = JSON.parse(cleanText);
    } catch {
      analysis = {
        sentiment: 'neutral',
        primary_emotion: 'reflective',
        emotions: ['reflective'],
        themes: ['life'],
        insight: 'This memory captures a moment in your life.',
        suggestedActions: ['Reflect on what made this moment meaningful'],
        confidence: 0.3,
      };
    }

    const primaryEmotion = typeof analysis.primary_emotion === 'string' ? analysis.primary_emotion : 'reflective';
    const sentiment = typeof analysis.sentiment === 'string' ? analysis.sentiment : 'neutral';
    const emotions = Array.isArray(analysis.emotions)
      ? analysis.emotions.filter((value): value is string => typeof value === 'string')
      : [];

    // Map the primary emotion to an emoji
    const detectedEmoji = mapEmoji([primaryEmotion, ...emotions], sentiment);

    // Return enriched analysis with emoji
    const enrichedAnalysis = {
      ...analysis,
      emoji: detectedEmoji,
      mood_label: primaryEmotion,
    };

    return jsonResponse(enrichedAnalysis);
  } catch (error: unknown) {
    console.error('Error analyzing mood:', error);
    return jsonResponse({ error: 'Failed to analyze mood right now. Please try again.' }, 500);
  }
});
