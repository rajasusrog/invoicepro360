import { jsonResponse, errorResponse } from "../../_gemini";
import { chatWithInvoices } from "../../_providers";
import { authenticateRequest } from "../../_subscription";

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 1. Authenticate user from Supabase session Bearer token
    const authResult = await authenticateRequest(request.headers, env);
    if (!authResult.user) {
      return errorResponse(authResult.error || "Authentication required", 401, "AUTH_REQUIRED");
    }

    // 2. Validate inputs
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

    // 3. Multi-provider Chat processing
    const response = await chatWithInvoices({
      messages,
      invoices: Array.isArray(invoices) ? invoices : [],
      provider,
      model,
      env
    });

    return jsonResponse(response);
  } catch (err: any) {
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
