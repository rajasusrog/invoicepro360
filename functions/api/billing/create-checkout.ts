import {
  jsonResponse,
  errorResponse,
  authenticateRequest,
  findBillingPlanVariant,
  computeGstPricingFromPaise,
  getRazorpayGatewayConfig,
  createPendingPaymentRecord,
  createGatewayOrderForLifetime,
  createGatewaySubscription
} from "../../_billing";

interface Env {
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 1. Require authenticated user
    const auth = await authenticateRequest(request.headers, env);
    if (!auth.user) {
      return errorResponse(auth.error || "Authentication required before checkout.", 401, "AUTH_REQUIRED");
    }

    if (auth.user.is_suspended) {
      return errorResponse("Your account is restricted from initiating new billing checkouts.", 403, "ACCOUNT_SUSPENDED");
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON request payload.", 400, "BAD_REQUEST");
    }

    // Reject any client attempt to supply custom price, amount, or quota overrides
    if (
      body?.amount !== undefined ||
      body?.amountPaise !== undefined ||
      body?.pricePaise !== undefined ||
      body?.price !== undefined ||
      body?.priceInr !== undefined ||
      body?.invoiceQuota !== undefined ||
      body?.aiQuota !== undefined
    ) {
      return errorResponse(
        "Client-supplied price or quota parameters are not permitted. Pricing is loaded exclusively from the server catalogue.",
        400,
        "CLIENT_PRICE_REJECTED"
      );
    }

    const planCode = String(body?.planCode || body?.planId || "").toLowerCase().trim();
    const billingCycle = String(body?.billingCycle || "monthly").toLowerCase().trim();

    if (!planCode || !["basic", "standard", "professional", "elite", "ultra"].includes(planCode)) {
      return errorResponse("Invalid or unrecognized plan identifier.", 400, "INVALID_PLAN");
    }

    if (!["monthly", "annual", "lifetime"].includes(billingCycle)) {
      return errorResponse("Billing cycle must be 'monthly', 'annual', or 'lifetime'.", 400, "INVALID_BILLING_CYCLE");
    }

    if (planCode === "basic") {
      return errorResponse("Basic is the default free plan and does not require payment checkout.", 400, "FREE_PLAN_NO_CHECKOUT");
    }

    // 2. Load authoritative plan definition & price from trusted server store / Supabase
    const plan = await findBillingPlanVariant(planCode, billingCycle, env);
    if (!plan || !plan.isActive) {
      return errorResponse("Selected plan variant is not active or available.", 404, "PLAN_NOT_FOUND");
    }

    // 3. Reject if price is unset (e.g., Ultra tier)
    if (plan.pricePaise === null || plan.pricePaise <= 0) {
      return errorResponse(
        `Pricing for ${plan.planName} (${plan.billingCycle}) is not configured for self-serve checkout. Please contact enterprise sales or configure the plan price in Supabase.`,
        422,
        "PRICE_UNSET"
      );
    }

    const gst = computeGstPricingFromPaise(plan.pricePaise);
    const gateway = getRazorpayGatewayConfig(env);

    if (!gateway.isConfigured || !gateway.keyId || !gateway.keySecret) {
      return errorResponse(
        "Razorpay payment gateway credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server.",
        503,
        "GATEWAY_NOT_CONFIGURED"
      );
    }

    const notes = {
      userId: String(auth.user.id),
      userEmail: String(auth.user.email || ""),
      planCode: plan.planCode,
      billingCycle: plan.billingCycle
    };

    // 4A. Monthly & Annual Recurring Plans -> Create Razorpay Subscription
    if (plan.billingCycle === "monthly" || plan.billingCycle === "annual") {
      if (!plan.razorpayPlanId) {
        return errorResponse(
          `Recurring Razorpay Plan ID (razorpay_plan_id) is not configured in billing_plans for ${plan.planName} (${plan.billingCycle}).`,
          503,
          "RAZORPAY_PLAN_ID_MISSING"
        );
      }

      const totalCount = plan.billingCycle === "annual" ? 10 : 60; // 10 years or 60 months mandate ceiling
      const rzpSubscription = await createGatewaySubscription(
        {
          razorpayPlanId: plan.razorpayPlanId,
          totalCount,
          notes
        },
        env
      );

      const pendingPayment = await createPendingPaymentRecord(
        {
          userId: auth.user.id,
          plan,
          razorpaySubscriptionId: rzpSubscription.id,
          baseAmountPaise: gst.baseAmountPaise,
          taxAmountPaise: gst.taxAmountPaise,
          amountPaise: gst.totalAmountPaise,
          paymentType: "subscription_charge"
        },
        env
      );

      return jsonResponse({
        checkoutType: "subscription",
        paymentRecordId: pendingPayment.id,
        keyId: gateway.keyId,
        subscriptionId: rzpSubscription.id,
        orderId: null,
        planCode: plan.planCode,
        planName: plan.planName,
        billingCycle: plan.billingCycle,
        currency: plan.currency,
        baseAmountPaise: gst.baseAmountPaise,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        taxAmountPaise: gst.taxAmountPaise,
        totalAmountPaise: gst.totalAmountPaise,
        invoiceQuota: plan.invoiceQuota,
        aiQuota: plan.aiQuota
      });
    }

    // 4B. Lifetime One-Time Purchase -> Create Pending Payment + Razorpay Order
    const receipt = `lt_${auth.user.id.slice(0, 8)}_${Date.now()}`;
    const rzpOrder = await createGatewayOrderForLifetime(
      {
        amountPaise: gst.totalAmountPaise,
        currency: plan.currency,
        receipt,
        notes
      },
      env
    );

    const pendingPayment = await createPendingPaymentRecord(
      {
        userId: auth.user.id,
        plan,
        razorpayOrderId: rzpOrder.id,
        baseAmountPaise: gst.baseAmountPaise,
        taxAmountPaise: gst.taxAmountPaise,
        amountPaise: gst.totalAmountPaise,
        paymentType: "one_time_lifetime"
      },
      env
    );

    return jsonResponse({
      checkoutType: "order",
      paymentRecordId: pendingPayment.id,
      keyId: gateway.keyId,
      orderId: rzpOrder.id,
      subscriptionId: null,
      planCode: plan.planCode,
      planName: plan.planName,
      billingCycle: plan.billingCycle,
      currency: plan.currency,
      baseAmountPaise: gst.baseAmountPaise,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      taxAmountPaise: gst.taxAmountPaise,
      totalAmountPaise: gst.totalAmountPaise,
      invoiceQuota: plan.invoiceQuota,
      aiQuota: plan.aiQuota
    });
  } catch (err: any) {
    console.error("POST /api/billing/create-checkout error:", err);
    return errorResponse(err.message || "Failed to initiate checkout.", 500, "CHECKOUT_ERROR");
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
