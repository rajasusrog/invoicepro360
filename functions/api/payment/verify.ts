import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateRequest, getServerSupabase, getUserSubscription } from "../../_subscription";
import { 
  getRazorpayConfig, 
  verifyRazorpaySignature, 
  fetchRazorpayPayment, 
  activateSubscriptionPayment 
} from "../../_payment";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 1. Authenticate user via Supabase Bearer token
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse("Authentication required to verify payment.", 401, "AUTH_REQUIRED");
    }

    // 2. Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, "BAD_REQUEST");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return errorResponse(
        "Missing required payment verification parameters (order_id, payment_id, signature).",
        400,
        "INVALID_PAYMENT_DATA"
      );
    }

    const config = getRazorpayConfig(env);
    if (!config.isConfigured || !config.keySecret) {
      return errorResponse("Razorpay gateway secrets not configured on server.", 503, "GATEWAY_NOT_CONFIGURED");
    }

    // 3. Cryptographically verify signature
    const isValidSignature = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    }, env);

    if (!isValidSignature) {
      // Record potential tampering attempt
      console.error("Payment signature verification failed for user:", auth.user.id);
      return errorResponse(
        "Payment signature verification failed. Potential tampering detected.",
        400,
        "INVALID_SIGNATURE"
      );
    }

    // 4. Verify payment status directly with Razorpay API
    let paymentDetails: any = null;
    try {
      paymentDetails = await fetchRazorpayPayment(razorpay_payment_id, env);
      if (paymentDetails.status !== "captured" && paymentDetails.status !== "authorized") {
        return errorResponse(
          `Payment not confirmed by gateway (Status: ${paymentDetails.status}).`,
          400,
          "PAYMENT_NOT_CAPTURED"
        );
      }
    } catch (rzpErr: any) {
      console.warn("Could not query Razorpay API directly, proceeding with valid cryptographic signature:", rzpErr.message);
    }

    // 5. Look up the pending payment record in Supabase
    const supabase = getServerSupabase(env);
    let paymentId: string | null = null;
    if (supabase) {
      const { data: existingPayment } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("gateway_order_id", razorpay_order_id)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (existingPayment) {
        paymentId = existingPayment.id;
      }
    }

    // 6. Idempotently activate the subscription
    if (paymentId) {
      const activationResult = await activateSubscriptionPayment({
        paymentId,
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature
      }, env);

      if (!activationResult.success) {
        return errorResponse(
          activationResult.message || "Failed to activate subscription.",
          500,
          activationResult.code || "ACTIVATION_FAILED"
        );
      }
    }

    // 7. Return fresh updated subscription info
    const updatedSub = await getUserSubscription(auth.user.id, env);

    return jsonResponse({
      success: true,
      message: "Payment successfully verified and subscription activated.",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      subscription: updatedSub
    });
  } catch (err: any) {
    console.error("Payment verify POST error:", err);
    return errorResponse(err.message || "Failed to verify payment.", 500, "SERVER_ERROR");
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
