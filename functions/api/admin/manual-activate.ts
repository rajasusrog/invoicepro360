import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateAdminRequest, appendAdminAuditLog } from "../../_admin_auth";
import { getServerSupabase, CENTRAL_PLANS, SubscriptionTierId } from "../../_subscription";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const adminAuth = await authenticateAdminRequest(request.headers, env);
    if (!adminAuth.authorized || !adminAuth.adminUser) {
      return errorResponse(adminAuth.error || "Access denied: Super Admin privilege required.", adminAuth.status, adminAuth.code);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400, "BAD_REQUEST");
    }

    const { userId, planId, billingCycle = "monthly", justification } = body || {};

    if (!userId || !planId) {
      return errorResponse("userId and planId are required.", 400, "MISSING_FIELDS");
    }

    if (!justification || !justification.trim()) {
      return errorResponse("A mandatory audit justification is required for manual subscription activation.", 400, "JUSTIFICATION_REQUIRED");
    }

    const validPlans: SubscriptionTierId[] = ["basic", "standard", "professional", "elite", "ultra"];
    if (!validPlans.includes(planId)) {
      return errorResponse(`Invalid planId: ${planId}`, 400, "INVALID_PLAN");
    }

    const supabase = getServerSupabase(env);
    const months = billingCycle === "annual" ? 12 : 1;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    if (supabase) {
      // 1. Insert manual payment record
      const { data: paymentRow } = await supabase
        .from("subscription_payments")
        .insert({
          user_id: userId,
          plan_id: planId,
          billing_cycle: billingCycle,
          amount_inr: CENTRAL_PLANS[planId as SubscriptionTierId]?.priceInr || 0,
          tax_inr: 0,
          currency: "INR",
          status: "paid",
          gateway: "manual_admin",
          manual_admin_granted: true,
          granted_by: adminAuth.adminUser.email,
          justification: justification.trim(),
          paid_at: new Date().toISOString()
        })
        .select()
        .single();

      // 2. Activate subscription
      await supabase
        .from("subscriptions")
        .upsert({
          user_id: userId,
          plan_id: planId,
          status: "active",
          billing_cycle: billingCycle,
          payment_reference: `admin_${adminAuth.adminUser.id.slice(0, 8)}`,
          current_period_start: new Date().toISOString(),
          current_period_end: expiryDate.toISOString(),
          expires_at: expiryDate.toISOString(),
          invoices_used: 0,
          ai_generations_used: 0,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      // 3. Append to Admin Audit Log
      await appendAdminAuditLog({
        adminEmail: adminAuth.adminUser.email,
        adminUserId: adminAuth.adminUser.id,
        action: "manual_subscription_activation",
        targetType: "subscription",
        targetId: userId,
        justification: justification.trim(),
        metadata: {
          plan_id: planId,
          billing_cycle: billingCycle,
          expires_at: expiryDate.toISOString(),
          payment_id: paymentRow?.id
        }
      }, env);
    }

    return jsonResponse({
      success: true,
      message: `Successfully granted ${planId} tier to user.`,
      planId,
      billingCycle,
      expiresAt: expiryDate.toISOString()
    });
  } catch (err: any) {
    console.error("Manual activation error:", err);
    return errorResponse(err.message || "Failed to execute manual activation.", 500, "SERVER_ERROR");
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};
