import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TELEGRAM-IMPORT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    logStep("Received Telegram update", { update_id: body.update_id });

    const message = body.message;
    if (!message) {
      return new Response(JSON.stringify({ status: "no message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const chatId = message.chat?.id;
    const telegramUsername = message.from?.username;
    const telegramUserId = message.from?.id;
    const text = message.text || message.caption || "";

    logStep("Processing Telegram message", { chatId, username: telegramUsername, type: message.text ? "text" : "media" });

    // Handle /start command - link account
    if (text.startsWith("/start")) {
      const linkCode = text.replace("/start ", "").trim();
      
      // Get bot token to reply
      const { data: config } = await supabaseClient
        .from("social_import_config")
        .select("config")
        .eq("platform", "telegram")
        .single();

      const botToken = config?.config?.bot_token;

      if (linkCode && linkCode !== "/start") {
        // Try to link the Telegram account using the code
        // The code format is the user_id from our app
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("user_id")
          .eq("user_id", linkCode)
          .maybeSingle();

        if (profile) {
          // Store telegram chat ID in profile config or a mapping table
          // For now we use the whatsapp_number field pattern - store telegram ID
          // We'll use the config jsonb to store telegram mappings
          const { data: existingConfig } = await supabaseClient
            .from("social_import_config")
            .select("config")
            .eq("platform", "telegram")
            .single();

          const telegramMappings = existingConfig?.config?.user_mappings || {};
          telegramMappings[String(chatId)] = profile.user_id;

          await supabaseClient
            .from("social_import_config")
            .update({
              config: {
                ...existingConfig?.config,
                user_mappings: telegramMappings,
              },
            })
            .eq("platform", "telegram");

          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "✅ Account linked successfully! Now you can send me messages, photos, videos, or voice notes and they'll be saved as your memories.",
              }),
            });
          }

          logStep("Telegram account linked", { chatId, userId: profile.user_id });
        } else {
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "❌ Invalid link code. Please use the link from your Mimemoris settings page.",
              }),
            });
          }
        }
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "👋 Welcome to Mimemoris! To link your account, please use the link from your Mimemoris Settings → Social Import page.",
            }),
          });
        }
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Find user by telegram chat ID mapping
    const { data: telegramConfig } = await supabaseClient
      .from("social_import_config")
      .select("config")
      .eq("platform", "telegram")
      .single();

    const userMappings = telegramConfig?.config?.user_mappings || {};
    const userId = userMappings[String(chatId)];

    if (!userId) {
      logStep("No linked user for chat", { chatId });
      const botToken = telegramConfig?.config?.bot_token;
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "⚠️ Your Telegram is not linked to a Mimemoris account. Please link it from your Settings page first.",
          }),
        });
      }
      return new Response(JSON.stringify({ status: "not linked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check subscription and plan
    const { data: userSub } = await supabaseClient
      .from("user_subscriptions")
      .select("plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!userSub) {
      logStep("User has no active subscription", { userId });
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId,
        platform: "telegram",
        source_message_id: String(message.message_id),
        status: "failed",
        error_message: "No active subscription",
      });
      return new Response(JSON.stringify({ status: "no sub" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: platformEnabled } = await supabaseClient
      .from("plan_social_platforms")
      .select("is_enabled")
      .eq("plan_id", userSub.plan_id)
      .eq("platform", "telegram")
      .maybeSingle();

    if (!platformEnabled?.is_enabled) {
      logStep("Telegram import not enabled for plan", { userId });
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId,
        platform: "telegram",
        source_message_id: String(message.message_id),
        status: "failed",
        error_message: "Telegram import not enabled for your plan",
      });
      return new Response(JSON.stringify({ status: "not enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Determine memory type and content
    let content = text || "";
    let memoryType: "text" | "photo" | "video" | "audio" = "text";

    if (message.photo) {
      memoryType = "photo";
      content = content || "Photo from Telegram";
    } else if (message.video) {
      memoryType = "video";
      content = content || "Video from Telegram";
    } else if (message.voice || message.audio) {
      memoryType = "audio";
      content = content || "Voice note from Telegram";
    }

    const today = new Date().toISOString().split("T")[0];

    // Create the memory
    const { data: memory, error: memoryError } = await supabaseClient
      .from("memories")
      .insert({
        user_id: userId,
        memory_type: memoryType,
        memory_date: today,
        content: content,
        title: "Telegram Memory",
        mood: "💬",
        event_category: "social",
        emotion_category: "connection",
      })
      .select("id")
      .single();

    if (memoryError) {
      logStep("Failed to create memory", { error: memoryError.message });
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId,
        platform: "telegram",
        source_message_id: String(message.message_id),
        status: "failed",
        error_message: memoryError.message,
      });
      return new Response(JSON.stringify({ status: "error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Log successful import
    await supabaseClient.from("social_import_logs").insert({
      user_id: userId,
      platform: "telegram",
      memory_id: memory.id,
      source_message_id: String(message.message_id),
      status: "completed",
    });

    // Send confirmation
    const botToken = telegramConfig?.config?.bot_token;
    if (botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Memory saved to Mimemoris!",
          reply_to_message_id: message.message_id,
        }),
      });
    }

    logStep("Memory created from Telegram", { memoryId: memory.id, userId });

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
