import { jsonResponse, errorResponse } from "../../_gemini";
import { generateInvoiceFromText } from "../../_providers";
import { authenticateRequest, checkAndIncrementAiQuota, refundAiQuota } from "../../_subscription";

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  let authenticatedUserId: string | null = null;
  const { request, env } = context;

  try {
    // 1. Authenticate user from Supabase session Bearer token
    const authResult = await authenticateRequest(request.headers, env);
    if (!authResult.user) {
      return errorResponse(authResult.error || "Authentication required", 401, "AUTH_REQUIRED");
    }
    authenticatedUserId = authResult.user.id;

    // 2. Validate request body and prompt BEFORE checking/charging quota
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400, "BAD_REQUEST");
    }

    const { prompt, provider, model } = body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return errorResponse("Prompt is required and must not be empty", 400, "BAD_REQUEST");
    }

    // 3. Concurrency-safe atomic AI quota enforcement
    const quotaResult = await checkAndIncrementAiQuota(authenticatedUserId, env);
    if (!quotaResult.allowed) {
      return errorResponse(
        quotaResult.message || "Monthly AI invoice generation limit reached. Please upgrade your plan.",
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

    // 4. Invoke Multi-provider AI generation (Gemini verified default, OpenAI, Claude)
    try {
      const invoiceData = await generateInvoiceFromText({
        prompt: prompt.trim(),
        provider,
        model,
        env
      });

      return jsonResponse({
        ...invoiceData,
        _usage: {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      });
    } catch (providerError: any) {
      // Refund quota since downstream provider call failed
      await refundAiQuota(authenticatedUserId, env);
      console.error("Downstream AI Provider error in create-from-text:", providerError);
      return errorResponse(
        providerError.message || "AI generation failed. Please try again.",
        500,
        "AI_PROVIDER_ERROR"
      );
    }
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in create-from-text:", err);
    return errorResponse(err.message || "Internal server error processing invoice generation", 500, "SERVER_ERROR");
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
