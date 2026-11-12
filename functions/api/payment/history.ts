import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateRequest, getServerSupabase } from "../../_subscription";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse("Authentication required to view payment history.", 401, "AUTH_REQUIRED");
    }

    const supabase = getServerSupabase(env);
    if (!supabase || auth.user.id === "local-dev-user") {
      // Return sample payment history for local dev without remote db
      const mockHistory = [
        {
          id: "pay-sample-1",
          planId: "standard",
          planName: "Standard",
          billingCycle: "monthly",
          amountInr: 588.82,
          taxInr: 89.82,
          currency: "INR",
          status: "paid",
          gateway: "razorpay",
          gatewayOrderId: "order_SAMPLE123456",
          gatewayPaymentId: "pay_SAMPLE987654",
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
          paidAt: new Date(Date.now() - 30 * 86400000).toISOString()
        }
      ];
      return jsonResponse({ payments: mockHistory });
    }

    const { data: rows, error: queryError } = await supabase
      .from("subscription_payments")
      .select("id, plan_id, billing_cycle, amount_inr, tax_inr, currency, status, gateway, gateway_order_id, gateway_payment_id, manual_admin_granted, granted_by, justification, created_at, paid_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (queryError) {
      console.error("Error fetching payment history:", queryError);
      return errorResponse(queryError.message, 500, "DB_ERROR");
    }

    const payments = (rows || []).map((row: any) => ({
      id: row.id,
      planId: row.plan_id,
      planName: (row.plan_id.charAt(0).toUpperCase() + row.plan_id.slice(1)),
      billingCycle: row.billing_cycle || "monthly",
      amountInr: Number(row.amount_inr),
      taxInr: Number(row.tax_inr || 0),
      currency: row.currency || "INR",
      status: row.status,
      gateway: row.gateway,
      gatewayOrderId: row.gateway_order_id,
      gatewayPaymentId: row.gateway_payment_id,
      manualAdminGranted: Boolean(row.manual_admin_granted),
      grantedBy: row.granted_by,
      justification: row.justification,
      createdAt: row.created_at,
      paidAt: row.paid_at
    }));

    return jsonResponse({ payments });
  } catch (err: any) {
    console.error("Payment history GET error:", err);
    return errorResponse(err.message || "Failed to fetch payment history.", 500, "SERVER_ERROR");
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
