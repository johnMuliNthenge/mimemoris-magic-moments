import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  userId: string;
  userEmail: string;
  newPlanName: string;
  previousPlanName?: string;
  type: 'upgrade' | 'downgrade' | 'new';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { userId, userEmail, newPlanName, previousPlanName, type } = payload;

    console.log(`Processing subscription notification for user ${userId}`);
    console.log(`Type: ${type}, New Plan: ${newPlanName}, Previous: ${previousPlanName || 'none'}`);

    // Generate email content based on notification type
    let subject: string;
    let htmlContent: string;

    if (type === 'upgrade') {
      subject = `🎉 Welcome to ${newPlanName}!`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #FF6B6B, #FFE66D); padding: 40px; border-radius: 16px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
            <p style="margin: 16px 0 0; font-size: 18px;">You've upgraded to ${newPlanName}</p>
          </div>
          
          <div style="padding: 32px 0;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thank you for upgrading your Memory Keeper subscription! You now have access to all the amazing features of the <strong>${newPlanName}</strong> plan.
            </p>
            
            <div style="background: #f8f9fa; padding: 24px; border-radius: 12px; margin: 24px 0;">
              <h3 style="margin: 0 0 16px; color: #333;">What's new for you:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                <li>Increased memory storage limit</li>
                <li>AI-powered mood analysis</li>
                <li>Priority support</li>
                <li>Advanced collaboration features</li>
              </ul>
            </div>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Start capturing even more precious memories today!
            </p>
          </div>
          
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px;">
              Memory Keeper - Preserve your precious moments
            </p>
          </div>
        </div>
      `;
    } else if (type === 'downgrade') {
      subject = `Your plan has been updated to ${newPlanName}`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #6366f1; padding: 40px; border-radius: 16px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Plan Updated</h1>
            <p style="margin: 16px 0 0; font-size: 18px;">You're now on the ${newPlanName} plan</p>
          </div>
          
          <div style="padding: 32px 0;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Your subscription has been updated from ${previousPlanName} to ${newPlanName}. Your new plan limits will take effect at the start of your next billing cycle.
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              If you'd like to upgrade again at any time, you can do so from your subscription settings.
            </p>
          </div>
          
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px;">
              Memory Keeper - Preserve your precious moments
            </p>
          </div>
        </div>
      `;
    } else {
      subject = `Welcome to Memory Keeper - ${newPlanName}!`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #FF6B6B, #FFE66D); padding: 40px; border-radius: 16px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Memory Keeper!</h1>
            <p style="margin: 16px 0 0; font-size: 18px;">You're on the ${newPlanName} plan</p>
          </div>
          
          <div style="padding: 32px 0;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thank you for subscribing to Memory Keeper! You're all set to start capturing and preserving your precious memories.
            </p>
            
            <div style="background: #f8f9fa; padding: 24px; border-radius: 12px; margin: 24px 0;">
              <h3 style="margin: 0 0 16px; color: #333;">Getting started:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                <li>Create your first memory</li>
                <li>Add photos, videos, and audio</li>
                <li>Use AI to analyze your moods</li>
                <li>Collaborate with family and friends</li>
              </ul>
            </div>
          </div>
          
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px;">
              Memory Keeper - Preserve your precious moments
            </p>
          </div>
        </div>
      `;
    }

    // Log the notification (in production, integrate with email service like Resend, SendGrid, etc.)
    console.log(`Email notification prepared:`);
    console.log(`To: ${userEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${type}`);

    // For now, we return success with the prepared email content
    // In production, you would integrate with an email service here
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification prepared',
        email: {
          to: userEmail,
          subject,
          type
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error processing notification:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
