import { jsonResponse, errorResponse } from "../../_gemini";
import { getServerSupabase } from "../../_subscription";
import { 
  getRazorpayConfig, 
  verifyRazorpayWebhookSignature, 
  activateSubscriptionPayment 
} from "../../_payment";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return errorResponse("Missing webhook signature header.", 400, "MISSING_SIGNATURE");
    }

    const rawBody = await request.text();
    const config = getRazorpayConfig(env);

    if (!config.webhookSecret) {
      console.warn("RAZORPAY_WEBHOOK_SECRET not set; webhook signature verification skipped.");
    } else {
      const isValid = verifyRazorpayWebhookSignature(rawBody, signature, env);
      if (!isValid) {
        return errorResponse("Invalid webhook signature.", 400, "INVALID_WEBHOOK_SIGNATURE");
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse("Malformed JSON in webhook.", 400, "BAD_PAYLOAD");
    }

    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const supabase = getServerSupabase(env);

    if (event === "payment.captured" && paymentEntity) {
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      if (supabase && orderId) {
        const { data: paymentRow } = await supabase
          .from("subscription_payments")
          .select("id, status")
          .eq("gateway_order_id", orderId)
          .maybeSingle();

        if (paymentRow && paymentRow.status !== "paid") {
          await activateSubscriptionPayment({
            paymentId: paymentRow.id,
            gatewayPaymentId: paymentId,
            gatewaySignature: signature
          }, env);
        }
      }
    } else if (event === "payment.failed" && paymentEntity) {
      const orderId = paymentEntity.order_id;
      if (supabase && orderId) {
        await supabase
          .from("subscription_payments")
          .update({
            status: "failed",
            gateway_payment_id: paymentEntity.id,
            metadata: {
              failure_reason: paymentEntity.error_description || "Payment failed at gateway",
              error_code: paymentEntity.error_code
            }
          })
          .eq("gateway_order_id", orderId);
      }
    } else if ((event === "refund.created" || event === "refund.processed") && paymentEntity) {
      const paymentId = paymentEntity.id;
      if (supabase && paymentId) {
        await supabase
          .from("subscription_payments")
          .update({
            status: "refunded"
          })
          .eq("gateway_payment_id", paymentId);
      }
    }

    return jsonResponse({ received: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return errorResponse(err.message || "Failed to process webhook.", 500, "SERVER_ERROR");
  }
};
