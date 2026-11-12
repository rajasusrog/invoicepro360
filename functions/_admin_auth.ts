import { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, authenticateRequest } from "./_subscription";

export interface AdminAuthResult {
  authorized: boolean;
  adminUser: {
    id: string;
    email: string;
    role: string;
  } | null;
  error?: string;
  status: number;
  code: string;
}

/**
 * Resolves the configured Super Admin email allowlist from server environment bindings.
 * Defaults to the verified project owner email.
 */
export function getSuperAdminAllowlist(env: any = {}): string[] {
  const envAllowlist = 
    env.SUPER_ADMIN_EMAIL_ALLOWLIST || 
    (typeof process !== "undefined" ? process.env?.SUPER_ADMIN_EMAIL_ALLOWLIST : undefined) ||
    "raj.asusrog@gmail.com,admin@invoicepro360.com";

  return envAllowlist
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Strictly verifies the authenticated identity and administrator role on every privileged backend request.
 * NEVER trusts query parameters, localStorage values, request body fields, or client headers.
 */
export async function authenticateAdminRequest(
  requestHeaders: Headers | Record<string, string | string[] | undefined>,
  env: any = {}
): Promise<AdminAuthResult> {
  // 1. Authenticate user via Supabase JWT
  const auth = await authenticateRequest(requestHeaders, env);
  if (!auth.user) {
    return {
      authorized: false,
      adminUser: null,
      error: auth.error || "Authentication required.",
      status: 401,
      code: "AUTH_REQUIRED"
    };
  }

  const userEmail = (auth.user.email || "").toLowerCase().trim();
  const allowlist = getSuperAdminAllowlist(env);

  // Check server-side allowlist
  const isAllowlisted = allowlist.includes(userEmail);

  // In local dev without Supabase configured, allow dev admin
  if (auth.user.id === "local-dev-user") {
    return {
      authorized: true,
      adminUser: {
        id: "local-dev-user",
        email: "admin@invoicepro360.local",
        role: "super_admin"
      },
      status: 200,
      code: "OK"
    };
  }

  // Check database admin_roles table if present
  let hasDbRole = false;
  let dbRoleName = "super_admin";
  const supabase = getServerSupabase(env);
  if (supabase) {
    try {
      const { data: roleData } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("email", userEmail)
        .maybeSingle();

      if (roleData) {
        hasDbRole = true;
        dbRoleName = roleData.role;
      }
    } catch (e) {
      // Table query error, rely on allowlist
    }
  }

  if (!isAllowlisted && !hasDbRole) {
    // Record unauthorized admin attempt in audit trail
    if (supabase) {
      try {
        await supabase.from("admin_audit_logs").insert({
          admin_user_id: auth.user.id,
          admin_email: userEmail || "unknown",
          action: "unauthorized_admin_access_denied",
          target_type: "system",
          target_id: "super_admin_portal",
          justification: "Rejected unauthorized route access attempt",
          metadata: { attempted_at: new Date().toISOString() }
        });
      } catch (logErr) {
        // Silent fail audit
      }
    }

    return {
      authorized: false,
      adminUser: null,
      error: "Access denied: Account is not authorized for Super Admin privileges.",
      status: 403,
      code: "FORBIDDEN"
    };
  }

  return {
    authorized: true,
    adminUser: {
      id: auth.user.id,
      email: userEmail,
      role: dbRoleName
    },
    status: 200,
    code: "OK"
  };
}

export interface AppendAuditLogParams {
  adminEmail: string;
  adminUserId?: string;
  action: string;
  targetType: "user" | "subscription" | "security_alert" | "system_config" | "system";
  targetId: string;
  justification?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Appends a tamper-resistant entry to the server audit log.
 */
export async function appendAdminAuditLog(
  params: AppendAuditLogParams,
  env: any = {}
): Promise<void> {
  const supabase = getServerSupabase(env);
  if (!supabase) return;

  try {
    await supabase.from("admin_audit_logs").insert({
      admin_user_id: params.adminUserId || null,
      admin_email: params.adminEmail,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      justification: params.justification || "Administrative action executed",
      metadata: params.metadata || {},
      ip_address: params.ipAddress || null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to append admin audit log:", err);
  }
}
