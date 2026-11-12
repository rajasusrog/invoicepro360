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
      return errorResponse(adminAuth.error || "Access denied.", adminAuth.status, adminAuth.code);
    }

    const url = new URL(request.url);
    const filterAction = url.searchParams.get("action") || "all";
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    const supabase = getServerSupabase(env);
    if (!supabase || adminAuth.adminUser?.id === "local-dev-user") {
      // Mock audit records for local dev
      const mockLogs = [
        {
          id: "aud-001",
          adminEmail: "raj.asusrog@gmail.com",
          action: "user_suspended",
          targetType: "user",
          targetId: "usr-demo-3",
          justification: "Repeated API flood violation from unknown proxy subnet",
          metadata: { target_email: "aravind.k@logisticsdelhi.com" },
          createdAt: "2026-10-14T20:20:00Z"
        },
        {
          id: "aud-002",
          adminEmail: "raj.asusrog@gmail.com",
          action: "plan_override",
          targetType: "subscription",
          targetId: "usr-demo-2",
          justification: "Enterprise evaluation request verified via sales ticket #4492",
          metadata: { old_plan: "standard", new_plan: "professional" },
          createdAt: "2026-10-14T18:45:00Z"
        },
        {
          id: "aud-003",
          adminEmail: "raj.asusrog@gmail.com",
          action: "security_config_updated",
          targetType: "system_config",
          targetId: "global",
          justification: "Enabled automated containment for prompt injection vectors",
          metadata: { high_risk_threshold: 80, auto_containment_enabled: true },
          createdAt: "2026-10-14T12:00:00Z"
        }
      ];

      return jsonResponse({ auditLogs: mockLogs });
    }

    let query = supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filterAction !== "all") {
      query = query.eq("action", filterAction);
    }

    const { data: logs, error: queryError } = await query;
    if (queryError) {
      throw queryError;
    }

    return jsonResponse({
      auditLogs: (logs || []).map((l: any) => ({
        id: l.id,
        adminEmail: l.admin_email,
        action: l.action,
        targetType: l.target_type,
        targetId: l.target_id,
        justification: l.justification,
        metadata: l.metadata,
        ipAddress: l.ip_address,
        createdAt: l.created_at
      }))
    });
  } catch (err: any) {
    console.error("Admin audit-logs GET error:", err);
    return errorResponse(err.message || "Failed to load audit logs", 500, "SERVER_ERROR");
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
