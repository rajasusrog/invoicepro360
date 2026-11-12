import crypto from "crypto";
import { getServerSupabase, CENTRAL_PLANS, SubscriptionTierId } from "./_subscription";

export interface RazorpayConfig {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  isConfigured: boolean;
}

export function getRazorpayConfig(env: any = {}): RazorpayConfig {
  const keyId = 
    env.RAZORPAY_KEY_ID || 
    (typeof process !== "undefined" ? process.env?.RAZORPAY_KEY_ID : undefined) || 
    null;

  const keySecret = 
    env.RAZORPAY_KEY_SECRET || 
    (typeof process !== "undefined" ? process.env?.RAZORPAY_KEY_SECRET : undefined) || 
    null;

  const webhookSecret = 
    env.RAZORPAY_WEBHOOK_SECRET || 
    (typeof process !== "undefined" ? process.env?.RAZORPAY_WEBHOOK_SECRET : undefined) || 
    null;

  const isConfigured = Boolean(
    keyId && 
    keySecret && 
    !keyId.includes("your-razorpay") && 
    !keySecret.includes("your-razorpay")
  );

  return { keyId, keySecret, webhookSecret, isConfigured };
}

/**
 * Calculates pricing and GST breakdown for checkout.
 * Standard Indian GST rate of 18% (9% CGST + 9% SGST).
 * Annual billing includes a 20% discount on base plan rate.
 */
export function calculatePlanPricing(planId: SubscriptionTierId, billingCycle: "monthly" | "annual" = "monthly") {
  const plan = CENTRAL_PLANS[planId];
  if (!plan || plan.isContactUs) {
    return {
      baseAmountInr: 0,
      discountAmountInr: 0,
      taxAmountInr: 0,
      totalAmountInr: 0,
      totalAmountPaise: 0,
      isContactUs: true
    };
  }

  const monthlyBase = plan.priceInr;
  let baseAmount = monthlyBase;
  let discountAmount = 0;

  if (billingCycle === "annual") {
    // 12 months with 20% discount
    const fullAnnual = monthlyBase * 12;
    discountAmount = Math.round(fullAnnual * 0.20);
    baseAmount = fullAnnual - discountAmount;
  }

  // 18% GST (CGST 9% + SGST 9%)
  const taxAmount = Math.round(baseAmount * 0.18 * 100) / 100;
  const totalAmount = Math.round((baseAmount + taxAmount) * 100) / 100;
  const totalAmountPaise = Math.round(totalAmount * 100);

  return {
    baseAmountInr: baseAmount,
    discountAmountInr: discountAmount,
    taxAmountInr: taxAmount,
    totalAmountInr: totalAmount,
    totalAmountPaise,
    isContactUs: false
  };
}

/**
 * Creates an official Razorpay Order via REST API.
 */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}, env: any = {}): Promise<{ orderId: string; amount: number; currency: string }> {
  const config = getRazorpayConfig(env);
  if (!config.isConfigured || !config.keyId || !config.keySecret) {
    throw new Error("Razorpay credentials are not configured on server.");
  }

  const authHeader = "Basic " + Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency || "INR",
      receipt: params.receipt,
      notes: params.notes || {}
    })
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || "Failed to create Razorpay order.");
  }

  return {
    orderId: data.id,
    amount: data.amount,
    currency: data.currency
  };
}

/**
 * Cryptographically verifies Razorpay payment signature HMAC SHA-256.
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}, env: any = {}): boolean {
  const config = getRazorpayConfig(env);
  if (!config.keySecret) return false;

  const payload = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", config.keySecret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf-8"),
    Buffer.from(params.signature, "utf-8")
  );
}

/**
 * Verifies Razorpay Webhook signature HMAC SHA-256.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  env: any = {}
): boolean {
  const config = getRazorpayConfig(env);
  if (!config.webhookSecret) return false;

  const expected = crypto
    .createHmac("sha256", config.webhookSecret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf-8"),
    Buffer.from(signature, "utf-8")
  );
}

/**
 * Fetches verified payment record directly from Razorpay API.
 */
export async function fetchRazorpayPayment(paymentId: string, env: any = {}): Promise<any> {
  const config = getRazorpayConfig(env);
  if (!config.isConfigured || !config.keyId || !config.keySecret) {
    throw new Error("Razorpay credentials are not configured on server.");
  }

  const authHeader = "Basic " + Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": authHeader
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || "Failed to query Razorpay payment.");
  }

  return data;
}

/**
 * Idempotently activates a user's subscription after verified payment.
 */
export async function activateSubscriptionPayment(params: {
  paymentId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
}, env: any = {}): Promise<{ success: boolean; code: string; message?: string; planId?: string }> {
  const supabase = getServerSupabase(env);
  if (!supabase) {
    return {
      success: true,
      code: "LOCAL_DEV_ACTIVATED",
      message: "Subscription activated in local development environment."
    };
  }

  try {
    const { data, error } = await supabase.rpc("activate_subscription_payment", {
      p_payment_id: params.paymentId,
      p_gateway_payment_id: params.gatewayPaymentId,
      p_gateway_signature: params.gatewaySignature || null,
      p_status: "paid"
    });

    if (error) {
      console.error("RPC activate_subscription_payment error:", error);
      // Fallback update if RPC fails
      const { data: paymentRow } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("id", params.paymentId)
        .single();

      if (paymentRow) {
        await supabase
          .from("subscription_payments")
          .update({
            status: "paid",
            gateway_payment_id: params.gatewayPaymentId,
            paid_at: new Date().toISOString()
          })
          .eq("id", params.paymentId);

        const periodIntervalMonths = paymentRow.billing_cycle === "annual" ? 12 : 1;
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + periodIntervalMonths);

        await supabase
          .from("subscriptions")
          .upsert({
            user_id: paymentRow.user_id,
            plan_id: paymentRow.plan_id,
            status: "active",
            billing_cycle: paymentRow.billing_cycle,
            payment_reference: params.gatewayPaymentId,
            current_period_start: new Date().toISOString(),
            current_period_end: expiryDate.toISOString(),
            expires_at: expiryDate.toISOString(),
            invoices_used: 0,
            ai_generations_used: 0,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });

        return {
          success: true,
          code: "ACTIVATED_FALLBACK",
          planId: paymentRow.plan_id
        };
      }
      return { success: false, code: "RPC_ERROR", message: error.message };
    }

    return data;
  } catch (err: any) {
    console.error("Exception activating subscription payment:", err);
    return { success: false, code: "EXCEPTION", message: err.message };
  }
}
