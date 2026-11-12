import {
  jsonResponse,
  errorResponse,
  authenticateRequest,
  getUserEntitlement,
  getUserBillingPayments,
  findBillingPlanVariant
} from "../../_billing";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse(auth.error || "Authentication required.", 401, "AUTH_REQUIRED");
    }

    const entitlement = await getUserEntitlement(auth.user.id, env);
    const payments = await getUserBillingPayments(auth.user.id, env);
    const cycleToLookup =
      entitlement.billingModel === "free" ? "monthly" : entitlement.billingModel;
    const planDetails = await findBillingPlanVariant(entitlement.planCode, cycleToLookup, env);

    return jsonResponse({
      subscription: {
        ...entitlement,
        planId: entitlement.planCode,
        invoicesUsedThisMonth: entitlement.invoicesUsed,
        aiGenerationsUsedThisMonth: entitlement.aiGenerationsUsed,
        invoicesRemaining:
          entitlement.invoiceQuota === -1
            ? -1
            : Math.max(0, entitlement.invoiceQuota - entitlement.invoicesUsed),
        aiGenerationsRemaining:
          entitlement.aiQuota === -1
            ? -1
            : Math.max(0, entitlement.aiQuota - entitlement.aiGenerationsUsed),
        pricePaise: planDetails?.pricePaise ?? 0,
        priceInr: planDetails?.pricePaise ? planDetails.pricePaise / 100 : 0,
        features: planDetails?.features || []
      },
      payments
    });
  } catch (err: any) {
    console.error("GET /api/billing/subscription error:", err);
    return errorResponse(err.message || "Failed to fetch subscription details.", 500, "SERVER_ERROR");
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
