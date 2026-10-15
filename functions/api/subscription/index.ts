import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateRequest, getUserSubscription } from "../../_subscription";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const authResult = await authenticateRequest(request.headers, env);
    if (!authResult.user) {
      return errorResponse(authResult.error || "Authentication required", 401, "AUTH_REQUIRED");
    }

    const subInfo = await getUserSubscription(authResult.user.id, env);
    return jsonResponse(subInfo);
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in subscription/index:", err);
    return errorResponse(err.message || "Failed to fetch subscription information", 500, "SERVER_ERROR");
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
