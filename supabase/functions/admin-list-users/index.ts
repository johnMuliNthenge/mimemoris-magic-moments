import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    // Check admin role
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Not authorized - admin only");

    // List all users from auth
    const { data: authUsers, error: listError } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;

    // Get profiles
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("*");

    // Get subscriptions with plans
    const { data: subscriptions } = await supabaseClient
      .from("user_subscriptions")
      .select("*, plan:subscription_plans(id, name, tier)");

    // Get roles
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("user_id, role");

    // Get all plans for manage subscription
    const { data: plans } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    // Merge data
    const users = (authUsers?.users || []).map((authUser) => {
      const profile = profiles?.find((p) => p.user_id === authUser.id);
      const subscription = subscriptions?.find((s) => s.user_id === authUser.id);
      const userRoles = roles?.filter((r) => r.user_id === authUser.id) || [];
      const isAdmin = userRoles.some((r) => r.role === "admin");

      return {
        id: authUser.id,
        email: authUser.email || null,
        full_name: profile?.full_name || null,
        whatsapp_number: profile?.whatsapp_number || null,
        created_at: authUser.created_at,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          plan_id: subscription.plan_id,
          plan: subscription.plan,
        } : null,
        isAdmin,
      };
    });

    return new Response(JSON.stringify({ users, plans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
