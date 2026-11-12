import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateAdminRequest } from "../../_admin_auth";
import { getServerSupabase } from "../../_subscription";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const adminAuth = await authenticateAdminRequest(request.headers, env);
    if (!adminAuth.authorized) {
      return errorResponse(adminAuth.error || "Access denied: Super Admin privilege required.", adminAuth.status, adminAuth.code);
    }

    const url = new URL(request.url);
    const filterStatus = url.searchParams.get("status") || "all";
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    const supabase = getServerSupabase(env);
    if (!supabase || adminAuth.adminUser?.id === "local-dev-user") {
      // Mock payments ledger for local dev
      const mockPayments = [
        {
          id: "pay-101",
          userId: "usr-demo-2",
          userEmail: "priya.mehta@techcorp.in",
          planId: "professional",
          billingCycle: "annual",
          amountInr: 1768.82,
          taxInr: 269.82,
          currency: "INR",
          status: "paid",
          gateway: "razorpay",
          gatewayOrderId: "order_PX9928172",
          gatewayPaymentId: "pay_PX9928172_01",
          manualAdminGranted: false,
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          paidAt: new Date(Date.now() - 2 * 86400000).toISOString()
        },
        {
          id: "pay-102",
          userId: "usr-demo-1",
          userEmail: "raj.asusrog@gmail.com",
          planId: "elite",
          billingCycle: "monthly",
          amountInr: 4718.82,
          taxInr: 719.82,
          currency: "INR",
          status: "paid",
          gateway: "manual_admin",
          manualAdminGranted: true,
          grantedBy: "system_provision",
          justification: "Verified initial super admin provision",
          createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          paidAt: new Date(Date.now() - 10 * 86400000).toISOString()
        }
      ];

      return jsonResponse({ payments: mockPayments });
    }

    let query = supabase
      .from("subscription_payments")
      .select("id, user_id, plan_id, billing_cycle, amount_inr, tax_inr, currency, status, gateway, gateway_order_id, gateway_payment_id, manual_admin_granted, granted_by, justification, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data: rows, error: queryError } = await query;
    if (queryError) {
      console.error("Error querying subscription_payments for admin:", queryError);
      return errorResponse(queryError.message, 500, "DB_ERROR");
    }

    return jsonResponse({ payments: rows || [] });
  } catch (err: any) {
    console.error("Admin payments GET error:", err);
    return errorResponse(err.message || "Failed to query payments.", 500, "SERVER_ERROR");
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};
