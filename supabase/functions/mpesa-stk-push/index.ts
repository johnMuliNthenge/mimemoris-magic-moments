import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MPESA-STK-PUSH] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { phone_number, plan_id, amount } = await req.json();
    if (!phone_number || !plan_id || !amount) {
      throw new Error("Missing required fields: phone_number, plan_id, amount");
    }
    logStep("Request parsed", { phone_number, plan_id, amount });

    // Format phone number (ensure 254 prefix)
    let formattedPhone = phone_number.replace(/\s+/g, "").replace(/^0/, "254").replace(/^\+/, "");
    if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }
    logStep("Phone formatted", { formattedPhone });

    // Get M-Pesa config from DB
    const { data: mpesaConfig, error: configError } = await supabase
      .from("mpesa_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (configError || !mpesaConfig) {
      throw new Error("M-Pesa is not configured. Please contact admin.");
    }
    logStep("M-Pesa config loaded", { environment: mpesaConfig.environment, shortcode: mpesaConfig.shortcode });

    const isSandbox = mpesaConfig.environment === "sandbox";
    const baseUrl = isSandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    // Get OAuth token
    const authString = btoa(`${mpesaConfig.consumer_key}:${mpesaConfig.consumer_secret}`);
    const tokenRes = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${authString}` },
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      logStep("OAuth failed", tokenData);
      throw new Error("Failed to get M-Pesa access token");
    }
    logStep("OAuth token obtained");

    // Generate timestamp and password
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`);

    // Construct callback URL
    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;
    logStep("Callback URL", { callbackUrl });

    // Initiate STK Push
    const stkPayload = {
      BusinessShortCode: mpesaConfig.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: mpesaConfig.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: `Mimemoris-${plan_id.slice(0, 8)}`,
      TransactionDesc: "Subscription Payment",
    };

    logStep("Sending STK Push", { ...stkPayload, Password: "[REDACTED]" });

    const stkRes = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      }
    );

    const stkData = await stkRes.json();
    logStep("STK Push response", stkData);

    if (stkData.ResponseCode !== "0") {
      throw new Error(stkData.errorMessage || stkData.ResponseDescription || "STK Push failed");
    }

    // Record transaction in DB
    const { error: insertError } = await supabase.from("mpesa_transactions").insert({
      user_id: user.id,
      plan_id,
      phone_number: formattedPhone,
      amount,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
    });

    if (insertError) {
      logStep("Insert error", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_request_id: stkData.CheckoutRequestID,
        message: "STK Push sent. Check your phone to complete payment.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
