import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WHATSAPP-IMPORT] ${step}${detailsStr}`);
};

async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    // Step 1: Get media URL
    const urlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!urlRes.ok) {
      logStep("Failed to get media URL", { status: urlRes.status });
      return null;
    }
    const urlData = await urlRes.json();
    const mediaUrl = urlData.url;
    if (!mediaUrl) return null;

    // Step 2: Download the actual media file
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaRes.ok) {
      logStep("Failed to download media", { status: mediaRes.status });
      return null;
    }
    const data = await mediaRes.arrayBuffer();
    const contentType = mediaRes.headers.get("content-type") || "application/octet-stream";
    return { data, contentType };
  } catch (err) {
    logStep("Media download error", { error: String(err) });
    return null;
  }
}

function getExtFromContentType(ct: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac",
  };
  return map[ct] || "bin";
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
    // WhatsApp webhook verification (GET)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      const { data: config } = await supabaseClient
        .from("social_import_config")
        .select("config")
        .eq("platform", "whatsapp")
        .single();

      const verifyToken = config?.config?.verify_token;

      if (mode === "subscribe" && token === verifyToken) {
        logStep("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      } else {
        logStep("Webhook verification failed", { mode, tokenMatch: token === verifyToken });
        return new Response("Forbidden", { status: 403 });
      }
    }

    // Handle incoming messages (POST)
    const body = await req.json();
    logStep("Received webhook payload", { entry: body?.entry?.length });

    if (!body.entry || !body.entry.length) {
      return new Response(JSON.stringify({ status: "no entries" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get WhatsApp config for media download
    const { data: waConfig } = await supabaseClient
      .from("social_import_config")
      .select("config")
      .eq("platform", "whatsapp")
      .single();
    const accessToken = waConfig?.config?.access_token || "";

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const messages = change.value?.messages || [];
        const contacts = change.value?.contacts || [];

        for (const message of messages) {
          const senderPhone = message.from;
          const messageId = message.id;

          logStep("Processing message", { from: senderPhone, type: message.type, id: messageId });

          // Duplicate detection - check if already imported
          const { data: existingLog } = await supabaseClient
            .from("social_import_logs")
            .select("id")
            .eq("source_message_id", messageId)
            .eq("platform", "whatsapp")
            .eq("status", "completed")
            .maybeSingle();

          if (existingLog) {
            logStep("Duplicate message, skipping", { messageId });
            continue;
          }

          // Normalize phone number
          const phoneVariants = [
            senderPhone,
            `+${senderPhone}`,
            senderPhone.replace(/^\+/, ''),
          ];

          // Find user by WhatsApp number
          let userId: string | null = null;
          for (const phone of phoneVariants) {
            const { data: profile } = await supabaseClient
              .from("profiles")
              .select("user_id")
              .eq("whatsapp_number", phone)
              .maybeSingle();

            if (profile) {
              userId = profile.user_id;
              break;
            }
          }

          if (!userId) {
            logStep("No user found for phone", { phone: senderPhone });
            await supabaseClient.from("social_import_logs").insert({
              user_id: "00000000-0000-0000-0000-000000000000",
              platform: "whatsapp",
              source_message_id: messageId,
              status: "failed",
              error_message: `No user found with WhatsApp number: ${senderPhone}`,
            });
            continue;
          }

          // Check subscription & plan
          const { data: userSub } = await supabaseClient
            .from("user_subscriptions")
            .select("plan_id, memories_used_today")
            .eq("user_id", userId)
            .eq("status", "active")
            .maybeSingle();

          if (!userSub) {
            logStep("No active subscription", { userId });
            await supabaseClient.from("social_import_logs").insert({
              user_id: userId, platform: "whatsapp", source_message_id: messageId,
              status: "failed", error_message: "No active subscription",
            });
            continue;
          }

          const { data: platformEnabled } = await supabaseClient
            .from("plan_social_platforms")
            .select("is_enabled")
            .eq("plan_id", userSub.plan_id)
            .eq("platform", "whatsapp")
            .maybeSingle();

          if (!platformEnabled?.is_enabled) {
            logStep("WhatsApp not enabled for plan", { userId });
            await supabaseClient.from("social_import_logs").insert({
              user_id: userId, platform: "whatsapp", source_message_id: messageId,
              status: "failed", error_message: "WhatsApp import not enabled for your plan",
            });
            continue;
          }

          // Check daily limit
          const { data: planInfo } = await supabaseClient
            .from("subscription_plans")
            .select("daily_memory_limit")
            .eq("id", userSub.plan_id)
            .single();

          if (planInfo && (userSub.memories_used_today || 0) >= planInfo.daily_memory_limit) {
            logStep("Daily memory limit reached", { userId });
            await supabaseClient.from("social_import_logs").insert({
              user_id: userId, platform: "whatsapp", source_message_id: messageId,
              status: "failed", error_message: "Daily memory limit reached",
            });
            continue;
          }

          // Extract content and download media
          let content = "";
          let memoryType: "text" | "photo" | "video" | "audio" = "text";
          let mediaUrl: string | null = null;

          switch (message.type) {
            case "text":
              content = message.text?.body || "";
              memoryType = "text";
              break;
            case "image": {
              content = message.image?.caption || "Photo from WhatsApp";
              memoryType = "photo";
              const imgMediaId = message.image?.id;
              if (imgMediaId && accessToken) {
                const media = await downloadWhatsAppMedia(imgMediaId, accessToken);
                if (media) {
                  const ext = getExtFromContentType(media.contentType);
                  const filePath = `${userId}/whatsapp_${Date.now()}.${ext}`;
                  const { error: uploadErr } = await supabaseClient.storage
                    .from("memories")
                    .upload(filePath, media.data, { contentType: media.contentType });
                  if (!uploadErr) mediaUrl = filePath;
                  else logStep("Upload failed", { error: uploadErr.message });
                }
              }
              break;
            }
            case "video": {
              content = message.video?.caption || "Video from WhatsApp";
              memoryType = "video";
              const vidMediaId = message.video?.id;
              if (vidMediaId && accessToken) {
                const media = await downloadWhatsAppMedia(vidMediaId, accessToken);
                if (media) {
                  const ext = getExtFromContentType(media.contentType);
                  const filePath = `${userId}/whatsapp_${Date.now()}.${ext}`;
                  const { error: uploadErr } = await supabaseClient.storage
                    .from("memories")
                    .upload(filePath, media.data, { contentType: media.contentType });
                  if (!uploadErr) mediaUrl = filePath;
                }
              }
              break;
            }
            case "audio": {
              content = "Voice note from WhatsApp";
              memoryType = "audio";
              const audioMediaId = message.audio?.id || message.voice?.id;
              if (audioMediaId && accessToken) {
                const media = await downloadWhatsAppMedia(audioMediaId, accessToken);
                if (media) {
                  const ext = getExtFromContentType(media.contentType);
                  const filePath = `${userId}/whatsapp_${Date.now()}.${ext}`;
                  const { error: uploadErr } = await supabaseClient.storage
                    .from("memories")
                    .upload(filePath, media.data, { contentType: media.contentType });
                  if (!uploadErr) mediaUrl = filePath;
                }
              }
              break;
            }
            default:
              content = `${message.type} message from WhatsApp`;
              memoryType = "text";
          }

          const contactName = contacts.find((c: any) => c.wa_id === senderPhone)?.profile?.name || "";
          const today = new Date().toISOString().split("T")[0];

          // Run AI mood analysis (non-blocking)
          let aiAnalysis = null;
          let mood = "📱";
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
                mood = data.emoji || "📱";
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
              title: contactName ? `WhatsApp from ${contactName}` : "WhatsApp Memory",
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
              user_id: userId, platform: "whatsapp", source_message_id: messageId,
              status: "failed", error_message: memoryError.message,
            });
            continue;
          }

          await supabaseClient.from("social_import_logs").insert({
            user_id: userId, platform: "whatsapp", memory_id: memory.id,
            source_message_id: messageId, status: "completed",
          });

          // Increment daily usage
          await supabaseClient.rpc("increment_memory_usage", {
            _subscription_id: userSub.plan_id,
          }).catch(() => {});

          // Create notification
          await supabaseClient.rpc("create_system_notification", {
            _user_id: userId,
            _type: "social_import",
            _content: `📱 New memory captured from WhatsApp${contactName ? ` (${contactName})` : ""}`,
            _reference_id: memory.id,
          }).catch(() => {});

          logStep("Memory created", { memoryId: memory.id, userId, hasMedia: !!mediaUrl });
        }
      }
    }

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
