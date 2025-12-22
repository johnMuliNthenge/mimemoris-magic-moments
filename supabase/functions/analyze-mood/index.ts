import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, memoryType, mood } = await req.json();

    const prompt = `Analyze this memory and provide insights about the emotional state and themes. Be warm, empathetic, and helpful.

Memory Type: ${memoryType}
User's Selected Mood: ${mood || 'Not specified'}
Content: ${content || 'No text content provided'}

Provide a JSON response with:
1. "sentiment": overall sentiment (positive, negative, neutral, mixed)
2. "emotions": array of detected emotions (e.g., joy, nostalgia, gratitude, love, sadness)
3. "themes": array of life themes present (e.g., family, friendship, achievement, growth, travel)
4. "insight": a brief, warm insight or reflection about this memory (2-3 sentences)
5. "suggestedActions": array of 1-2 suggestions for the user (e.g., "Consider sharing this memory with your loved ones")

Respond ONLY with valid JSON, no markdown.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are an empathetic memory analyst that helps users understand and appreciate their memories. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      // If parsing fails, create a basic structure
      analysis = {
        sentiment: 'positive',
        emotions: ['joy'],
        themes: ['life'],
        insight: 'This memory captures a meaningful moment in your life.',
        suggestedActions: ['Reflect on what made this moment special']
      };
    }

    return new Response(JSON.stringify(analysis), {
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
