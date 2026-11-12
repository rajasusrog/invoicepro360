import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateAdminRequest } from "../../_admin_auth";
import { getServerSupabase } from "../../_subscription";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const adminAuth = await authenticateAdminRequest(request.headers, env);
    if (!adminAuth.authorized) {
      return errorResponse(adminAuth.error || "Access denied: Super Admin privilege required.", adminAuth.status, adminAuth.code);
    }

    const supabase = getServerSupabase(env);
    if (!supabase || adminAuth.adminUser?.id === "local-dev-user") {
      // Local dev fallback metrics
      return jsonResponse({
        totalUsers: 14,
        activeUsers24h: 9,
        suspendedUsers: 1,
        totalInvoices: 182,
        totalAiRequests: 428,
        openSecurityAlerts: 2,
        highRiskAlerts: 1,
        estimatedAiCostUsd: 0.1245,
        planBreakdown: {
          basic: 6,
          standard: 4,
          professional: 3,
          elite: 1,
          ultra: 0
        },
        providerBreakdown: {
          gemini: 395,
          openai: 33
        }
      });
    }

    // 1. User metrics
    const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    
    // Active users in past 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeUsers24h } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", yesterday);

    const { count: suspendedUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_suspended", true);

    // 2. Total Invoices
    const { count: totalInvoices } = await supabase.from("invoices").select("*", { count: "exact", head: true });

    // 3. Security Alerts
    const { count: openSecurityAlerts } = await supabase
      .from("security_alerts")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "contained"]);

    const { count: highRiskAlerts } = await supabase
      .from("security_alerts")
      .select("*", { count: "exact", head: true })
      .in("severity", ["high", "critical"])
      .in("status", ["new", "contained"]);

    // 4. AI Request Telemetry Aggregate
    const { data: aiLogs } = await supabase
      .from("ai_request_logs")
      .select("provider, cost_estimated_usd, status_code")
      .limit(1000);

    const totalAiRequests = aiLogs?.length || 0;
    const estimatedAiCostUsd = (aiLogs || []).reduce((sum: number, log: any) => sum + (Number(log.cost_estimated_usd) || 0), 0);
    
    const providerBreakdown: Record<string, number> = { gemini: 0, openai: 0 };
    (aiLogs || []).forEach((log: any) => {
      const p = log.provider || "gemini";
      providerBreakdown[p] = (providerBreakdown[p] || 0) + 1;
    });

    // 5. Subscription breakdown
    const { data: subs } = await supabase.from("subscriptions").select("plan_id");
    const planBreakdown: Record<string, number> = {
      basic: 0,
      standard: 0,
      professional: 0,
      elite: 0,
      ultra: 0
    };
    (subs || []).forEach((s: any) => {
      const p = s.plan_id || "basic";
      planBreakdown[p] = (planBreakdown[p] || 0) + 1;
    });

    return jsonResponse({
      totalUsers: totalUsers || 0,
      activeUsers24h: activeUsers24h || 0,
      suspendedUsers: suspendedUsers || 0,
      totalInvoices: totalInvoices || 0,
      totalAiRequests,
      openSecurityAlerts: openSecurityAlerts || 0,
      highRiskAlerts: highRiskAlerts || 0,
      estimatedAiCostUsd: Number(estimatedAiCostUsd.toFixed(4)),
      planBreakdown,
      providerBreakdown
    });
  } catch (err: any) {
    console.error("Admin overview error:", err);
    return errorResponse(err.message || "Failed to load admin overview", 500, "SERVER_ERROR");
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
