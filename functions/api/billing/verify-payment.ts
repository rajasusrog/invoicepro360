import {
  jsonResponse,
  errorResponse,
  authenticateRequest,
  getRazorpayGatewayConfig,
  findPendingPaymentByIdOrUser,
  verifyGatewayPaymentSignature,
  activateVerifiedEntitlement
} from "../../_billing";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 1. Authenticate user
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse(auth.error || "Authentication required to verify payment.", 401, "AUTH_REQUIRED");
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body.", 400, "BAD_REQUEST");
    }

    const paymentRecordId = body?.paymentRecordId;
    const razorpay_payment_id = body?.razorpay_payment_id || body?.razorpayPaymentId;
    const razorpay_signature = body?.razorpay_signature || body?.razorpaySignature;
    const razorpay_subscription_id = body?.razorpay_subscription_id || body?.razorpaySubscriptionId;

    if (!razorpay_payment_id || !razorpay_signature) {
      return errorResponse(
        "Missing required payment verification fields (razorpay_payment_id, razorpay_signature).",
        400,
        "MISSING_VERIFICATION_FIELDS"
      );
    }

    const gateway = getRazorpayGatewayConfig(env);
    if (!gateway.isConfigured || !gateway.keySecret) {
      return errorResponse("Razorpay gateway secret is not configured on the server.", 503, "GATEWAY_NOT_CONFIGURED");
    }

    // 2. Load the trusted pending local payment record for this user
    // IMPORTANT: For lifetime orders, we use the order ID stored in the pending server record, NEVER a client-trusted order ID.
    const pendingPayment = await findPendingPaymentByIdOrUser(
      auth.user.id,
      paymentRecordId,
      razorpay_subscription_id,
      env
    );

    if (!pendingPayment) {
      return errorResponse(
        "No matching pending payment record found for this account.",
        404,
        "PENDING_PAYMENT_NOT_FOUND"
      );
    }

    const authoritativeOrderId = pendingPayment.razorpayOrderId;
    const authoritativeSubscriptionId = pendingPayment.razorpaySubscriptionId || razorpay_subscription_id;

    // 3. Verify cryptographic HMAC-SHA256 signature using server-trusted orderId / subscriptionId
    const isSignatureValid = verifyGatewayPaymentSignature(
      {
        orderId: authoritativeOrderId,
        subscriptionId: authoritativeSubscriptionId,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      },
      env
    );

    if (!isSignatureValid) {
      return errorResponse(
        "Cryptographic payment signature verification failed. Entitlement was not activated.",
        400,
        "INVALID_PAYMENT_SIGNATURE"
      );
    }

    // 4. Confirm capture/payment status via Razorpay REST API when live credentials are used
    if (gateway.keyId && gateway.keySecret && !gateway.keyId.startsWith("rzp_test_local_")) {
      try {
        const authHeader = "Basic " + Buffer.from(`${gateway.keyId}:${gateway.keySecret}`).toString("base64");
        const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
          method: "GET",
          headers: { Authorization: authHeader }
        });
        if (payRes.ok) {
          const payData: any = await payRes.json();
          if (payData.status !== "captured" && payData.status !== "authorized") {
            return errorResponse(
              `Payment is not captured by the gateway (current status: ${payData.status}).`,
              400,
              "PAYMENT_NOT_CAPTURED"
            );
          }
          // Verify amount matches server record for one-time lifetime orders
          if (
            pendingPayment.paymentType === "one_time_lifetime" &&
            typeof payData.amount === "number" &&
            payData.amount !== pendingPayment.amountPaise
          ) {
            return errorResponse(
              "Gateway payment amount does not match the authoritative order amount.",
              400,
              "AMOUNT_MISMATCH"
            );
          }
        }
      } catch (err) {
        console.warn("Razorpay payment status lookup warning:", err);
      }
    }

    // 5. Idempotently activate entitlement
    const result = await activateVerifiedEntitlement(
      {
        userId: auth.user.id,
        planCode: pendingPayment.planCode,
        billingCycle: pendingPayment.billingCycle,
        paymentRecordId: pendingPayment.id,
        razorpayOrderId: authoritativeOrderId,
        razorpaySubscriptionId: authoritativeSubscriptionId,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      },
      env
    );

    return jsonResponse({
      verified: true,
      alreadyActivated: result.alreadyActivated,
      subscription: result.subscription
    });
  } catch (err: any) {
    console.error("POST /api/billing/verify-payment error:", err);
    return errorResponse(err.message || "Payment verification failed.", 500, "VERIFICATION_ERROR");
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
