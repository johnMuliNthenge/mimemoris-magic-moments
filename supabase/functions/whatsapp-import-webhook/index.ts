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

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // WhatsApp webhook verification (GET request from Meta)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      // Get verify token from config
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

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const messages = change.value?.messages || [];
        const contacts = change.value?.contacts || [];

        for (const message of messages) {
          const senderPhone = message.from;
          const messageId = message.id;
          const timestamp = message.timestamp;

          logStep("Processing message", { from: senderPhone, type: message.type, id: messageId });

          // Normalize phone number - try multiple formats
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
            // Log the failed import
            await supabaseClient.from("social_import_logs").insert({
              user_id: "00000000-0000-0000-0000-000000000000",
              platform: "whatsapp",
              source_message_id: messageId,
              status: "failed",
              error_message: `No user found with WhatsApp number: ${senderPhone}`,
            });
            continue;
          }

          // Check if user's plan has WhatsApp enabled
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
              platform: "whatsapp",
              source_message_id: messageId,
              status: "failed",
              error_message: "No active subscription",
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
            logStep("WhatsApp import not enabled for user's plan", { userId });
            await supabaseClient.from("social_import_logs").insert({
              user_id: userId,
              platform: "whatsapp",
              source_message_id: messageId,
              status: "failed",
              error_message: "WhatsApp import not enabled for your plan",
            });
            continue;
          }

          // Extract message content based on type
          let content = "";
          let memoryType: "text" | "photo" | "video" | "audio" = "text";
          let mediaUrl: string | null = null;

          switch (message.type) {
            case "text":
              content = message.text?.body || "";
              memoryType = "text";
              break;
            case "image":
              content = message.image?.caption || "Photo from WhatsApp";
              memoryType = "photo";
              // Media URL would need to be downloaded via WhatsApp API
              break;
            case "video":
              content = message.video?.caption || "Video from WhatsApp";
              memoryType = "video";
              break;
            case "audio":
              content = "Voice note from WhatsApp";
              memoryType = "audio";
              break;
            default:
              content = `${message.type} message from WhatsApp`;
              memoryType = "text";
          }

          const contactName = contacts.find((c: any) => c.wa_id === senderPhone)?.profile?.name || "";
          const today = new Date().toISOString().split("T")[0];

          // Create the memory
          const { data: memory, error: memoryError } = await supabaseClient
            .from("memories")
            .insert({
              user_id: userId,
              memory_type: memoryType,
              memory_date: today,
              content: content,
              title: `WhatsApp Memory`,
              mood: "📱",
              media_url: mediaUrl,
              event_category: "social",
              emotion_category: "connection",
            })
            .select("id")
            .single();

          if (memoryError) {
            logStep("Failed to create memory", { error: memoryError.message });
            await supabaseClient.from("social_import_logs").insert({
              user_id: userId,
              platform: "whatsapp",
              source_message_id: messageId,
              status: "failed",
              error_message: memoryError.message,
            });
            continue;
          }

          // Log successful import
          await supabaseClient.from("social_import_logs").insert({
            user_id: userId,
            platform: "whatsapp",
            memory_id: memory.id,
            source_message_id: messageId,
            status: "completed",
          });

          // Update daily memory count
          await supabaseClient
            .from("user_subscriptions")
            .update({
              memories_used_today: (await supabaseClient
                .from("user_subscriptions")
                .select("memories_used_today")
                .eq("user_id", userId)
                .single()).data?.memories_used_today + 1 || 1,
            })
            .eq("user_id", userId);

          logStep("Memory created successfully", { memoryId: memory.id, userId });
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
