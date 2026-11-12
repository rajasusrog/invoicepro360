import {
  jsonResponse,
  errorResponse,
  getServerSupabase,
  getRazorpayGatewayConfig,
  verifyWebhookRawSignature,
  checkAndRecordWebhookEvent,
  activateVerifiedEntitlement,
  SubscriptionTierId,
  BillingCycleType
} from "../../_billing";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return errorResponse("Missing x-razorpay-signature header.", 400, "MISSING_WEBHOOK_SIGNATURE");
    }

    // Validate HMAC against the exact raw request body
    const rawBody = await request.text();
    const gateway = getRazorpayGatewayConfig(env);

    if (!gateway.webhookSecret) {
      return errorResponse(
        "RAZORPAY_WEBHOOK_SECRET is not configured on the server.",
        503,
        "WEBHOOK_SECRET_NOT_CONFIGURED"
      );
    }

    const isValid = verifyWebhookRawSignature(rawBody, signature, env);
    if (!isValid) {
      return errorResponse("Invalid webhook HMAC signature.", 400, "INVALID_WEBHOOK_SIGNATURE");
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON webhook body.", 400, "BAD_WEBHOOK_JSON");
    }

    const eventType = String(payload?.event || "unknown");
    const eventId =
      request.headers.get("x-razorpay-event-id") ||
      payload?.id ||
      `${eventType}_${payload?.payload?.payment?.entity?.id || payload?.payload?.subscription?.entity?.id || payload?.created_at}`;

    // Idempotency guard: ensure duplicate webhook deliveries cannot create duplicate subscriptions or payments
    const idempotency = await checkAndRecordWebhookEvent(eventId, eventType, payload, env);
    if (idempotency.duplicate) {
      return jsonResponse({ received: true, duplicate: true, eventId });
    }

    const paymentEntity = payload?.payload?.payment?.entity;
    const subscriptionEntity = payload?.payload?.subscription?.entity;
    const supabase = getServerSupabase(env);

    if (
      (eventType === "payment.captured" ||
        eventType === "order.paid" ||
        eventType === "subscription.activated" ||
        eventType === "subscription.charged") &&
      (paymentEntity || subscriptionEntity)
    ) {
      const notes = paymentEntity?.notes || subscriptionEntity?.notes || {};
      const userId = notes.userId;
      const planCode = (notes.planCode || "standard") as SubscriptionTierId;
      const billingCycle = (notes.billingCycle || (subscriptionEntity ? "monthly" : "lifetime")) as BillingCycleType;
      const paymentId = paymentEntity?.id || `sub_pay_${subscriptionEntity?.id || Date.now()}`;
      const orderId = paymentEntity?.order_id || null;
      const subscriptionId = subscriptionEntity?.id || paymentEntity?.subscription_id || null;

      if (userId) {
        await activateVerifiedEntitlement(
          {
            userId,
            planCode,
            billingCycle,
            razorpayOrderId: orderId,
            razorpaySubscriptionId: subscriptionId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature
          },
          env
        );
      }
    } else if (
      (eventType === "payment.failed" || eventType === "subscription.halted" || eventType === "subscription.pending") &&
      (paymentEntity || subscriptionEntity)
    ) {
      const orderId = paymentEntity?.order_id;
      const subId = subscriptionEntity?.id;
      if (supabase) {
        if (orderId) {
          await supabase
            .from("billing_payments")
            .update({
              status: "failed",
              razorpay_payment_id: paymentEntity?.id || null,
              failure_reason: paymentEntity?.error_description || "Payment failed at gateway",
              updated_at: new Date().toISOString()
            })
            .eq("razorpay_order_id", orderId);
        }
        if (subId && eventType === "subscription.halted") {
          await supabase
            .from("user_subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("razorpay_subscription_id", subId);
        }
      }
    } else if (eventType === "subscription.cancelled" && subscriptionEntity) {
      const subId = subscriptionEntity.id;
      if (supabase && subId) {
        await supabase
          .from("user_subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("razorpay_subscription_id", subId);
      }
    } else if ((eventType === "refund.created" || eventType === "refund.processed") && paymentEntity) {
      const paymentId = paymentEntity.id;
      if (supabase && paymentId) {
        await supabase
          .from("billing_payments")
          .update({
            status: "refunded",
            updated_at: new Date().toISOString()
          })
          .eq("razorpay_payment_id", paymentId);
      }
    }

    return jsonResponse({ received: true, duplicate: false, eventId, eventType });
  } catch (err: any) {
    console.error("POST /api/billing/webhook error:", err);
    return errorResponse(err.message || "Failed to process billing webhook.", 500, "WEBHOOK_ERROR");
  }
};
