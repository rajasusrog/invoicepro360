import { jsonResponse, errorResponse } from "../../_gemini";
import { chatWithInvoices } from "../../_providers";
import { authenticateRequest, checkAndIncrementAiQuota, refundAiQuota } from "../../_subscription";

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  let authenticatedUserId: string | null = null;

  try {
    // 1. Authenticate user from Supabase session Bearer token
    const authResult = await authenticateRequest(request.headers, env);
    if (!authResult.user) {
      return errorResponse(authResult.error || "Authentication required", 401, "AUTH_REQUIRED");
    }
    authenticatedUserId = authResult.user.id;

    // 2. Validate inputs before checking quota
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400, "BAD_REQUEST");
    }

    const { messages, invoices, provider, model } = body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errorResponse("messages array is required and must not be empty", 400, "BAD_REQUEST");
    }

    // 3. Enforce AI generation quota
    const quotaResult = await checkAndIncrementAiQuota(authenticatedUserId, env);
    if (!quotaResult.allowed) {
      return errorResponse(
        quotaResult.message || "Monthly AI generation quota reached. Please upgrade your plan.",
        429,
        "AI_QUOTA_EXCEEDED",
        {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: 0,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      );
    }

    // 4. Multi-provider Chat processing
    const response = await chatWithInvoices({
      messages,
      invoices: Array.isArray(invoices) ? invoices : [],
      provider,
      model,
      env
    });

    return jsonResponse({
      ...response,
      _usage: {
        used: quotaResult.used,
        limit: quotaResult.limit,
        remaining: quotaResult.remaining,
        resetDate: quotaResult.resetDate,
        planId: quotaResult.planId
      }
    });
  } catch (err: any) {
    if (authenticatedUserId) {
      await refundAiQuota(authenticatedUserId, env);
    }
    console.error("Cloudflare Pages Function error in chat:", err);
    return errorResponse(err.message || "Failed to process chat with invoices", 500, "SERVER_ERROR");
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};
