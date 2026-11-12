import { getAuthHeaders } from "./supabase";
import { SubscriptionTierId, BillingCycle } from "../types";

export interface BillingPlanVariant {
  id: string;
  planCode: SubscriptionTierId;
  planName: string;
  billingCycle: BillingCycle;
  pricePaise: number | null;
  baseAmountInr: number | null;
  cgstPaise: number;
  sgstPaise: number;
  taxAmountPaise: number;
  taxAmountInr: number | null;
  totalAmountPaise: number | null;
  totalAmountInr: number | null;
  currency: string;
  description: string;
  features: string[];
  invoiceQuota: number;
  aiQuota: number;
  customerQuota: number;
  teamQuota: number;
  razorpayPlanIdConfigured: boolean;
  checkoutEnabled: boolean;
  configurationStatusMessage: string | null;
}

export interface BillingCatalogueResponse {
  plans: BillingPlanVariant[];
  gatewayConfigured: boolean;
  publicKeyId: string | null;
  currency: string;
}

export interface CreateCheckoutResponse {
  checkoutType: "subscription" | "order";
  paymentRecordId: string;
  keyId: string;
  subscriptionId: string | null;
  orderId: string | null;
  planCode: SubscriptionTierId;
  planName: string;
  billingCycle: BillingCycle;
  currency: string;
  baseAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  invoiceQuota: number;
  aiQuota: number;
}

export interface BillingSubscriptionSummary {
  id: string;
  userId: string;
  planId: string;
  planCode: SubscriptionTierId;
  planName: string;
  billingModel: "free" | "monthly" | "annual" | "lifetime";
  status: "active" | "pending" | "past_due" | "cancelled" | "expired";
  razorpaySubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  lifetimeEntitlement: boolean;
  invoicesUsed: number;
  invoiceQuota: number;
  invoicesRemaining: number;
  aiGenerationsUsed: number;
  aiQuota: number;
  aiGenerationsRemaining: number;
  customerQuota: number;
  teamQuota: number;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  pricePaise: number;
  priceInr: number;
  features: string[];
}

export interface BillingPaymentItem {
  id: string;
  planCode: SubscriptionTierId;
  planName: string;
  billingCycle: BillingCycle;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySubscriptionId?: string | null;
  baseAmountPaise: number;
  taxAmountPaise: number;
  amountPaise: number;
  currency: string;
  status: "pending" | "captured" | "failed" | "refunded" | "cancelled";
  paymentType: "subscription_charge" | "one_time_lifetime" | "manual_admin";
  failureReason?: string | null;
  createdAt: string;
  paidAt?: string | null;
}

/**
 * Fetches the public active plan catalogue from `/api/billing/plans`.
 */
export async function fetchBillingCatalogue(): Promise<BillingCatalogueResponse> {
  const res = await fetch("/api/billing/plans");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Unable to load billing plans.");
  }
  return res.json();
}

/**
 * Initiates an authenticated checkout session on the server.
 * Sends ONLY `planCode` and `billingCycle` — the server loads authoritative prices and quotas from the database.
 */
export async function initiateBillingCheckout(params: {
  planCode: SubscriptionTierId;
  billingCycle: BillingCycle;
}): Promise<CreateCheckoutResponse> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch("/api/billing/create-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({
      planCode: params.planCode,
      billingCycle: params.billingCycle
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: any = new Error(data.error || "Unable to initiate checkout.");
    error.code = data.code;
    throw error;
  }
  return data;
}

/**
 * Verifies a completed Razorpay Checkout payment signature on the server.
 */
export async function verifyBillingPayment(params: {
  paymentRecordId: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string | null;
}): Promise<{ verified: boolean; alreadyActivated: boolean; subscription: BillingSubscriptionSummary }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch("/api/billing/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(params)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: any = new Error(data.error || "Payment verification failed.");
    error.code = data.code;
    throw error;
  }
  return data;
}

/**
 * Fetches the authenticated user's current subscription, usage quotas, and payment history.
 */
export async function fetchUserBillingDashboard(): Promise<{
  subscription: BillingSubscriptionSummary;
  payments: BillingPaymentItem[];
}> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch("/api/billing/subscription", {
    headers: authHeaders
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Unable to load subscription details.");
  }
  return data;
}

/**
 * Requests cancellation of an active recurring subscription (at period end or immediately).
 */
export async function requestSubscriptionCancellation(
  mode: "period_end" | "immediate" = "period_end"
): Promise<{
  cancelled: boolean;
  mode: string;
  message: string;
  subscription: BillingSubscriptionSummary;
}> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch("/api/billing/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({ mode })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Unable to cancel subscription.");
  }
  return data;
}

/**
 * Dynamically loads the official Razorpay Checkout web SDK.
 */
export function loadRazorpayCheckoutSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function formatPaiseToInr(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "Custom / Unset";
  if (paise === 0) return "₹0 (Free)";
  const inr = paise / 100;
  return `₹${inr.toLocaleString("en-IN", { minimumFractionDigits: inr % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function formatQuotaDisplay(value: number): string {
  if (value === -1) return "Configurable Fair-Use";
  return value.toLocaleString("en-IN");
}
