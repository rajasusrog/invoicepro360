import {
  jsonResponse,
  errorResponse,
  authenticateRequest,
  cancelUserSubscription
} from "../../_billing";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse(auth.error || "Authentication required.", 401, "AUTH_REQUIRED");
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // default to end of period cancellation
    }

    const mode = String(body?.mode || "period_end").toLowerCase();
    const cancelAtCycleEnd = mode !== "immediate";

    const updatedSubscription = await cancelUserSubscription(auth.user.id, cancelAtCycleEnd, env);

    return jsonResponse({
      cancelled: true,
      mode: cancelAtCycleEnd ? "period_end" : "immediate",
      message: cancelAtCycleEnd
        ? "Your recurring subscription will not renew. You retain full access to your current tier until the end of the paid billing period."
        : "Your recurring subscription has been cancelled immediately and reverted to the Basic tier.",
      subscription: updatedSubscription
    });
  } catch (err: any) {
    console.error("POST /api/billing/cancel error:", err);
    return errorResponse(err.message || "Failed to cancel subscription.", 400, "CANCEL_ERROR");
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
