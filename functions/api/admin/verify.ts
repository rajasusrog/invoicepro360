import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateAdminRequest } from "../../_admin_auth";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const adminAuth = await authenticateAdminRequest(request.headers, env);
    if (!adminAuth.authorized) {
      return errorResponse(adminAuth.error || "Forbidden: Account is not an authorized administrator.", adminAuth.status, adminAuth.code);
    }

    return jsonResponse({
      isAdmin: true,
      email: adminAuth.adminUser?.email,
      role: adminAuth.adminUser?.role || "super_admin",
      verifiedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("Admin verify GET error:", err);
    return errorResponse(err.message || "Failed to verify admin status", 500, "SERVER_ERROR");
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
