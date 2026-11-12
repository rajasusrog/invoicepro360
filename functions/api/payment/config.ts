import { jsonResponse, errorResponse } from "../../_gemini";
import { getRazorpayConfig } from "../../_payment";

interface Env {
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { env } = context;

  try {
    const config = getRazorpayConfig(env);

    return jsonResponse({
      isConfigured: config.isConfigured,
      keyId: config.isConfigured ? config.keyId : null,
      currency: "INR",
      paymentGateway: "razorpay"
    });
  } catch (err: any) {
    console.error("Payment config GET error:", err);
    return errorResponse(err.message || "Failed to load payment configuration", 500, "SERVER_ERROR");
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
