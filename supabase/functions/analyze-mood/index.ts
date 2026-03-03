import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const { content, memoryType, mood, mediaUrl } = await req.json();

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
      console.error('AI API error response:', errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    // Parse the JSON response - handle potential markdown wrapping
    let analysis;
    try {
      // Strip markdown code block if present
      let cleanText = analysisText.trim();
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
        confidence: 0.3
      };
    }

    // Map the primary emotion to an emoji
    const detectedEmoji = mapEmoji(
      [analysis.primary_emotion, ...(analysis.emotions || [])],
      analysis.sentiment
    );

    // Return enriched analysis with emoji
    const enrichedAnalysis = {
      ...analysis,
      emoji: detectedEmoji,
      mood_label: analysis.primary_emotion,
    };

    return new Response(JSON.stringify(enrichedAnalysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error analyzing mood:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
