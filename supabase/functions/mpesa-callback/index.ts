import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MPESA-CALLBACK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // M-Pesa callbacks are POST requests, no CORS needed as it's server-to-server
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json();
    logStep("Callback received", body);

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      logStep("Invalid callback format");
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }));
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
    } = stkCallback;

    logStep("Processing callback", { CheckoutRequestID, ResultCode, ResultDesc });

    // Extract receipt number from callback metadata if successful
    let mpesaReceiptNumber = null;
    if (ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      const items = stkCallback.CallbackMetadata.Item;
      const receiptItem = items.find((i: any) => i.Name === "MpesaReceiptNumber");
      mpesaReceiptNumber = receiptItem?.Value || null;
      logStep("Receipt number", { mpesaReceiptNumber });
    }

    const status = ResultCode === 0 ? "completed" : "failed";

    // Update the transaction
    const { data: transaction, error: updateError } = await supabase
      .from("mpesa_transactions")
      .update({
        status,
        result_code: String(ResultCode),
        result_desc: ResultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
      })
      .eq("checkout_request_id", CheckoutRequestID)
      .select("*, plan:subscription_plans(*)")
      .single();

    if (updateError) {
      logStep("Update error", updateError);
    }

    // If payment successful, activate subscription
    if (status === "completed" && transaction) {
      logStep("Activating subscription for user", { userId: transaction.user_id, planId: transaction.plan_id });

      // Check if user already has a subscription
      const { data: existingSub } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", transaction.user_id)
        .maybeSingle();

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      if (existingSub) {
        // Update existing subscription
        await supabase
          .from("user_subscriptions")
          .update({
            plan_id: transaction.plan_id,
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            memories_used_today: 0,
          })
          .eq("id", existingSub.id);
        logStep("Subscription updated");
      } else {
        // Create new subscription
        await supabase.from("user_subscriptions").insert({
          user_id: transaction.user_id,
          plan_id: transaction.plan_id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          memories_used_today: 0,
        });
        logStep("Subscription created");
      }
    }

    // Respond to M-Pesa
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    // Always respond 200 to M-Pesa
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});
