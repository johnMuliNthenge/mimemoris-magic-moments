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

async function downloadTelegramFile(
  botToken: string,
  fileId: string
): Promise<{ data: ArrayBuffer; filePath: string } | null> {
  try {
    // Step 1: Get file path
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    if (!res.ok) return null;
    const fileInfo = await res.json();
    const filePath = fileInfo.result?.file_path;
    if (!filePath) return null;

    // Step 2: Download file
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!downloadRes.ok) return null;
    const data = await downloadRes.arrayBuffer();
    return { data, filePath };
  } catch (err) {
    logStep("File download error", { error: String(err) });
    return null;
  }
}

function getExtFromPath(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "bin";
}

function getContentTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    mp4: "video/mp4", mov: "video/quicktime",
    ogg: "audio/ogg", oga: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4",
  };
  return map[ext] || "application/octet-stream";
}

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
    logStep("Received update", { update_id: body.update_id });

    const message = body.message;
    if (!message) {
      return new Response(JSON.stringify({ status: "no message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const chatId = message.chat?.id;
    const text = message.text || message.caption || "";

    // Get telegram config
    const { data: telegramConfig } = await supabaseClient
      .from("social_import_config")
      .select("config")
      .eq("platform", "telegram")
      .single();

    const botToken = telegramConfig?.config?.bot_token || "";

    const sendReply = async (chatId: number, text: string, replyTo?: number) => {
      if (!botToken) return;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(replyTo ? { reply_to_message_id: replyTo } : {}),
        }),
      });
    };

    // Handle /start command
    if (text.startsWith("/start")) {
      const linkCode = text.replace("/start ", "").trim();

      if (linkCode && linkCode !== "/start") {
        // Redeem the one-time short-lived link token (server-side validated).
        const { data: redeemedUserId, error: redeemErr } = await supabaseClient
          .rpc("redeem_social_link_token", { _token: linkCode, _platform: "telegram" });

        if (!redeemErr && redeemedUserId) {
          const telegramMappings = telegramConfig?.config?.user_mappings || {};
          telegramMappings[String(chatId)] = redeemedUserId;

          await supabaseClient
            .from("social_import_config")
            .update({
              config: { ...telegramConfig?.config, user_mappings: telegramMappings },
            })
            .eq("platform", "telegram");

          await sendReply(chatId, "✅ Account linked successfully!\n\nYou can now send me:\n• 📝 Text messages\n• 📷 Photos\n• 🎥 Videos\n• 🎤 Voice notes\n\nEach one will be saved as a memory in Mimemoris!");
          logStep("Account linked", { chatId, userId: redeemedUserId });
        } else {
          await sendReply(chatId, "❌ Invalid or expired link code. Please go to Mimemoris Settings → Social Import and generate a fresh link.");
        }
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      await sendReply(chatId, "👋 Welcome to Mimemoris!\n\nTo link your account, go to Settings → Social Import in the Mimemoris app and click 'Link Telegram Account'.");
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Handle /help command
    if (text === "/help") {
      await sendReply(chatId, "📚 *Mimemoris Bot Help*\n\nSend me any of the following to save as a memory:\n• Text messages\n• Photos (with optional caption)\n• Videos (with optional caption)\n• Voice notes\n• Audio files\n\nCommands:\n/start - Link your account\n/help - Show this help\n/status - Check link status");
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Handle /status command
    if (text === "/status") {
      const userMappings = telegramConfig?.config?.user_mappings || {};
      const linked = !!userMappings[String(chatId)];
      await sendReply(chatId, linked
        ? "✅ Your account is linked! Send any message to save it as a memory."
        : "❌ Your account is not linked. Go to Settings → Social Import to link it.");
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Find linked user
    const userMappings = telegramConfig?.config?.user_mappings || {};
    const userId = userMappings[String(chatId)];

    if (!userId) {
      logStep("No linked user", { chatId });
      await sendReply(chatId, "⚠️ Your Telegram is not linked to Mimemoris. Go to Settings → Social Import to link it.");
      return new Response(JSON.stringify({ status: "not linked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Duplicate detection
    const msgIdStr = String(message.message_id);
    const { data: existingLog } = await supabaseClient
      .from("social_import_logs")
      .select("id")
      .eq("source_message_id", msgIdStr)
      .eq("platform", "telegram")
      .eq("status", "completed")
      .maybeSingle();

    if (existingLog) {
      logStep("Duplicate message, skipping", { messageId: msgIdStr });
      return new Response(JSON.stringify({ status: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Check subscription & plan
    const { data: userSub } = await supabaseClient
      .from("user_subscriptions")
      .select("plan_id, memories_used_today")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!userSub) {
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId, platform: "telegram", source_message_id: msgIdStr,
        status: "failed", error_message: "No active subscription",
      });
      await sendReply(chatId, "⚠️ You need an active subscription to import memories.", message.message_id);
      return new Response(JSON.stringify({ status: "no sub" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { data: platformEnabled } = await supabaseClient
      .from("plan_social_platforms")
      .select("is_enabled")
      .eq("plan_id", userSub.plan_id)
      .eq("platform", "telegram")
      .maybeSingle();

    if (!platformEnabled?.is_enabled) {
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId, platform: "telegram", source_message_id: msgIdStr,
        status: "failed", error_message: "Telegram not enabled for plan",
      });
      await sendReply(chatId, "🔒 Telegram import is not available on your current plan. Please upgrade.", message.message_id);
      return new Response(JSON.stringify({ status: "not enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Check daily limit
    const { data: planInfo } = await supabaseClient
      .from("subscription_plans")
      .select("daily_memory_limit")
      .eq("id", userSub.plan_id)
      .single();

    if (planInfo && (userSub.memories_used_today || 0) >= planInfo.daily_memory_limit) {
      await sendReply(chatId, "⚠️ Daily memory limit reached. Try again tomorrow or upgrade your plan.", message.message_id);
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId, platform: "telegram", source_message_id: msgIdStr,
        status: "failed", error_message: "Daily memory limit reached",
      });
      return new Response(JSON.stringify({ status: "limit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Determine type, content, and download media
    let content = text || "";
    let memoryType: "text" | "photo" | "video" | "audio" = "text";
    let mediaUrl: string | null = null;

    if (message.photo && message.photo.length > 0) {
      memoryType = "photo";
      content = content || "Photo from Telegram";
      // Get the largest photo
      const largestPhoto = message.photo[message.photo.length - 1];
      if (largestPhoto.file_id && botToken) {
        const file = await downloadTelegramFile(botToken, largestPhoto.file_id);
        if (file) {
          const ext = getExtFromPath(file.filePath);
          const storagePath = `${userId}/telegram_${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseClient.storage
            .from("memories")
            .upload(storagePath, file.data, { contentType: getContentTypeFromExt(ext) });
          if (!uploadErr) mediaUrl = storagePath;
        }
      }
    } else if (message.video) {
      memoryType = "video";
      content = content || "Video from Telegram";
      if (message.video.file_id && botToken) {
        const file = await downloadTelegramFile(botToken, message.video.file_id);
        if (file) {
          const ext = getExtFromPath(file.filePath);
          const storagePath = `${userId}/telegram_${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseClient.storage
            .from("memories")
            .upload(storagePath, file.data, { contentType: getContentTypeFromExt(ext) });
          if (!uploadErr) mediaUrl = storagePath;
        }
      }
    } else if (message.voice) {
      memoryType = "audio";
      content = "Voice note from Telegram";
      if (message.voice.file_id && botToken) {
        const file = await downloadTelegramFile(botToken, message.voice.file_id);
        if (file) {
          const ext = getExtFromPath(file.filePath);
          const storagePath = `${userId}/telegram_${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseClient.storage
            .from("memories")
            .upload(storagePath, file.data, { contentType: getContentTypeFromExt(ext) });
          if (!uploadErr) mediaUrl = storagePath;
        }
      }
    } else if (message.audio) {
      memoryType = "audio";
      content = message.audio.title || message.audio.performer
        ? `${message.audio.performer || ""} - ${message.audio.title || "Audio"}`.trim()
        : "Audio from Telegram";
      if (message.audio.file_id && botToken) {
        const file = await downloadTelegramFile(botToken, message.audio.file_id);
        if (file) {
          const ext = getExtFromPath(file.filePath);
          const storagePath = `${userId}/telegram_${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseClient.storage
            .from("memories")
            .upload(storagePath, file.data, { contentType: getContentTypeFromExt(ext) });
          if (!uploadErr) mediaUrl = storagePath;
        }
      }
    } else if (message.document) {
      // Documents with image/video MIME types
      const mime = message.document.mime_type || "";
      if (mime.startsWith("image/")) memoryType = "photo";
      else if (mime.startsWith("video/")) memoryType = "video";
      else if (mime.startsWith("audio/")) memoryType = "audio";
      content = content || message.document.file_name || "File from Telegram";

      if (message.document.file_id && botToken) {
        const file = await downloadTelegramFile(botToken, message.document.file_id);
        if (file) {
          const ext = getExtFromPath(file.filePath);
          const storagePath = `${userId}/telegram_${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseClient.storage
            .from("memories")
            .upload(storagePath, file.data, { contentType: mime || getContentTypeFromExt(ext) });
          if (!uploadErr) mediaUrl = storagePath;
        }
      }
    }

    const today = new Date().toISOString().split("T")[0];

    // AI mood analysis (non-blocking)
    let aiAnalysis = null;
    let mood = "💬";
    try {
      const analyzeRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-mood`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ content, memoryType, mediaUrl }),
        }
      );
      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        if (data && !data.error) {
          aiAnalysis = data;
          mood = data.emoji || "💬";
        }
      }
    } catch { /* non-blocking */ }

    // Create the memory
    const { data: memory, error: memoryError } = await supabaseClient
      .from("memories")
      .insert({
        user_id: userId,
        memory_type: memoryType,
        memory_date: today,
        content,
        title: "Telegram Memory",
        mood,
        media_url: mediaUrl,
        ai_analysis: aiAnalysis,
        event_category: "social",
        emotion_category: aiAnalysis?.emotion_category || "connection",
        sentiment_score: aiAnalysis?.sentiment_score || null,
      })
      .select("id")
      .single();

    if (memoryError) {
      logStep("Failed to create memory", { error: memoryError.message });
      await supabaseClient.from("social_import_logs").insert({
        user_id: userId, platform: "telegram", source_message_id: msgIdStr,
        status: "failed", error_message: memoryError.message,
      });
      return new Response(JSON.stringify({ status: "error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    await supabaseClient.from("social_import_logs").insert({
      user_id: userId, platform: "telegram", memory_id: memory.id,
      source_message_id: msgIdStr, status: "completed",
    });

    // Increment usage
    await supabaseClient.rpc("increment_memory_usage", {
      _subscription_id: userSub.plan_id,
    }).catch(() => {});

    // Notification
    await supabaseClient.rpc("create_system_notification", {
      _user_id: userId,
      _type: "social_import",
      _content: `💬 New memory captured from Telegram`,
      _reference_id: memory.id,
    }).catch(() => {});

    // Confirmation reply
    const mediaEmoji = mediaUrl ? (memoryType === "photo" ? "📷" : memoryType === "video" ? "🎥" : "🎤") : "📝";
    await sendReply(chatId, `✅ ${mediaEmoji} Memory saved! ${mood}`, message.message_id);

    logStep("Memory created", { memoryId: memory.id, userId, hasMedia: !!mediaUrl });

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
