import { getAuthHeaders } from "../lib/supabase";

export interface ApiError extends Error {
  code?: string;
  status?: number;
  used?: number;
  limit?: number;
  remaining?: number;
  resetDate?: string;
  planId?: string;
}

/**
 * Utility to safely fetch and parse JSON responses from API routes.
 * Automatically injects Supabase JWT Bearer token and parses machine-readable error codes.
 */
export async function safeFetchJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  // Automatically attach Supabase JWT token if not already explicitly provided
  const authHeaders = await getAuthHeaders();
  const mergedHeaders = new Headers(options.headers || {});
  
  if (!mergedHeaders.has("Authorization") && authHeaders.Authorization) {
    mergedHeaders.set("Authorization", authHeaders.Authorization);
  }

  try {
    response = await fetch(url, {
      ...options,
      headers: mergedHeaders
    });
  } catch (netErr: any) {
    const err: ApiError = new Error(netErr?.message || "Network error. Unable to connect to server.");
    err.code = "NETWORK_ERROR";
    throw err;
  }

  const rawText = await response.text();

  let parsed: any = null;
  if (rawText && rawText.trim()) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errorMsg = 
      parsed?.error || 
      (response.status === 429 ? "Monthly usage quota exceeded." :
       response.status === 401 ? "Authentication required. Please sign in." :
       response.status === 404 ? "API endpoint not found (404)." :
       response.status === 500 ? "Internal server error. Please check provider API keys." :
       `Server returned HTTP ${response.status}`);

    const apiErr: ApiError = new Error(errorMsg);
    apiErr.status = response.status;
    apiErr.code = parsed?.code || (
      response.status === 429 ? "QUOTA_EXCEEDED" : 
      response.status === 401 ? "AUTH_REQUIRED" : 
      "API_ERROR"
    );
    apiErr.used = parsed?.used;
    apiErr.limit = parsed?.limit;
    apiErr.remaining = parsed?.remaining;
    apiErr.resetDate = parsed?.resetDate;
    apiErr.planId = parsed?.planId;

    throw apiErr;
  }

  if (parsed === null) {
    const emptyErr: ApiError = new Error("AI service returned an empty or non-JSON response.");
    emptyErr.code = "EMPTY_RESPONSE";
    throw emptyErr;
  }

  return parsed as T;
}
