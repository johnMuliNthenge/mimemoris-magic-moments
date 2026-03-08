import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FUTURE-MSG-DELIVER] ${step}${detailsStr}`);
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
    // Find messages that should be delivered now
    const { data: messages, error } = await supabaseClient
      .from("future_messages")
      .select("id, user_id, title, content, deliver_at")
      .eq("is_delivered", false)
      .lte("deliver_at", new Date().toISOString())
      .limit(50);

    if (error) throw error;

    if (!messages || messages.length === 0) {
      logStep("No messages to deliver");
      return new Response(JSON.stringify({ delivered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${messages.length} messages to deliver`);

    let delivered = 0;

    for (const msg of messages) {
      try {
        // Mark as delivered
        const { error: updateErr } = await supabaseClient
          .from("future_messages")
          .update({ is_delivered: true })
          .eq("id", msg.id);

        if (updateErr) {
          logStep("Failed to mark delivered", { id: msg.id, error: updateErr.message });
          continue;
        }

        // Create in-app notification
        await supabaseClient.rpc("create_system_notification", {
          _user_id: msg.user_id,
          _type: "future_message",
          _content: `📬 Your future message "${msg.title || 'Untitled'}" has arrived! Open it to read your past self's words.`,
          _reference_id: msg.id,
        });

        delivered++;
        logStep("Delivered message", { id: msg.id, userId: msg.user_id });
      } catch (err) {
        logStep("Error delivering message", { id: msg.id, error: String(err) });
      }
    }

    logStep(`Delivery complete: ${delivered}/${messages.length}`);

    return new Response(JSON.stringify({ delivered, total: messages.length }), {
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
