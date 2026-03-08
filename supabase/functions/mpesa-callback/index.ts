import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MPESA-CALLBACK] ${step}${detailsStr}`);
};

serve(async (req) => {
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

    // --- SECURITY: Verify payment via Safaricom Query API before trusting callback ---
    const verifiedStatus = await verifyWithSafaricom(supabase, CheckoutRequestID);
    logStep("Safaricom verification result", { verifiedStatus });

    // Use verified status instead of trusting callback directly
    const status = verifiedStatus === "completed" ? "completed" : "failed";

    // Extract receipt number from callback metadata if successful
    let mpesaReceiptNumber = null;
    if (status === "completed" && stkCallback.CallbackMetadata?.Item) {
      const items = stkCallback.CallbackMetadata.Item;
      const receiptItem = items.find((i: any) => i.Name === "MpesaReceiptNumber");
      mpesaReceiptNumber = receiptItem?.Value || null;
      logStep("Receipt number", { mpesaReceiptNumber });
    }

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

    // If payment verified as successful, activate subscription
    if (status === "completed" && transaction) {
      logStep("Activating subscription for user", { userId: transaction.user_id, planId: transaction.plan_id });

      const { data: existingSub } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", transaction.user_id)
        .maybeSingle();

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      if (existingSub) {
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

    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Verify the transaction status directly with Safaricom's STK Query API.
 * This prevents forged callbacks from activating subscriptions.
 */
async function verifyWithSafaricom(
  supabase: any,
  checkoutRequestId: string
): Promise<"completed" | "failed"> {
  try {
    // Get M-Pesa config for API credentials
    const { data: mpesaConfig, error: configError } = await supabase
      .from("mpesa_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (configError || !mpesaConfig) {
      logStep("Cannot verify: no M-Pesa config found");
      return "failed"; // Fail-safe: reject if we can't verify
    }

    const isSandbox = mpesaConfig.environment === "sandbox";
    const baseUrl = isSandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    // Get OAuth token
    const authString = btoa(`${mpesaConfig.consumer_key}:${mpesaConfig.consumer_secret}`);
    const tokenRes = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${authString}` } }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      logStep("Verification OAuth failed", tokenData);
      return "failed";
    }

    // Generate timestamp and password for query
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`);

    // Query Safaricom for the real transaction status
    const queryRes = await fetch(
      `${baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: mpesaConfig.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      }
    );

    const queryData = await queryRes.json();
    logStep("Safaricom query response", queryData);

    // ResultCode "0" means the transaction was successful
    if (queryData.ResultCode === "0" || queryData.ResultCode === 0) {
      return "completed";
    }

    return "failed";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Verification error", { message: msg });
    return "failed"; // Fail-safe: reject unverifiable transactions
  }
}
