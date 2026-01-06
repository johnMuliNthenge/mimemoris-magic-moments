import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-STRIPE-PRICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { planId, newPrice, tier } = await req.json();
    if (!planId || newPrice === undefined || !tier) {
      throw new Error("Plan ID, new price, and tier are required");
    }
    logStep("Request data received", { planId, newPrice, tier });

    // Verify admin role
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("Admin verified", { userId: user.id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get current plan to find the product ID
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("stripe_product_id, stripe_price_id")
      .eq("id", planId)
      .single();

    if (planError) throw new Error(`Failed to fetch plan: ${planError.message}`);
    logStep("Current plan fetched", { plan });

    let productId = plan?.stripe_product_id;

    // If no product exists, create one
    if (!productId) {
      const product = await stripe.products.create({
        name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
        metadata: { tier },
      });
      productId = product.id;
      logStep("Created new Stripe product", { productId });
    }

    // Archive old price if it exists
    if (plan?.stripe_price_id) {
      try {
        await stripe.prices.update(plan.stripe_price_id, { active: false });
        logStep("Archived old price", { oldPriceId: plan.stripe_price_id });
      } catch (e) {
        logStep("Could not archive old price (may not exist)", { error: e });
      }
    }

    // Create new price in Stripe
    const priceInCents = Math.round(newPrice * 100);
    const newStripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: priceInCents,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier, plan_id: planId },
    });
    logStep("Created new Stripe price", { priceId: newStripePrice.id, amount: priceInCents });

    // Update the plan in database with new Stripe IDs
    const { error: updateError } = await supabaseClient
      .from("subscription_plans")
      .update({
        stripe_price_id: newStripePrice.id,
        stripe_product_id: productId,
        price_monthly: newPrice,
      })
      .eq("id", planId);

    if (updateError) throw new Error(`Failed to update plan: ${updateError.message}`);
    logStep("Database updated with new price ID");

    return new Response(JSON.stringify({ 
      success: true, 
      stripe_price_id: newStripePrice.id,
      stripe_product_id: productId 
    }), {
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
