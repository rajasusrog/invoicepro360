import { jsonResponse, errorResponse } from "../../_gemini";
import { extractInvoiceFromOcr } from "../../_providers";
import { authenticateRequest, checkAndIncrementAiQuota, refundAiQuota } from "../../_subscription";
import { analyzeSecurityEvent } from "../../_abuse_detector";

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  let authenticatedUserId: string | null = null;
  const startTime = Date.now();
  const { request, env } = context;

  try {
    // 1. Authenticate user from Supabase session Bearer token
    const authResult = await authenticateRequest(request.headers, env);
    if (!authResult.user) {
      return errorResponse(authResult.error || "Authentication required", 401, "AUTH_REQUIRED");
    }
    authenticatedUserId = authResult.user.id;
    const userEmail = authResult.user.email;

    if (authResult.user.is_suspended) {
      return errorResponse("Your account is currently restricted. Please contact administrative support.", 403, "ACCOUNT_SUSPENDED");
    }

    // 2. Validate inputs BEFORE checking or charging AI quota
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400, "BAD_REQUEST");
    }

    const { fileBase64, mimeType, provider, model } = body || {};
    if (!fileBase64 || !mimeType) {
      return errorResponse("fileBase64 and mimeType are required for OCR processing", 400, "BAD_REQUEST");
    }

    // Check payload boundaries
    if (fileBase64.length > 15 * 1024 * 1024) {
      return errorResponse("Uploaded image exceeds safe maximum file threshold (15MB)", 400, "FILE_TOO_LARGE");
    }

    // 3. Concurrency-safe atomic AI quota enforcement
    const quotaResult = await checkAndIncrementAiQuota(authenticatedUserId, env);
    if (!quotaResult.allowed) {
      return errorResponse(
        quotaResult.message || "Monthly AI generation quota reached. Upgrade your plan to extract more invoices.",
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

    // 4. Invoke Multi-provider OCR Extraction (Gemini vision default, OpenAI vision)
    try {
      const extractedData = await extractInvoiceFromOcr({
        fileBase64,
        mimeType,
        provider,
        model,
        env
      });

      const latencyMs = Date.now() - startTime;

      // Telemetry log
      await analyzeSecurityEvent({
        text: `OCR Extraction ${mimeType} (${Math.round(fileBase64.length * 0.75 / 1024)} KB)`,
        userId: authenticatedUserId,
        userEmail,
        endpoint: "/api/invoice/ocr",
        operationType: "ocr_extraction",
        provider: provider || "gemini",
        model,
        statusCode: 200,
        latencyMs
      }, env);

      return jsonResponse({
        ...extractedData,
        _usage: {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId,
          latencyMs
        }
      });
    } catch (providerError: any) {
      await refundAiQuota(authenticatedUserId, env);
      console.error("Downstream AI Provider error in ocr:", providerError);
      return errorResponse(
        providerError.message || "Failed to extract invoice details via OCR",
        500,
        "AI_PROVIDER_ERROR"
      );
    }
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in ocr:", err);
    return errorResponse(err.message || "Internal server error during OCR processing", 500, "SERVER_ERROR");
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
