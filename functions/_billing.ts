import crypto from "node:crypto";
import { jsonResponse, errorResponse } from "./_gemini";
import { authenticateRequest, getServerSupabase, SubscriptionTierId } from "./_subscription";

export { jsonResponse, errorResponse, authenticateRequest, getServerSupabase };
export type { SubscriptionTierId };

export type BillingCycleType = "monthly" | "annual" | "lifetime";
export type BillingModelType = "free" | "monthly" | "annual" | "lifetime";
export type SubscriptionStatusType = "active" | "pending" | "past_due" | "cancelled" | "expired";

export interface BillingPlanRecord {
  id: string;
  planCode: SubscriptionTierId;
  planName: string;
  billingCycle: BillingCycleType;
  pricePaise: number | null; // null if unset (e.g., Ultra)
  currency: string;
  description: string;
  features: string[];
  invoiceQuota: number;
  aiQuota: number;
  customerQuota: number;
  teamQuota: number;
  razorpayPlanId: string | null;
  isActive: boolean;
}

export interface UserSubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  planCode: SubscriptionTierId;
  planName: string;
  billingModel: BillingModelType;
  status: SubscriptionStatusType;
  razorpaySubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  lifetimeEntitlement: boolean;
  invoicesUsed: number;
  invoiceQuota: number;
  aiGenerationsUsed: number;
  aiQuota: number;
  customerQuota: number;
  teamQuota: number;
  usagePeriodStart: string;
  usagePeriodEnd: string;
}

export interface BillingPaymentRecord {
  id: string;
  userId: string;
  planId: string;
  planCode: SubscriptionTierId;
  planName: string;
  billingCycle: BillingCycleType;
  subscriptionId?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySubscriptionId?: string | null;
  razorpaySignature?: string | null;
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
 * Authoritative fallback catalogue mirroring the Supabase `billing_plans` seed.
 * Notice `ultra` has `pricePaise: null` (unset) so checkout is disabled until configured.
 */
export const AUTHORITATIVE_BILLING_PLANS: BillingPlanRecord[] = [
  // BASIC
  {
    id: "plan-basic-monthly",
    planCode: "basic",
    planName: "Basic",
    billingCycle: "monthly",
    pricePaise: 0,
    currency: "INR",
    description: "Essential GST billing and AI invoice drafting for freelancers and sole proprietors.",
    features: [
      "10 GST invoices per month",
      "5 AI invoice generations per month",
      "Up to 25 customer & vendor records",
      "1 user workspace seat",
      "Automated CGST, SGST & IGST calculation",
      "Standard PDF & print-ready exports"
    ],
    invoiceQuota: 10,
    aiQuota: 5,
    customerQuota: 25,
    teamQuota: 1,
    razorpayPlanId: null,
    isActive: true
  },
  {
    id: "plan-basic-annual",
    planCode: "basic",
    planName: "Basic",
    billingCycle: "annual",
    pricePaise: 0,
    currency: "INR",
    description: "Essential GST billing and AI invoice drafting with monthly quota resets.",
    features: [
      "10 GST invoices per month (resets monthly)",
      "5 AI invoice generations per month",
      "Up to 25 customer & vendor records",
      "1 user workspace seat",
      "Automated CGST, SGST & IGST calculation",
      "Standard PDF & print-ready exports"
    ],
    invoiceQuota: 10,
    aiQuota: 5,
    customerQuota: 25,
    teamQuota: 1,
    razorpayPlanId: null,
    isActive: true
  },
  {
    id: "plan-basic-lifetime",
    planCode: "basic",
    planName: "Basic",
    billingCycle: "lifetime",
    pricePaise: 0,
    currency: "INR",
    description: "Permanent access to Basic GST invoicing with monthly resetting quotas.",
    features: [
      "10 GST invoices per month",
      "5 AI invoice generations per month",
      "Up to 25 customer & vendor records",
      "1 user workspace seat",
      "Automated CGST, SGST & IGST calculation"
    ],
    invoiceQuota: 10,
    aiQuota: 5,
    customerQuota: 25,
    teamQuota: 1,
    razorpayPlanId: null,
    isActive: true
  },
  // STANDARD
  {
    id: "plan-standard-monthly",
    planCode: "standard",
    planName: "Standard",
    billingCycle: "monthly",
    pricePaise: 49900,
    currency: "INR",
    description: "Built for growing businesses needing smart OCR document scanning and recurring billing.",
    features: [
      "50 GST invoices per month",
      "25 AI invoice generations per month",
      "Up to 100 customer & vendor records",
      "1 user workspace seat",
      "Smart OCR invoice scanning & extraction",
      "Payment tracking & recurring invoice schedules",
      "Automated payment reminder templates"
    ],
    invoiceQuota: 50,
    aiQuota: 25,
    customerQuota: 100,
    teamQuota: 1,
    razorpayPlanId: process.env?.RAZORPAY_PLAN_STANDARD_MONTHLY || null,
    isActive: true
  },
  {
    id: "plan-standard-annual",
    planCode: "standard",
    planName: "Standard",
    billingCycle: "annual",
    pricePaise: 479000,
    currency: "INR",
    description: "Annual Standard subscription (20% savings) with monthly resetting invoice and AI quotas.",
    features: [
      "50 GST invoices per month (resets monthly)",
      "25 AI invoice generations per month (resets monthly)",
      "Up to 100 customer & vendor records",
      "1 user workspace seat",
      "Smart OCR invoice scanning & extraction",
      "Payment tracking & recurring invoice schedules",
      "20% annual commitment savings"
    ],
    invoiceQuota: 50,
    aiQuota: 25,
    customerQuota: 100,
    teamQuota: 1,
    razorpayPlanId: process.env?.RAZORPAY_PLAN_STANDARD_ANNUAL || null,
    isActive: true
  },
  {
    id: "plan-standard-lifetime",
    planCode: "standard",
    planName: "Standard",
    billingCycle: "lifetime",
    pricePaise: 1499900,
    currency: "INR",
    description: "One-time purchase for perpetual Standard access with monthly resetting fair-use quotas.",
    features: [
      "Perpetual Standard tier access (no recurring renewals)",
      "50 GST invoices per month (fair-use monthly reset)",
      "25 AI invoice generations per month (fair-use monthly reset)",
      "Up to 100 customer & vendor records",
      "1 user workspace seat",
      "Smart OCR invoice scanning & recurring billing"
    ],
    invoiceQuota: 50,
    aiQuota: 25,
    customerQuota: 100,
    teamQuota: 1,
    razorpayPlanId: null,
    isActive: true
  },
  // PROFESSIONAL
  {
    id: "plan-professional-monthly",
    planCode: "professional",
    planName: "Professional",
    billingCycle: "monthly",
    pricePaise: 149900,
    currency: "INR",
    description: "Designed for scaling SMBs, agencies, and multi-client accounting teams.",
    features: [
      "300 GST invoices per month",
      "150 AI invoice generations per month",
      "Up to 500 customer & vendor records",
      "3 team member seats",
      "AI Ledger Copilot conversational analytics",
      "Batch CSV import & AI auto-tagging",
      "Compliance audit & HSN validation"
    ],
    invoiceQuota: 300,
    aiQuota: 150,
    customerQuota: 500,
    teamQuota: 3,
    razorpayPlanId: process.env?.RAZORPAY_PLAN_PROFESSIONAL_MONTHLY || null,
    isActive: true
  },
  {
    id: "plan-professional-annual",
    planCode: "professional",
    planName: "Professional",
    billingCycle: "annual",
    pricePaise: 1439000,
    currency: "INR",
    description: "Annual Professional subscription (20% savings) with monthly resetting invoice and AI allowances.",
    features: [
      "300 GST invoices per month (resets monthly)",
      "150 AI invoice generations per month (resets monthly)",
      "Up to 500 customer & vendor records",
      "3 team member seats",
      "AI Ledger Copilot conversational analytics",
      "Batch CSV import & AI auto-tagging",
      "20% annual commitment savings"
    ],
    invoiceQuota: 300,
    aiQuota: 150,
    customerQuota: 500,
    teamQuota: 3,
    razorpayPlanId: process.env?.RAZORPAY_PLAN_PROFESSIONAL_ANNUAL || null,
    isActive: true
  },
  {
    id: "plan-professional-lifetime",
    planCode: "professional",
    planName: "Professional",
    billingCycle: "lifetime",
    pricePaise: 3999900,
    currency: "INR",
    description: "One-time purchase for perpetual Professional access with monthly resetting fair-use quotas.",
    features: [
      "Perpetual Professional tier access (no recurring renewals)",
      "300 GST invoices per month (fair-use monthly reset)",
      "150 AI invoice generations per month (fair-use monthly reset)",
      "Up to 500 customer & vendor records",
      "3 team member seats",
      "AI Ledger Copilot & batch auto-tagging"
    ],
    invoiceQuota: 300,
    aiQuota: 150,
    customerQuota: 500,
    teamQuota: 3,
    razorpayPlanId: null,
    isActive: true
  },
  // ELITE
  {
    id: "plan-elite-monthly",
    planCode: "elite",
    planName: "Elite",
    billingCycle: "monthly",
    pricePaise: 399900,
    currency: "INR",
    description: "High-volume commercial operations, wholesale distributors, and multi-branch finance teams.",
    features: [
      "1,000 GST invoices per month",
      "500 AI invoice generations per month",
      "Up to 2,000 customer & vendor records",
      "10 team member seats",
      "Multi-LLM provider routing (Gemini & OpenAI)",
      "Custom invoice templates & brand identity",
      "Priority compliance reporting & bulk ZIP exports"
    ],
    invoiceQuota: 1000,
    aiQuota: 500,
    customerQuota: 2000,
    teamQuota: 10,
    razorpayPlanId: process.env?.RAZORPAY_PLAN_ELITE_MONTHLY || null,
    isActive: true
  },
  {
    id: "plan-elite-annual",
    planCode: "elite",
    planName: "Elite",
    billingCycle: "annual",
    pricePaise: 3839000,
    currency: "INR",
    description: "Annual Elite subscription (20% savings) with monthly resetting invoice and AI allowances.",
    features: [
      "1,000 GST invoices per month (resets monthly)",
      "500 AI invoice generations per month (resets monthly)",
      "Up to 2,000 customer & vendor records",
      "10 team member seats",
      "Multi-LLM provider routing (Gemini & OpenAI)",
      "Custom invoice templates & brand identity",
      "20% annual commitment savings"
    ],
    invoiceQuota: 1000,
    aiQuota: 500,
    customerQuota: 2000,
    teamQuota: 10,
    razorpayPlanId: process.env?.RAZORPAY_PLAN_ELITE_ANNUAL || null,
    isActive: true
  },
  {
    id: "plan-elite-lifetime",
    planCode: "elite",
    planName: "Elite",
    billingCycle: "lifetime",
    pricePaise: 9999900,
    currency: "INR",
    description: "One-time purchase for perpetual Elite access with monthly resetting fair-use allowances.",
    features: [
      "Perpetual Elite tier access (no recurring renewals)",
      "1,000 GST invoices per month (fair-use monthly reset)",
      "500 AI invoice generations per month (fair-use monthly reset)",
      "Up to 2,000 customer & vendor records",
      "10 team member seats",
      "Multi-LLM provider routing & custom branding"
    ],
    invoiceQuota: 1000,
    aiQuota: 500,
    customerQuota: 2000,
    teamQuota: 10,
    razorpayPlanId: null,
    isActive: true
  },
  // ULTRA (Price unset -> Checkout disabled until configured)
  {
    id: "plan-ultra-monthly",
    planCode: "ultra",
    planName: "Ultra",
    billingCycle: "monthly",
    pricePaise: null,
    currency: "INR",
    description: "Bespoke enterprise deployment with configurable fair-use throughput and dedicated SLA.",
    features: [
      "Configurable fair-use invoice volume",
      "2,500 AI invoice generations per month (configurable)",
      "Unlimited customer & vendor directory",
      "25+ configurable team member seats",
      "Dedicated account governance & custom integrations",
      "Enterprise security & audit log retention"
    ],
    invoiceQuota: -1,
    aiQuota: 2500,
    customerQuota: -1,
    teamQuota: 25,
    razorpayPlanId: null,
    isActive: true
  },
  {
    id: "plan-ultra-annual",
    planCode: "ultra",
    planName: "Ultra",
    billingCycle: "annual",
    pricePaise: null,
    currency: "INR",
    description: "Annual enterprise contract with configurable fair-use quotas and dedicated SLA.",
    features: [
      "Configurable fair-use invoice volume (resets monthly)",
      "2,500 AI invoice generations per month (configurable)",
      "Unlimited customer & vendor directory",
      "25+ configurable team member seats",
      "Dedicated account governance & custom integrations"
    ],
    invoiceQuota: -1,
    aiQuota: 2500,
    customerQuota: -1,
    teamQuota: 25,
    razorpayPlanId: null,
    isActive: true
  },
  {
    id: "plan-ultra-lifetime",
    planCode: "ultra",
    planName: "Ultra",
    billingCycle: "lifetime",
    pricePaise: null,
    currency: "INR",
    description: "Perpetual enterprise license with configurable fair-use monthly allowances.",
    features: [
      "Perpetual Ultra enterprise license",
      "Configurable fair-use monthly invoice & AI limits",
      "Unlimited customer & vendor directory",
      "25+ configurable team member seats",
      "Dedicated onboarding & compliance support"
    ],
    invoiceQuota: -1,
    aiQuota: 2500,
    customerQuota: -1,
    teamQuota: 25,
    razorpayPlanId: null,
    isActive: true
  }
];

// Server-side in-memory ledger for hermetic testing & fallback when remote Supabase isn't configured
const memorySubscriptions = new Map<string, UserSubscriptionRecord>();
const memoryPayments = new Map<string, BillingPaymentRecord>();
const memoryWebhookEvents = new Set<string>();
const memoryUsageEvents = new Set<string>();

export interface RazorpayGatewayCredentials {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  isConfigured: boolean;
}

export function getRazorpayGatewayConfig(env: any = {}): RazorpayGatewayCredentials {
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
      !keyId.includes("your_") &&
      !keySecret.includes("your_") &&
      !keyId.includes("rzp_live_or_test")
  );

  return { keyId, keySecret, webhookSecret, isConfigured };
}

/**
 * Computes authoritative GST (18%: 9% CGST + 9% SGST) and total amount in integer paise.
 */
export function computeGstPricingFromPaise(basePaise: number | null) {
  if (basePaise === null || basePaise < 0) {
    return {
      isPriceConfigured: false,
      baseAmountPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      taxAmountPaise: 0,
      totalAmountPaise: 0
    };
  }
  const cgstPaise = Math.round(basePaise * 0.09);
  const sgstPaise = Math.round(basePaise * 0.09);
  const taxAmountPaise = cgstPaise + sgstPaise;
  const totalAmountPaise = basePaise + taxAmountPaise;
  return {
    isPriceConfigured: true,
    baseAmountPaise: basePaise,
    cgstPaise,
    sgstPaise,
    taxAmountPaise,
    totalAmountPaise
  };
}

/**
 * Loads all active billing plans from Supabase `billing_plans` (or authoritative seed if table not yet migrated).
 */
export async function loadActiveBillingPlans(env: any = {}): Promise<BillingPlanRecord[]> {
  const supabase = getServerSupabase(env);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("billing_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_paise", { ascending: true, nullsFirst: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          planCode: row.plan_code as SubscriptionTierId,
          planName: row.plan_name,
          billingCycle: row.billing_cycle as BillingCycleType,
          pricePaise: row.price_paise !== null && row.price_paise !== undefined ? Number(row.price_paise) : null,
          currency: row.currency || "INR",
          description: row.description || "",
          features: Array.isArray(row.features) ? row.features : [],
          invoiceQuota: Number(row.invoice_quota ?? 10),
          aiQuota: Number(row.ai_quota ?? 5),
          customerQuota: Number(row.customer_quota ?? 25),
          teamQuota: Number(row.team_quota ?? 1),
          razorpayPlanId: row.razorpay_plan_id || null,
          isActive: Boolean(row.is_active)
        }));
      }
    } catch (err) {
      console.warn("Fallback to authoritative billing plans catalogue:", err);
    }
  }
  return AUTHORITATIVE_BILLING_PLANS.map((plan) => {
    const envKey = `RAZORPAY_PLAN_${plan.planCode.toUpperCase()}_${plan.billingCycle.toUpperCase()}`;
    const envPlanId = env[envKey] || (typeof process !== "undefined" ? process.env?.[envKey] : null);
    return {
      ...plan,
      razorpayPlanId: envPlanId || plan.razorpayPlanId
    };
  });
}

export async function findBillingPlanVariant(
  planCode: string,
  billingCycle: string,
  env: any = {}
): Promise<BillingPlanRecord | null> {
  const plans = await loadActiveBillingPlans(env);
  return (
    plans.find(
      (p) => p.planCode === planCode.toLowerCase() && p.billingCycle === billingCycle.toLowerCase()
    ) || null
  );
}

/**
 * Fetches or initializes the user's subscription & monthly quota state.
 */
export async function getUserEntitlement(userId: string, env: any = {}): Promise<UserSubscriptionRecord> {
  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      await supabase.rpc("ensure_user_subscription_and_reset", { p_user_id: userId });
      const { data: subRow } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (subRow) {
        const plans = await loadActiveBillingPlans(env);
        const activeCode: SubscriptionTierId =
          subRow.status === "active" || subRow.lifetime_entitlement ? subRow.plan_code : "basic";
        const matchedPlan =
          plans.find((p) => p.id === subRow.plan_id) ||
          plans.find((p) => p.planCode === activeCode) ||
          AUTHORITATIVE_BILLING_PLANS[0];

        return {
          id: subRow.id,
          userId: subRow.user_id,
          planId: subRow.plan_id || matchedPlan.id,
          planCode: activeCode,
          planName: matchedPlan.planName,
          billingModel: subRow.billing_model || "free",
          status: subRow.status || "active",
          razorpaySubscriptionId: subRow.razorpay_subscription_id || null,
          currentPeriodStart: subRow.current_period_start,
          currentPeriodEnd: subRow.current_period_end,
          cancelAtPeriodEnd: Boolean(subRow.cancel_at_period_end),
          cancelledAt: subRow.cancelled_at || null,
          lifetimeEntitlement: Boolean(subRow.lifetime_entitlement),
          invoicesUsed: Number(subRow.invoices_used || 0),
          invoiceQuota: matchedPlan.invoiceQuota,
          aiGenerationsUsed: Number(subRow.ai_generations_used || 0),
          aiQuota: matchedPlan.aiQuota,
          customerQuota: matchedPlan.customerQuota,
          teamQuota: matchedPlan.teamQuota,
          usagePeriodStart: subRow.usage_period_start || subRow.current_period_start,
          usagePeriodEnd: subRow.usage_period_end || subRow.current_period_end
        };
      }
    } catch (err) {
      console.warn("Fallback to memory entitlement:", err);
    }
  }

  let mem = memorySubscriptions.get(userId);
  const now = new Date();
  if (!mem) {
    const nextMonth = new Date(now.getTime() + 30 * 86400000).toISOString();
    mem = {
      id: `sub-${userId}`,
      userId,
      planId: "plan-basic-monthly",
      planCode: "basic",
      planName: "Basic",
      billingModel: "free",
      status: "active",
      razorpaySubscriptionId: null,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: nextMonth,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      lifetimeEntitlement: false,
      invoicesUsed: 0,
      invoiceQuota: 10,
      aiGenerationsUsed: 0,
      aiQuota: 5,
      customerQuota: 25,
      teamQuota: 1,
      usagePeriodStart: now.toISOString(),
      usagePeriodEnd: nextMonth
    };
    memorySubscriptions.set(userId, mem);
  } else {
    // Check monthly usage reset
    if (new Date(mem.usagePeriodEnd).getTime() <= now.getTime()) {
      mem.invoicesUsed = 0;
      mem.aiGenerationsUsed = 0;
      mem.usagePeriodStart = now.toISOString();
      mem.usagePeriodEnd = new Date(now.getTime() + 30 * 86400000).toISOString();
    }
    // Check period expiry if cancelled at period end
    if (
      !mem.lifetimeEntitlement &&
      (mem.billingModel === "monthly" || mem.billingModel === "annual") &&
      new Date(mem.currentPeriodEnd).getTime() < now.getTime() &&
      (mem.cancelAtPeriodEnd || mem.status === "cancelled" || mem.status === "past_due")
    ) {
      mem.planId = "plan-basic-monthly";
      mem.planCode = "basic";
      mem.planName = "Basic";
      mem.billingModel = "free";
      mem.status = "expired";
      mem.invoiceQuota = 10;
      mem.aiQuota = 5;
      mem.customerQuota = 25;
      mem.teamQuota = 1;
      mem.cancelAtPeriodEnd = false;
    }
  }
  return mem;
}

/**
 * Records a pending payment in Supabase `billing_payments` (and memory fallback).
 */
export async function createPendingPaymentRecord(
  params: {
    userId: string;
    plan: BillingPlanRecord;
    razorpayOrderId?: string | null;
    razorpaySubscriptionId?: string | null;
    baseAmountPaise: number;
    taxAmountPaise: number;
    amountPaise: number;
    paymentType: "subscription_charge" | "one_time_lifetime";
  },
  env: any = {}
): Promise<BillingPaymentRecord> {
  const supabase = getServerSupabase(env);
  const nowIso = new Date().toISOString();
  const id = crypto.randomUUID();

  const record: BillingPaymentRecord = {
    id,
    userId: params.userId,
    planId: params.plan.id,
    planCode: params.plan.planCode,
    planName: params.plan.planName,
    billingCycle: params.plan.billingCycle,
    razorpayOrderId: params.razorpayOrderId || null,
    razorpayPaymentId: null,
    razorpaySubscriptionId: params.razorpaySubscriptionId || null,
    baseAmountPaise: params.baseAmountPaise,
    taxAmountPaise: params.taxAmountPaise,
    amountPaise: params.amountPaise,
    currency: params.plan.currency,
    status: "pending",
    paymentType: params.paymentType,
    createdAt: nowIso
  };

  memoryPayments.set(id, record);

  if (supabase && params.userId !== "local-dev-user") {
    try {
      const { data } = await supabase
        .from("billing_payments")
        .insert({
          user_id: params.userId,
          plan_id: params.plan.id.startsWith("plan-") ? null : params.plan.id,
          plan_code: params.plan.planCode,
          billing_cycle: params.plan.billingCycle,
          razorpay_order_id: params.razorpayOrderId || null,
          razorpay_subscription_id: params.razorpaySubscriptionId || null,
          base_amount_paise: params.baseAmountPaise,
          tax_amount_paise: params.taxAmountPaise,
          amount_paise: params.amountPaise,
          currency: params.plan.currency,
          status: "pending",
          payment_type: params.paymentType
        })
        .select("id")
        .single();
      if (data?.id) {
        record.id = data.id;
        memoryPayments.set(data.id, record);
      }
    } catch (err) {
      console.warn("Could not insert pending billing_payment row:", err);
    }
  }

  return record;
}

export async function findPendingPaymentByIdOrUser(
  userId: string,
  paymentRecordId?: string,
  razorpaySubscriptionId?: string,
  env: any = {}
): Promise<BillingPaymentRecord | null> {
  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      let query = supabase.from("billing_payments").select("*").eq("user_id", userId);
      if (paymentRecordId) {
        query = query.eq("id", paymentRecordId);
      } else if (razorpaySubscriptionId) {
        query = query.eq("razorpay_subscription_id", razorpaySubscriptionId);
      }
      const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        return {
          id: data.id,
          userId: data.user_id,
          planId: data.plan_id || `plan-${data.plan_code}-${data.billing_cycle}`,
          planCode: data.plan_code,
          planName: data.plan_code.charAt(0).toUpperCase() + data.plan_code.slice(1),
          billingCycle: data.billing_cycle,
          razorpayOrderId: data.razorpay_order_id,
          razorpayPaymentId: data.razorpay_payment_id,
          razorpaySubscriptionId: data.razorpay_subscription_id,
          baseAmountPaise: Number(data.base_amount_paise || 0),
          taxAmountPaise: Number(data.tax_amount_paise || 0),
          amountPaise: Number(data.amount_paise || 0),
          currency: data.currency || "INR",
          status: data.status,
          paymentType: data.payment_type,
          createdAt: data.created_at,
          paidAt: data.paid_at
        };
      }
    } catch {
      // Fallback to memory
    }
  }

  if (paymentRecordId && memoryPayments.has(paymentRecordId)) {
    const rec = memoryPayments.get(paymentRecordId)!;
    if (rec.userId === userId) return rec;
  }
  for (const rec of Array.from(memoryPayments.values()).reverse()) {
    if (rec.userId === userId) {
      if (razorpaySubscriptionId && rec.razorpaySubscriptionId === razorpaySubscriptionId) return rec;
      if (!paymentRecordId && !razorpaySubscriptionId) return rec;
    }
  }
  return null;
}

/**
 * Activates a user's entitlement idempotently after verified payment capture.
 */
export async function activateVerifiedEntitlement(
  params: {
    userId: string;
    planCode: SubscriptionTierId;
    billingCycle: BillingCycleType;
    paymentRecordId?: string;
    razorpayOrderId?: string | null;
    razorpaySubscriptionId?: string | null;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  },
  env: any = {}
): Promise<{ alreadyActivated: boolean; subscription: UserSubscriptionRecord }> {
  const plan =
    (await findBillingPlanVariant(params.planCode, params.billingCycle, env)) ||
    AUTHORITATIVE_BILLING_PLANS.find(
      (p) => p.planCode === params.planCode && p.billingCycle === params.billingCycle
    )!;

  // Idempotency check by razorpayPaymentId
  for (const existing of memoryPayments.values()) {
    if (existing.razorpayPaymentId === params.razorpayPaymentId && existing.status === "captured") {
      const sub = await getUserEntitlement(params.userId, env);
      return { alreadyActivated: true, subscription: sub };
    }
  }

  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 86400000);
  const periodEnd =
    params.billingCycle === "lifetime"
      ? new Date(now.getTime() + 100 * 365 * 86400000) // 100-year perpetual horizon
      : params.billingCycle === "annual"
      ? new Date(now.getTime() + 365 * 86400000)
      : nextMonth;

  // Update memory payment record
  if (params.paymentRecordId && memoryPayments.has(params.paymentRecordId)) {
    const p = memoryPayments.get(params.paymentRecordId)!;
    p.status = "captured";
    p.razorpayPaymentId = params.razorpayPaymentId;
    p.razorpaySignature = params.razorpaySignature || null;
    p.paidAt = now.toISOString();
  } else {
    for (const p of memoryPayments.values()) {
      if (
        (params.razorpayOrderId && p.razorpayOrderId === params.razorpayOrderId) ||
        (params.razorpaySubscriptionId && p.razorpaySubscriptionId === params.razorpaySubscriptionId)
      ) {
        p.status = "captured";
        p.razorpayPaymentId = params.razorpayPaymentId;
        p.razorpaySignature = params.razorpaySignature || null;
        p.paidAt = now.toISOString();
      }
    }
  }

  // Update memory subscription
  const currentSub = await getUserEntitlement(params.userId, env);
  const updatedSub: UserSubscriptionRecord = {
    ...currentSub,
    planId: plan.id,
    planCode: plan.planCode,
    planName: plan.planName,
    billingModel: params.billingCycle,
    status: "active",
    razorpaySubscriptionId: params.razorpaySubscriptionId || currentSub.razorpaySubscriptionId,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    lifetimeEntitlement: params.billingCycle === "lifetime",
    invoiceQuota: plan.invoiceQuota,
    aiQuota: plan.aiQuota,
    customerQuota: plan.customerQuota,
    teamQuota: plan.teamQuota,
    usagePeriodStart: now.toISOString(),
    usagePeriodEnd: nextMonth.toISOString()
  };
  memorySubscriptions.set(params.userId, updatedSub);

  const supabase = getServerSupabase(env);
  if (supabase && params.userId !== "local-dev-user") {
    try {
      // Check idempotency in DB
      const { data: existingPay } = await supabase
        .from("billing_payments")
        .select("id, status")
        .eq("razorpay_payment_id", params.razorpayPaymentId)
        .maybeSingle();

      if (existingPay && existingPay.status === "captured") {
        return { alreadyActivated: true, subscription: updatedSub };
      }

      if (params.paymentRecordId) {
        await supabase
          .from("billing_payments")
          .update({
            status: "captured",
            razorpay_payment_id: params.razorpayPaymentId,
            razorpay_signature: params.razorpaySignature || null,
            paid_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq("id", params.paymentRecordId);
      } else if (params.razorpayOrderId) {
        await supabase
          .from("billing_payments")
          .update({
            status: "captured",
            razorpay_payment_id: params.razorpayPaymentId,
            razorpay_signature: params.razorpaySignature || null,
            paid_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq("razorpay_order_id", params.razorpayOrderId);
      }

      await supabase.from("user_subscriptions").upsert(
        {
          user_id: params.userId,
          plan_id: plan.id.startsWith("plan-") ? null : plan.id,
          plan_code: plan.planCode,
          billing_model: params.billingCycle,
          status: "active",
          razorpay_subscription_id: params.razorpaySubscriptionId || null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          cancelled_at: null,
          lifetime_entitlement: params.billingCycle === "lifetime",
          usage_period_start: now.toISOString(),
          usage_period_end: nextMonth.toISOString(),
          updated_at: now.toISOString()
        },
        { onConflict: "user_id" }
      );

      // Sync legacy `subscriptions` table for backward compatibility
      await supabase.from("subscriptions").upsert(
        {
          user_id: params.userId,
          plan_id: plan.planCode,
          status: "active",
          billing_cycle: params.billingCycle === "annual" ? "annual" : "monthly",
          payment_reference: params.razorpayPaymentId,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          expires_at: periodEnd.toISOString(),
          updated_at: now.toISOString()
        },
        { onConflict: "user_id" }
      );
    } catch (err) {
      console.warn("Supabase entitlement sync warning:", err);
    }
  }

  return { alreadyActivated: false, subscription: updatedSub };
}

/**
 * Lists user's payment records from `billing_payments`.
 */
export async function getUserBillingPayments(userId: string, env: any = {}): Promise<BillingPaymentRecord[]> {
  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      const { data, error } = await supabase
        .from("billing_payments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        return data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          planId: row.plan_id || `plan-${row.plan_code}-${row.billing_cycle}`,
          planCode: row.plan_code as SubscriptionTierId,
          planName: row.plan_code.charAt(0).toUpperCase() + row.plan_code.slice(1),
          billingCycle: row.billing_cycle as BillingCycleType,
          subscriptionId: row.subscription_id,
          razorpayOrderId: row.razorpay_order_id,
          razorpayPaymentId: row.razorpay_payment_id,
          razorpaySubscriptionId: row.razorpay_subscription_id,
          baseAmountPaise: Number(row.base_amount_paise || 0),
          taxAmountPaise: Number(row.tax_amount_paise || 0),
          amountPaise: Number(row.amount_paise || 0),
          currency: row.currency || "INR",
          status: row.status,
          paymentType: row.payment_type,
          failureReason: row.failure_reason,
          createdAt: row.created_at,
          paidAt: row.paid_at
        }));
      }
    } catch {
      // Fallback to memory
    }
  }

  return Array.from(memoryPayments.values())
    .filter((p) => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Creates a Razorpay Order for one-time Lifetime purchases.
 * Amounts are strict integer paise.
 */
export async function createGatewayOrderForLifetime(
  params: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  },
  env: any = {}
): Promise<{ id: string; amount: number; currency: string }> {
  if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
    throw new Error("Order amount must be a positive integer in paise.");
  }

  const creds = getRazorpayGatewayConfig(env);
  if (!creds.isConfigured || !creds.keyId || !creds.keySecret) {
    throw new Error("RAZORPAY_CREDENTIALS_MISSING");
  }

  const authHeader = "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency || "INR",
      receipt: params.receipt,
      notes: params.notes
    })
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || "Failed to create Razorpay order.");
  }

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency
  };
}

/**
 * Creates a Razorpay Subscription for Monthly or Annual recurring plans.
 */
export async function createGatewaySubscription(
  params: {
    razorpayPlanId: string;
    totalCount: number;
    notes: Record<string, string>;
  },
  env: any = {}
): Promise<{ id: string; status: string; shortUrl?: string }> {
  const creds = getRazorpayGatewayConfig(env);
  if (!creds.isConfigured || !creds.keyId || !creds.keySecret) {
    throw new Error("RAZORPAY_CREDENTIALS_MISSING");
  }

  const authHeader = "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan_id: params.razorpayPlanId,
      total_count: params.totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: params.notes
    })
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || "Failed to create Razorpay subscription.");
  }

  return {
    id: data.id,
    status: data.status,
    shortUrl: data.short_url
  };
}

/**
 * Cryptographically verifies a Razorpay Order or Subscription checkout signature.
 * Uses constant-time HMAC SHA-256 comparison.
 */
export function verifyGatewayPaymentSignature(
  params: {
    orderId?: string | null;
    subscriptionId?: string | null;
    paymentId: string;
    signature: string;
  },
  env: any = {}
): boolean {
  const creds = getRazorpayGatewayConfig(env);
  if (!creds.keySecret || !params.paymentId || !params.signature) return false;

  let payload = "";
  if (params.subscriptionId) {
    // Razorpay subscription verification format: payment_id + "|" + subscription_id
    payload = `${params.paymentId}|${params.subscriptionId}`;
  } else if (params.orderId) {
    // Razorpay order verification format: order_id + "|" + payment_id
    payload = `${params.orderId}|${params.paymentId}`;
  } else {
    return false;
  }

  const expected = crypto.createHmac("sha256", creds.keySecret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(params.signature, "utf-8");

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies Razorpay Webhook signature against the exact raw request body.
 */
export function verifyWebhookRawSignature(rawBody: string, signatureHeader: string, env: any = {}): boolean {
  const creds = getRazorpayGatewayConfig(env);
  if (!creds.webhookSecret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", creds.webhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(signatureHeader, "utf-8");

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Records a unique gateway webhook event ID for idempotency.
 * Returns `true` if this is a duplicate event that was already processed.
 */
export async function checkAndRecordWebhookEvent(
  eventId: string,
  eventType: string,
  payload: any,
  env: any = {}
): Promise<{ duplicate: boolean }> {
  if (memoryWebhookEvents.has(eventId)) {
    return { duplicate: true };
  }

  const supabase = getServerSupabase(env);
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("billing_webhook_events")
        .select("id, processing_status")
        .eq("gateway_event_id", eventId)
        .maybeSingle();

      if (existing) {
        memoryWebhookEvents.add(eventId);
        return { duplicate: true };
      }

      const { error: insertError } = await supabase.from("billing_webhook_events").insert({
        gateway_event_id: eventId,
        event_type: eventType,
        processing_status: "processed",
        payload,
        processed_at: new Date().toISOString()
      });

      if (insertError && insertError.code === "23505") {
        // Unique constraint violation -> concurrent duplicate delivery
        memoryWebhookEvents.add(eventId);
        return { duplicate: true };
      }
    } catch {
      // Fallback to memory idempotency
    }
  }

  memoryWebhookEvents.add(eventId);
  return { duplicate: false };
}

/**
 * Cancels a user's recurring subscription either immediately or at the end of the current paid period.
 */
export async function cancelUserSubscription(
  userId: string,
  cancelAtCycleEnd: boolean,
  env: any = {}
): Promise<UserSubscriptionRecord> {
  const current = await getUserEntitlement(userId, env);
  if (current.lifetimeEntitlement || current.billingModel === "lifetime") {
    throw new Error("Lifetime purchases do not have recurring charges to cancel.");
  }
  if (current.billingModel === "free" || current.planCode === "basic") {
    throw new Error("You are currently on the free Basic tier.");
  }

  const creds = getRazorpayGatewayConfig(env);
  if (creds.isConfigured && current.razorpaySubscriptionId && creds.keyId && creds.keySecret) {
    try {
      const authHeader = "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
      await fetch(`https://api.razorpay.com/v1/subscriptions/${current.razorpaySubscriptionId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0
        })
      });
    } catch (err) {
      console.warn("Razorpay subscription cancel API warning:", err);
    }
  }

  const nowIso = new Date().toISOString();
  const updated: UserSubscriptionRecord = cancelAtCycleEnd
    ? {
        ...current,
        cancelAtPeriodEnd: true,
        cancelledAt: nowIso
      }
    : {
        ...current,
        planId: "plan-basic-monthly",
        planCode: "basic",
        planName: "Basic",
        billingModel: "free",
        status: "cancelled",
        cancelAtPeriodEnd: false,
        cancelledAt: nowIso,
        invoiceQuota: 10,
        aiQuota: 5,
        customerQuota: 25,
        teamQuota: 1
      };

  memorySubscriptions.set(userId, updated);

  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      await supabase
        .from("user_subscriptions")
        .update(
          cancelAtCycleEnd
            ? {
                cancel_at_period_end: true,
                cancelled_at: nowIso,
                updated_at: nowIso
              }
            : {
                plan_code: "basic",
                billing_model: "free",
                status: "cancelled",
                cancel_at_period_end: false,
                cancelled_at: nowIso,
                updated_at: nowIso
              }
        )
        .eq("user_id", userId);
    } catch (err) {
      console.warn("Supabase cancel subscription update warning:", err);
    }
  }

  return updated;
}

/**
 * Concurrency-safe batch invoice quota reservation across Supabase RPC or in-memory mutex.
 */
export async function checkAndReserveBatchInvoiceQuota(
  userId: string,
  batchCount: number,
  idempotencyKey?: string,
  env: any = {}
): Promise<{
  allowed: boolean;
  code: string;
  message?: string;
  planId: string;
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
}> {
  if (batchCount <= 0) {
    const ent = await getUserEntitlement(userId, env);
    return {
      allowed: true,
      code: "OK",
      planId: ent.planCode,
      used: ent.invoicesUsed,
      limit: ent.invoiceQuota,
      remaining: ent.invoiceQuota === -1 ? -1 : Math.max(0, ent.invoiceQuota - ent.invoicesUsed),
      resetDate: ent.usagePeriodEnd
    };
  }

  if (idempotencyKey && memoryUsageEvents.has(idempotencyKey)) {
    const ent = await getUserEntitlement(userId, env);
    return {
      allowed: true,
      code: "ALREADY_RECORDED",
      planId: ent.planCode,
      used: ent.invoicesUsed,
      limit: ent.invoiceQuota,
      remaining: ent.invoiceQuota === -1 ? -1 : Math.max(0, ent.invoiceQuota - ent.invoicesUsed),
      resetDate: ent.usagePeriodEnd
    };
  }

  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      const { data, error } = await supabase.rpc("check_and_reserve_invoice_quota", {
        p_user_id: userId,
        p_batch_count: batchCount,
        p_idempotency_key: idempotencyKey || null
      });
      if (!error && data) {
        if (idempotencyKey && data.allowed) memoryUsageEvents.add(idempotencyKey);
        return {
          allowed: Boolean(data.allowed),
          code: data.code || (data.allowed ? "OK" : "INVOICE_QUOTA_EXCEEDED"),
          message: data.message,
          planId: data.plan_id || "basic",
          used: Number(data.used ?? 0),
          limit: Number(data.limit ?? 10),
          remaining: Number(data.remaining ?? 0),
          resetDate: data.reset_date || new Date(Date.now() + 30 * 86400000).toISOString()
        };
      }
    } catch {
      // Fallback to in-memory atomic reservation
    }
  }

  const ent = await getUserEntitlement(userId, env);
  const limit = ent.invoiceQuota;

  if (limit !== -1 && ent.invoicesUsed + batchCount > limit) {
    return {
      allowed: false,
      code: "INVOICE_QUOTA_EXCEEDED",
      message: `Batch of ${batchCount} invoice(s) exceeds your remaining monthly quota (${ent.invoicesUsed}/${limit} used on ${ent.planName} plan).`,
      planId: ent.planCode,
      used: ent.invoicesUsed,
      limit,
      remaining: Math.max(0, limit - ent.invoicesUsed),
      resetDate: ent.usagePeriodEnd
    };
  }

  ent.invoicesUsed += batchCount;
  memorySubscriptions.set(userId, ent);
  if (idempotencyKey) memoryUsageEvents.add(idempotencyKey);

  return {
    allowed: true,
    code: "OK",
    planId: ent.planCode,
    used: ent.invoicesUsed,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - ent.invoicesUsed),
    resetDate: ent.usagePeriodEnd
  };
}

export async function rollbackBatchInvoiceQuota(
  userId: string,
  batchCount: number,
  env: any = {}
): Promise<void> {
  const ent = await getUserEntitlement(userId, env);
  ent.invoicesUsed = Math.max(0, ent.invoicesUsed - batchCount);
  memorySubscriptions.set(userId, ent);

  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      await supabase
        .from("user_subscriptions")
        .update({ invoices_used: ent.invoicesUsed, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch {
      // ignore
    }
  }
}

export async function checkAndReserveAiQuota(
  userId: string,
  env: any = {}
): Promise<{
  allowed: boolean;
  code: string;
  message?: string;
  planId: string;
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
}> {
  const ent = await getUserEntitlement(userId, env);
  const limit = ent.aiQuota;

  if (limit !== -1 && ent.aiGenerationsUsed + 1 > limit) {
    return {
      allowed: false,
      code: "AI_QUOTA_EXCEEDED",
      message: `Monthly AI generation quota reached (${ent.aiGenerationsUsed}/${limit} used on ${ent.planName} plan).`,
      planId: ent.planCode,
      used: ent.aiGenerationsUsed,
      limit,
      remaining: 0,
      resetDate: ent.usagePeriodEnd
    };
  }

  ent.aiGenerationsUsed += 1;
  memorySubscriptions.set(userId, ent);

  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      await supabase
        .from("user_subscriptions")
        .update({ ai_generations_used: ent.aiGenerationsUsed, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch {
      // ignore
    }
  }

  return {
    allowed: true,
    code: "OK",
    planId: ent.planCode,
    used: ent.aiGenerationsUsed,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - ent.aiGenerationsUsed),
    resetDate: ent.usagePeriodEnd
  };
}

export async function rollbackAiQuota(userId: string, env: any = {}): Promise<void> {
  const ent = await getUserEntitlement(userId, env);
  ent.aiGenerationsUsed = Math.max(0, ent.aiGenerationsUsed - 1);
  memorySubscriptions.set(userId, ent);

  const supabase = getServerSupabase(env);
  if (supabase && userId !== "local-dev-user") {
    try {
      await supabase
        .from("user_subscriptions")
        .update({ ai_generations_used: ent.aiGenerationsUsed, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch {
      // ignore
    }
  }
}
