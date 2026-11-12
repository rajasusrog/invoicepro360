import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateAdminRequest, appendAdminAuditLog } from "../../_admin_auth";
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

    const supabase = getServerSupabase(env);
    if (!supabase || adminAuth.adminUser?.id === "local-dev-user") {
      return jsonResponse({
        autoContainmentEnabled: true,
        highRiskThreshold: 80,
        mediumRiskThreshold: 50,
        rateLimitRequestsPerMinute: 30,
        aiAbuseDetectionEnabled: true,
        retentionDaysAuditLogs: 365,
        retentionDaysAiTelemetry: 90,
        updatedAt: new Date().toISOString()
      });
    }

    const { data: config } = await supabase
      .from("admin_security_config")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    return jsonResponse({
      autoContainmentEnabled: config?.auto_containment_enabled ?? true,
      highRiskThreshold: config?.high_risk_threshold ?? 80,
      mediumRiskThreshold: config?.medium_risk_threshold ?? 50,
      rateLimitRequestsPerMinute: config?.rate_limit_requests_per_minute ?? 30,
      aiAbuseDetectionEnabled: config?.ai_abuse_detection_enabled ?? true,
      retentionDaysAuditLogs: config?.retention_days_audit_logs ?? 365,
      retentionDaysAiTelemetry: config?.retention_days_ai_telemetry ?? 90,
      updatedAt: config?.updated_at || new Date().toISOString(),
      updatedBy: config?.updated_by || "system"
    });
  } catch (err: any) {
    console.error("Admin config GET error:", err);
    return errorResponse(err.message || "Failed to load security config", 500, "SERVER_ERROR");
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const adminAuth = await authenticateAdminRequest(request.headers, env);
    if (!adminAuth.authorized || !adminAuth.adminUser) {
      return errorResponse(adminAuth.error || "Access denied.", adminAuth.status, adminAuth.code);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, "BAD_REQUEST");
    }

    const adminEmail = adminAuth.adminUser.email;
    const adminUserId = adminAuth.adminUser.id;
    const supabase = getServerSupabase(env);

    const updatePayload = {
      auto_containment_enabled: Boolean(body.autoContainmentEnabled),
      high_risk_threshold: Math.max(1, Math.min(100, Number(body.highRiskThreshold) || 80)),
      medium_risk_threshold: Math.max(1, Math.min(100, Number(body.mediumRiskThreshold) || 50)),
      rate_limit_requests_per_minute: Math.max(5, Math.min(300, Number(body.rateLimitRequestsPerMinute) || 30)),
      ai_abuse_detection_enabled: Boolean(body.aiAbuseDetectionEnabled),
      retention_days_audit_logs: Math.max(30, Math.min(3650, Number(body.retentionDaysAuditLogs) || 365)),
      retention_days_ai_telemetry: Math.max(7, Math.min(365, Number(body.retentionDaysAiTelemetry) || 90)),
      updated_by: adminEmail,
      updated_at: new Date().toISOString()
    };

    if (supabase && adminUserId !== "local-dev-user") {
      const { error: upsertError } = await supabase
        .from("admin_security_config")
        .upsert({ id: "global", ...updatePayload });

      if (upsertError) {
        throw upsertError;
      }

      await appendAdminAuditLog({
        adminEmail,
        adminUserId,
        action: "security_config_updated",
        targetType: "system_config",
        targetId: "global",
        justification: body.justification || "Security thresholds and containment policies reconfigured",
        metadata: updatePayload
      }, env);
    }

    return jsonResponse({
      success: true,
      config: {
        autoContainmentEnabled: updatePayload.auto_containment_enabled,
        highRiskThreshold: updatePayload.high_risk_threshold,
        mediumRiskThreshold: updatePayload.medium_risk_threshold,
        rateLimitRequestsPerMinute: updatePayload.rate_limit_requests_per_minute,
        aiAbuseDetectionEnabled: updatePayload.ai_abuse_detection_enabled,
        retentionDaysAuditLogs: updatePayload.retention_days_audit_logs,
        retentionDaysAiTelemetry: updatePayload.retention_days_ai_telemetry,
        updatedAt: updatePayload.updated_at,
        updatedBy: adminEmail
      }
    });
  } catch (err: any) {
    console.error("Admin config POST error:", err);
    return errorResponse(err.message || "Failed to update security config", 500, "SERVER_ERROR");
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};
