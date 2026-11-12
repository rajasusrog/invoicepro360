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

    const supabase = getServerSupabase(env);
    if (!supabase || adminAuth.adminUser?.id === "local-dev-user") {
      // Mock activity telemetry for local dev
      const mockLogs = [
        {
          id: "req-101",
          userEmail: "priya.mehta@techcorp.in",
          endpoint: "/api/invoice/create-from-text",
          operationType: "text_generation",
          provider: "gemini",
          model: "gemini-3.8-flash",
          statusCode: 200,
          latencyMs: 980,
          tokensEstimated: 340,
          costEstimatedUsd: 0.000051,
          riskScore: 5,
          abuseFlag: false,
          createdAt: new Date(Date.now() - 4 * 60000).toISOString()
        },
        {
          id: "req-102",
          userEmail: "sunita.sharma@consulting.co",
          endpoint: "/api/invoice/ocr",
          operationType: "ocr_extraction",
          provider: "gemini",
          model: "gemini-3.8-flash",
          statusCode: 200,
          latencyMs: 1450,
          tokensEstimated: 720,
          costEstimatedUsd: 0.000108,
          riskScore: 8,
          abuseFlag: false,
          createdAt: new Date(Date.now() - 15 * 60000).toISOString()
        },
        {
          id: "req-103",
          userEmail: "aravind.k@logisticsdelhi.com",
          endpoint: "/api/invoice/create-from-text",
          operationType: "text_generation",
          provider: "gemini",
          model: "gemini-3.8-flash",
          statusCode: 403,
          latencyMs: 15,
          tokensEstimated: 120,
          costEstimatedUsd: 0.0,
          riskScore: 92,
          detectionCategory: "prompt_injection",
          abuseFlag: true,
          createdAt: new Date(Date.now() - 45 * 60000).toISOString()
        }
      ];

      return jsonResponse({
        aggregate: {
          totalRequests: 428,
          successCount: 412,
          failedCount: 16,
          avgLatencyMs: 1120,
          totalTokensEst: 185400,
          totalCostUsd: 0.1245,
          providerStats: {
            gemini: { requests: 395, avgLatencyMs: 1080 },
            openai: { requests: 33, avgLatencyMs: 1620 }
          },
          endpointStats: {
            "/api/invoice/create-from-text": 260,
            "/api/invoice/ocr": 124,
            "/api/invoice/chat": 44
          }
        },
        recentLogs: mockLogs
      });
    }

    const { data: logs, error: queryError } = await supabase
      .from("ai_request_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      throw queryError;
    }

    const allLogs = logs || [];
    const totalRequests = allLogs.length;
    const successCount = allLogs.filter(l => l.status_code >= 200 && l.status_code < 300).length;
    const failedCount = totalRequests - successCount;
    const totalLatency = allLogs.reduce((sum, l) => sum + (l.latency_ms || 0), 0);
    const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
    const totalTokensEst = allLogs.reduce((sum, l) => sum + (l.tokens_estimated || 0), 0);
    const totalCostUsd = Number(allLogs.reduce((sum, l) => sum + (Number(l.cost_estimated_usd) || 0), 0).toFixed(4));

    const providerStats: Record<string, { requests: number; avgLatencyMs: number; totalLat: number }> = {};
    const endpointStats: Record<string, number> = {};

    allLogs.forEach(l => {
      const p = l.provider || "gemini";
      if (!providerStats[p]) {
        providerStats[p] = { requests: 0, avgLatencyMs: 0, totalLat: 0 };
      }
      providerStats[p].requests += 1;
      providerStats[p].totalLat += l.latency_ms || 0;

      const ep = l.endpoint || "other";
      endpointStats[ep] = (endpointStats[ep] || 0) + 1;
    });

    Object.keys(providerStats).forEach(p => {
      const item = providerStats[p];
      item.avgLatencyMs = item.requests > 0 ? Math.round(item.totalLat / item.requests) : 0;
    });

    return jsonResponse({
      aggregate: {
        totalRequests,
        successCount,
        failedCount,
        avgLatencyMs,
        totalTokensEst,
        totalCostUsd,
        providerStats,
        endpointStats
      },
      recentLogs: allLogs.slice(0, 50).map(l => ({
        id: l.id,
        userEmail: l.user_email || "Anonymous",
        endpoint: l.endpoint,
        operationType: l.operation_type,
        provider: l.provider,
        model: l.model,
        statusCode: l.status_code,
        latencyMs: l.latency_ms,
        tokensEstimated: l.tokens_estimated,
        costEstimatedUsd: l.cost_estimated_usd,
        riskScore: l.risk_score,
        detectionCategory: l.detection_category,
        abuseFlag: l.abuse_flag,
        createdAt: l.created_at
      }))
    });
  } catch (err: any) {
    console.error("Admin ai-activity GET error:", err);
    return errorResponse(err.message || "Failed to load AI activity monitoring", 500, "SERVER_ERROR");
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
