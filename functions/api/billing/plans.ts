import {
  jsonResponse,
  errorResponse,
  loadActiveBillingPlans,
  computeGstPricingFromPaise,
  getRazorpayGatewayConfig
} from "../../_billing";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { env } = context;

  try {
    const rawPlans = await loadActiveBillingPlans(env);
    const gateway = getRazorpayGatewayConfig(env);

    const plans = rawPlans.map((plan) => {
      const gst = computeGstPricingFromPaise(plan.pricePaise);
      const isFree = plan.pricePaise === 0;
      const isRecurring = plan.billingCycle === "monthly" || plan.billingCycle === "annual";
      const hasGatewayPlanId = !isRecurring || Boolean(plan.razorpayPlanId);

      // Determine whether self-serve checkout is enabled for this variant
      let checkoutEnabled = false;
      let configurationStatusMessage: string | null = null;

      if (isFree) {
        checkoutEnabled = false;
        configurationStatusMessage = "Included as default free tier.";
      } else if (!gst.isPriceConfigured || plan.pricePaise === null) {
        checkoutEnabled = false;
        configurationStatusMessage =
          "Price configuration pending for this tier. Contact enterprise sales or configure price_paise in billing_plans.";
      } else if (!gateway.isConfigured) {
        checkoutEnabled = false;
        configurationStatusMessage =
          "Payment gateway credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured on the server.";
      } else if (isRecurring && !hasGatewayPlanId) {
        checkoutEnabled = false;
        configurationStatusMessage = `Recurring Razorpay Plan ID (razorpay_plan_id) is not configured for ${plan.planName} (${plan.billingCycle}).`;
      } else {
        checkoutEnabled = true;
      }

      return {
        id: plan.id,
        planCode: plan.planCode,
        planName: plan.planName,
        billingCycle: plan.billingCycle,
        pricePaise: plan.pricePaise,
        baseAmountInr: plan.pricePaise !== null ? plan.pricePaise / 100 : null,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        taxAmountPaise: gst.taxAmountPaise,
        taxAmountInr: gst.isPriceConfigured ? gst.taxAmountPaise / 100 : null,
        totalAmountPaise: gst.isPriceConfigured ? gst.totalAmountPaise : null,
        totalAmountInr: gst.isPriceConfigured ? gst.totalAmountPaise / 100 : null,
        currency: plan.currency,
        description: plan.description,
        features: plan.features,
        invoiceQuota: plan.invoiceQuota,
        aiQuota: plan.aiQuota,
        customerQuota: plan.customerQuota,
        teamQuota: plan.teamQuota,
        razorpayPlanIdConfigured: Boolean(plan.razorpayPlanId),
        checkoutEnabled,
        configurationStatusMessage
      };
    });

    return jsonResponse({
      plans,
      gatewayConfigured: gateway.isConfigured,
      publicKeyId: gateway.isConfigured ? gateway.keyId : null,
      currency: "INR"
    });
  } catch (err: any) {
    console.error("GET /api/billing/plans error:", err);
    return errorResponse(err.message || "Failed to load billing plan catalogue.", 500, "SERVER_ERROR");
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
