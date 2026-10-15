import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionTierId = "basic" | "standard" | "professional" | "elite" | "ultra";

export interface PlanConfig {
  id: SubscriptionTierId;
  name: string;
  priceInr: number;
  invoiceQuota: number;
  aiGenerationQuota: number;
  customerQuota: number;
  teamMemberQuota: number;
  isContactUs: boolean;
}

export const CENTRAL_PLANS: Record<SubscriptionTierId, PlanConfig> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceInr: 0,
    invoiceQuota: 10,
    aiGenerationQuota: 5,
    customerQuota: 25,
    teamMemberQuota: 1,
    isContactUs: false
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceInr: 499,
    invoiceQuota: 50,
    aiGenerationQuota: 25,
    customerQuota: 100,
    teamMemberQuota: 1,
    isContactUs: false
  },
  professional: {
    id: "professional",
    name: "Professional",
    priceInr: 1499,
    invoiceQuota: 300,
    aiGenerationQuota: 150,
    customerQuota: 500,
    teamMemberQuota: 3,
    isContactUs: false
  },
  elite: {
    id: "elite",
    name: "Elite",
    priceInr: 3999,
    invoiceQuota: 1000,
    aiGenerationQuota: 500,
    customerQuota: 2000,
    teamMemberQuota: 10,
    isContactUs: false
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    priceInr: 0,
    invoiceQuota: -1,
    aiGenerationQuota: 2500,
    customerQuota: -1,
    teamMemberQuota: 25,
    isContactUs: true
  }
};

export interface QuotaResult {
  allowed: boolean;
  code: "OK" | "AI_QUOTA_EXCEEDED" | "INVOICE_QUOTA_EXCEEDED" | "AUTH_REQUIRED" | "ERROR";
  message?: string;
  planId?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  resetDate?: string;
}

/**
 * Creates a server-side Supabase client for Cloudflare Pages Functions or Express
 */
export function getServerSupabase(env: any = {}): SupabaseClient | null {
  const url = 
    env.VITE_SUPABASE_URL || 
    env.SUPABASE_URL || 
    (typeof process !== "undefined" ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : undefined);
    
  const key = 
    env.SUPABASE_SERVICE_ROLE_KEY || 
    env.VITE_SUPABASE_ANON_KEY || 
    env.SUPABASE_ANON_KEY || 
    (typeof process !== "undefined" ? (process.env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : undefined);

  if (!url || !key || url.includes("your-supabase-project-url") || key.includes("your-supabase-publishable")) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Validates the authenticated Supabase user from the verified Authorization Bearer token.
 * Never trusts client-supplied user IDs or parameters.
 */
export async function authenticateRequest(
  requestHeaders: Headers | Record<string, string | string[] | undefined>,
  env: any = {}
): Promise<{ user: any | null; error: string | null; code: string }> {
  let authHeader: string | undefined;

  if (typeof (requestHeaders as Headers).get === "function") {
    authHeader = (requestHeaders as Headers).get("authorization") || (requestHeaders as Headers).get("Authorization") || undefined;
  } else {
    const raw = (requestHeaders as any)["authorization"] || (requestHeaders as any)["Authorization"];
    authHeader = Array.isArray(raw) ? raw[0] : raw;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Authorization header with Bearer token is required.",
      code: "AUTH_REQUIRED"
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      user: null,
      error: "Bearer token is empty.",
      code: "AUTH_REQUIRED"
    };
  }

  const supabase = getServerSupabase(env);
  if (!supabase) {
    // If Supabase is not configured yet in the environment, fallback gracefully for demo mode
    return {
      user: { id: "local-dev-user", email: "demo@invoicepro360.local" },
      error: null,
      code: "OK"
    };
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return {
        user: null,
        error: error?.message || "Invalid or expired session. Please sign in again.",
        code: "AUTH_REQUIRED"
      };
    }

    return { user, error: null, code: "OK" };
  } catch (err: any) {
    return {
      user: null,
      error: err.message || "Failed to verify user credentials.",
      code: "AUTH_REQUIRED"
    };
  }
}

/**
 * Concurrency-safe atomic check and increment of AI generation quota.
 */
export async function checkAndIncrementAiQuota(
  userId: string,
  env: any = {}
): Promise<QuotaResult> {
  const supabase = getServerSupabase(env);
  if (!supabase || userId === "local-dev-user") {
    return {
      allowed: true,
      code: "OK",
      planId: "basic",
      used: 1,
      limit: 5,
      remaining: 4,
      resetDate: new Date(Date.now() + 30 * 86400000).toISOString()
    };
  }

  try {
    const { data, error } = await supabase.rpc("check_and_increment_ai_quota", {
      p_user_id: userId
    });

    if (error) {
      console.warn("RPC check_and_increment_ai_quota failed or missing, falling back to table query:", error.message);
      return fallbackCheckAndIncrement(supabase, userId, "ai_generation");
    }

    return {
      allowed: Boolean(data?.allowed),
      code: data?.code || (data?.allowed ? "OK" : "AI_QUOTA_EXCEEDED"),
      message: data?.message,
      planId: data?.plan_id,
      used: data?.used,
      limit: data?.limit,
      remaining: data?.remaining,
      resetDate: data?.reset_date
    };
  } catch (err: any) {
    console.error("Exception in checkAndIncrementAiQuota:", err);
    return fallbackCheckAndIncrement(supabase, userId, "ai_generation");
  }
}

/**
 * Decrements AI generation counter if downstream model call failed after quota was charged.
 */
export async function refundAiQuota(userId: string, env: any = {}): Promise<void> {
  const supabase = getServerSupabase(env);
  if (!supabase || userId === "local-dev-user") return;

  try {
    await supabase.rpc("refund_ai_quota", { p_user_id: userId });
  } catch (err) {
    console.warn("Failed to refund AI quota:", err);
  }
}

/**
 * Concurrency-safe atomic check and increment of Invoice creation quota.
 */
export async function checkAndIncrementInvoiceQuota(
  userId: string,
  env: any = {}
): Promise<QuotaResult> {
  const supabase = getServerSupabase(env);
  if (!supabase || userId === "local-dev-user") {
    return {
      allowed: true,
      code: "OK",
      planId: "basic",
      used: 1,
      limit: 10,
      remaining: 9,
      resetDate: new Date(Date.now() + 30 * 86400000).toISOString()
    };
  }

  try {
    const { data, error } = await supabase.rpc("check_and_increment_invoice_quota", {
      p_user_id: userId
    });

    if (error) {
      console.warn("RPC check_and_increment_invoice_quota failed or missing, falling back to table query:", error.message);
      return fallbackCheckAndIncrement(supabase, userId, "invoice_created");
    }

    return {
      allowed: Boolean(data?.allowed),
      code: data?.code || (data?.allowed ? "OK" : "INVOICE_QUOTA_EXCEEDED"),
      message: data?.message,
      planId: data?.plan_id,
      used: data?.used,
      limit: data?.limit,
      remaining: data?.remaining,
      resetDate: data?.reset_date
    };
  } catch (err: any) {
    console.error("Exception in checkAndIncrementInvoiceQuota:", err);
    return fallbackCheckAndIncrement(supabase, userId, "invoice_created");
  }
}

/**
 * Retrieves the user's subscription and current monthly usage stats.
 */
export async function getUserSubscription(
  userId: string,
  env: any = {}
): Promise<any> {
  const supabase = getServerSupabase(env);
  if (!supabase || userId === "local-dev-user") {
    const p = CENTRAL_PLANS.basic;
    return {
      plan_id: p.id,
      plan_name: p.name,
      status: "active",
      price_inr: p.priceInr,
      is_contact_us: p.isContactUs,
      invoices_used: 0,
      invoice_quota: p.invoiceQuota,
      invoices_remaining: p.invoiceQuota,
      ai_generations_used: 0,
      ai_generation_quota: p.aiGenerationQuota,
      ai_generations_remaining: p.aiGenerationQuota,
      customer_quota: p.customerQuota,
      team_member_quota: p.teamMemberQuota,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString()
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_user_subscription_info", {
      p_user_id: userId
    });

    if (!error && data) {
      return data;
    }
  } catch (e) {
    console.warn("RPC get_user_subscription_info failed, falling back to direct query:", e);
  }

  // Fallback direct query
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const planId: SubscriptionTierId = (sub?.plan_id as SubscriptionTierId) || "basic";
  const plan = CENTRAL_PLANS[planId] || CENTRAL_PLANS.basic;

  const invUsed = sub?.invoices_used || 0;
  const aiUsed = sub?.ai_generations_used || 0;

  return {
    plan_id: plan.id,
    plan_name: plan.name,
    status: sub?.status || "active",
    price_inr: plan.priceInr,
    is_contact_us: plan.isContactUs,
    invoices_used: invUsed,
    invoice_quota: plan.invoiceQuota,
    invoices_remaining: plan.invoiceQuota >= 0 ? Math.max(0, plan.invoiceQuota - invUsed) : -1,
    ai_generations_used: aiUsed,
    ai_generation_quota: plan.aiGenerationQuota,
    ai_generations_remaining: plan.aiGenerationQuota >= 0 ? Math.max(0, plan.aiGenerationQuota - aiUsed) : -1,
    customer_quota: plan.customerQuota,
    team_member_quota: plan.teamMemberQuota,
    current_period_start: sub?.current_period_start || new Date().toISOString(),
    current_period_end: sub?.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString()
  };
}

/**
 * Fallback implementation if RPC has not been migrated into the Supabase database yet
 */
async function fallbackCheckAndIncrement(
  supabase: SupabaseClient,
  userId: string,
  type: "ai_generation" | "invoice_created"
): Promise<QuotaResult> {
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let sub = existingSub;
  const now = new Date();

  if (!sub) {
    const nextMonth = new Date(now.getTime() + 30 * 86400000);
    const { data: created } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: "basic",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
        invoices_used: 0,
        ai_generations_used: 0
      })
      .select()
      .single();
    sub = created;
  } else if (new Date(sub.current_period_end) <= now) {
    // Rollover period
    const nextMonth = new Date(now.getTime() + 30 * 86400000);
    const { data: rolled } = await supabase
      .from("subscriptions")
      .update({
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
        invoices_used: 0,
        ai_generations_used: 0,
        updated_at: now.toISOString()
      })
      .eq("user_id", userId)
      .select()
      .single();
    sub = rolled;
  }

  const planId: SubscriptionTierId = (sub?.plan_id as SubscriptionTierId) || "basic";
  const plan = CENTRAL_PLANS[planId] || CENTRAL_PLANS.basic;

  if (type === "ai_generation") {
    const used = sub?.ai_generations_used || 0;
    const limit = plan.aiGenerationQuota;

    if (limit >= 0 && used >= limit) {
      return {
        allowed: false,
        code: "AI_QUOTA_EXCEEDED",
        message: `Monthly AI generation quota reached (${limit}). Upgrade your plan to continue generating AI invoices.`,
        planId,
        used,
        limit,
        remaining: 0,
        resetDate: sub?.current_period_end
      };
    }

    await supabase
      .from("subscriptions")
      .update({
        ai_generations_used: used + 1,
        updated_at: now.toISOString()
      })
      .eq("user_id", userId);

    return {
      allowed: true,
      code: "OK",
      planId,
      used: used + 1,
      limit,
      remaining: limit >= 0 ? limit - (used + 1) : -1,
      resetDate: sub?.current_period_end
    };
  } else {
    const used = sub?.invoices_used || 0;
    const limit = plan.invoiceQuota;

    if (limit >= 0 && used >= limit) {
      return {
        allowed: false,
        code: "INVOICE_QUOTA_EXCEEDED",
        message: `Monthly invoice limit reached (${limit}). Upgrade your plan to create more invoices.`,
        planId,
        used,
        limit,
        remaining: 0,
        resetDate: sub?.current_period_end
      };
    }

    await supabase
      .from("subscriptions")
      .update({
        invoices_used: used + 1,
        updated_at: now.toISOString()
      })
      .eq("user_id", userId);

    return {
      allowed: true,
      code: "OK",
      planId,
      used: used + 1,
      limit,
      remaining: limit >= 0 ? limit - (used + 1) : -1,
      resetDate: sub?.current_period_end
    };
  }
}
