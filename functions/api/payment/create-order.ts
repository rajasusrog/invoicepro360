import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateRequest, getServerSupabase, SubscriptionTierId } from "../../_subscription";
import { getRazorpayConfig, calculatePlanPricing, createRazorpayOrder } from "../../_payment";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 1. Authenticate Supabase user
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse(auth.error || "Authentication required to checkout.", 401, "AUTH_REQUIRED");
    }

    if (auth.user.is_suspended) {
      return errorResponse("Account is restricted from processing new billing orders.", 403, "ACCOUNT_SUSPENDED");
    }

    // 2. Parse and validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400, "BAD_REQUEST");
    }

    const { planId, billingCycle = "monthly" } = body || {};

    const validPlans: SubscriptionTierId[] = ["standard", "professional", "elite"];
    if (!validPlans.includes(planId)) {
      return errorResponse("Invalid plan selected for checkout. Free and Enterprise tiers do not use standard payment gateway.", 400, "INVALID_PLAN");
    }

    if (billingCycle !== "monthly" && billingCycle !== "annual") {
      return errorResponse("Billing cycle must be either 'monthly' or 'annual'.", 400, "INVALID_CYCLE");
    }

    // 3. Check Gateway Configuration
    const config = getRazorpayConfig(env);
    if (!config.isConfigured || !config.keyId) {
      return errorResponse(
        "Razorpay credentials are not configured on server. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server environment.",
        503,
        "GATEWAY_NOT_CONFIGURED",
        {
          setupInstructions: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables."
        }
      );
    }

    // 4. Calculate prices & 18% GST
    const pricing = calculatePlanPricing(planId, billingCycle);
    if (pricing.isContactUs || pricing.totalAmountPaise <= 0) {
      return errorResponse("Unable to generate order for selected tier.", 400, "PRICING_ERROR");
    }

    const receiptId = `rcpt_${auth.user.id.slice(0, 8)}_${Date.now()}`;

    // 5. Create Razorpay order via REST API
    const order = await createRazorpayOrder({
      amountPaise: pricing.totalAmountPaise,
      currency: "INR",
      receipt: receiptId,
      notes: {
        userId: auth.user.id,
        userEmail: auth.user.email || "",
        planId,
        billingCycle
      }
    }, env);

    // 6. Record pending payment in Supabase
    let paymentRecordId = "";
    const supabase = getServerSupabase(env);
    if (supabase) {
      const { data: inserted, error: insertError } = await supabase
        .from("subscription_payments")
        .insert({
          user_id: auth.user.id,
          plan_id: planId,
          billing_cycle: billingCycle,
          amount_inr: pricing.totalAmountInr,
          tax_inr: pricing.taxAmountInr,
          currency: "INR",
          status: "pending",
          gateway: "razorpay",
          gateway_order_id: order.orderId,
          metadata: {
            receipt: receiptId,
            base_amount_inr: pricing.baseAmountInr,
            discount_amount_inr: pricing.discountAmountInr,
            tax_rate_percent: 18,
            user_email: auth.user.email
          }
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert pending subscription_payment:", insertError);
      } else if (inserted) {
        paymentRecordId = inserted.id;
      }
    }

    return jsonResponse({
      success: true,
      orderId: order.orderId,
      amountPaise: order.amount,
      currency: order.currency,
      keyId: config.keyId,
      planId,
      billingCycle,
      baseAmountInr: pricing.baseAmountInr,
      taxAmountInr: pricing.taxAmountInr,
      totalAmountInr: pricing.totalAmountInr,
      paymentRecordId
    });
  } catch (err: any) {
    console.error("Payment create-order error:", err);
    return errorResponse(err.message || "Failed to create payment order.", 500, "SERVER_ERROR");
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
