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

    const url = new URL(request.url);
    const search = url.searchParams.get("q")?.toLowerCase().trim() || "";
    const filterStatus = url.searchParams.get("status") || "all";
    const filterPlan = url.searchParams.get("plan") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "15", 10)));
    const offset = (page - 1) * limit;

    const supabase = getServerSupabase(env);
    if (!supabase || adminAuth.adminUser?.id === "local-dev-user") {
      // Mock user directory for local dev without active remote DB
      const mockUsers = [
        {
          id: "usr-demo-1",
          email: "raj.asusrog@gmail.com",
          fullName: "Raj Super Admin",
          avatarUrl: "",
          isSuspended: false,
          lastSeenAt: new Date().toISOString(),
          createdAt: "2026-09-01T10:00:00Z",
          authProvider: "google",
          planId: "elite",
          planName: "Elite",
          invoicesUsed: 142,
          invoiceQuota: 1000,
          aiGenerationsUsed: 88,
          aiGenerationQuota: 500,
          role: "super_admin"
        },
        {
          id: "usr-demo-2",
          email: "priya.mehta@techcorp.in",
          fullName: "Priya Mehta",
          avatarUrl: "",
          isSuspended: false,
          lastSeenAt: new Date(Date.now() - 3 * 3600000).toISOString(),
          createdAt: "2026-09-12T14:30:00Z",
          authProvider: "google",
          planId: "professional",
          planName: "Professional",
          invoicesUsed: 74,
          invoiceQuota: 300,
          aiGenerationsUsed: 31,
          aiGenerationQuota: 150,
          role: "user"
        },
        {
          id: "usr-demo-3",
          email: "aravind.k@logisticsdelhi.com",
          fullName: "Aravind Kumar",
          avatarUrl: "",
          isSuspended: true,
          suspendedReason: "Repeated API flood violation from unknown proxy subnet",
          suspendedAt: "2026-10-12T08:15:00Z",
          lastSeenAt: "2026-10-12T08:14:00Z",
          createdAt: "2026-09-20T11:00:00Z",
          authProvider: "google",
          planId: "basic",
          planName: "Basic",
          invoicesUsed: 10,
          invoiceQuota: 10,
          aiGenerationsUsed: 5,
          aiGenerationQuota: 5,
          role: "user"
        },
        {
          id: "usr-demo-4",
          email: "sunita.sharma@consulting.co",
          fullName: "Sunita Sharma",
          avatarUrl: "",
          isSuspended: false,
          lastSeenAt: new Date(Date.now() - 48 * 3600000).toISOString(),
          createdAt: "2026-10-01T09:20:00Z",
          authProvider: "google",
          planId: "standard",
          planName: "Standard",
          invoicesUsed: 18,
          invoiceQuota: 50,
          aiGenerationsUsed: 9,
          aiGenerationQuota: 25,
          role: "user"
        }
      ];

      return jsonResponse({
        users: mockUsers,
        total: mockUsers.length,
        page,
        limit
      });
    }

    // Query real Supabase profiles joined with subscriptions
    let query = supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        avatar_url,
        is_suspended,
        suspended_at,
        suspended_reason,
        last_seen_at,
        created_at,
        subscriptions (
          plan_id,
          status,
          invoices_used,
          ai_generations_used,
          current_period_end
        )
      `, { count: "exact" });

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    if (filterStatus === "suspended") {
      query = query.eq("is_suspended", true);
    } else if (filterStatus === "active") {
      query = query.eq("is_suspended", false);
    }

    const { data: profiles, count, error: queryError } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      throw queryError;
    }

    const formattedUsers = (profiles || []).map((p: any) => {
      const sub = Array.isArray(p.subscriptions) ? p.subscriptions[0] : p.subscriptions;
      const planId = sub?.plan_id || "basic";
      return {
        id: p.id,
        email: p.email || "No email",
        fullName: p.full_name || p.email?.split("@")[0] || "User",
        avatarUrl: p.avatar_url || "",
        isSuspended: Boolean(p.is_suspended),
        suspendedReason: p.suspended_reason || null,
        suspendedAt: p.suspended_at || null,
        lastSeenAt: p.last_seen_at || p.created_at,
        createdAt: p.created_at,
        authProvider: "google",
        planId,
        planName: planId.charAt(0).toUpperCase() + planId.slice(1),
        invoicesUsed: sub?.invoices_used || 0,
        aiGenerationsUsed: sub?.ai_generations_used || 0
      };
    });

    return jsonResponse({
      users: formattedUsers,
      total: count || formattedUsers.length,
      page,
      limit
    });
  } catch (err: any) {
    console.error("Admin users GET error:", err);
    return errorResponse(err.message || "Failed to list users", 500, "SERVER_ERROR");
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
      return errorResponse("Invalid JSON payload", 400, "BAD_REQUEST");
    }

    const { action, targetUserId, reason, newPlanId } = body || {};
    if (!action || !targetUserId) {
      return errorResponse("action and targetUserId are required", 400, "BAD_REQUEST");
    }

    const adminEmail = adminAuth.adminUser.email;
    const adminUserId = adminAuth.adminUser.id;
    const supabase = getServerSupabase(env);

    if (!supabase || adminUserId === "local-dev-user") {
      // Local dev mock response
      return jsonResponse({
        success: true,
        action,
        targetUserId,
        executedBy: adminEmail,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "suspend_user") {
      if (!reason || !reason.trim()) {
        return errorResponse("Mandatory suspension reason is required for security auditing", 400, "JUSTIFICATION_REQUIRED");
      }

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_reason: reason.trim()
        })
        .eq("id", targetUserId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      await appendAdminAuditLog({
        adminEmail,
        adminUserId,
        action: "user_suspended",
        targetType: "user",
        targetId: targetUserId,
        justification: reason.trim(),
        metadata: { target_email: updated?.email }
      }, env);

      return jsonResponse({
        success: true,
        message: `User account suspended: ${reason}`,
        isSuspended: true
      });
    } else if (action === "restore_user") {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          is_suspended: false,
          suspended_at: null,
          suspended_reason: null
        })
        .eq("id", targetUserId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      await appendAdminAuditLog({
        adminEmail,
        adminUserId,
        action: "user_restored",
        targetType: "user",
        targetId: targetUserId,
        justification: reason?.trim() || "Administrative account restoration",
        metadata: { target_email: updated?.email }
      }, env);

      return jsonResponse({
        success: true,
        message: "User account restored successfully",
        isSuspended: false
      });
    } else if (action === "override_plan") {
      if (!newPlanId) {
        return errorResponse("newPlanId is required for subscription override", 400, "BAD_REQUEST");
      }
      if (!reason || !reason.trim()) {
        return errorResponse("Mandatory justification is required to modify subscription tiers", 400, "JUSTIFICATION_REQUIRED");
      }

      // Privileged update
      const { data: oldSub } = await supabase
        .from("subscriptions")
        .select("plan_id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const { error: subError } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: targetUserId,
          plan_id: newPlanId,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (subError) {
        throw subError;
      }

      await appendAdminAuditLog({
        adminEmail,
        adminUserId,
        action: "plan_override",
        targetType: "subscription",
        targetId: targetUserId,
        justification: reason.trim(),
        metadata: {
          old_plan: oldSub?.plan_id || "basic",
          new_plan: newPlanId
        }
      }, env);

      return jsonResponse({
        success: true,
        message: `Plan overridden to ${newPlanId}`,
        newPlanId
      });
    }

    return errorResponse(`Unsupported administrative action: ${action}`, 400, "BAD_ACTION");
  } catch (err: any) {
    console.error("Admin users POST error:", err);
    return errorResponse(err.message || "Failed to execute administrative action", 500, "SERVER_ERROR");
  }
};

export const onRequestPatch = onRequestPost;

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};
