import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateRequest, checkAndIncrementInvoiceQuota, getServerSupabase } from "../../_subscription";

interface Env {
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
    const userId = authResult.user.id;

    // 2. Validate invoice payload BEFORE checking/charging quota
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400, "BAD_REQUEST");
    }

    const { invoice } = body || {};
    if (!invoice || typeof invoice !== "object") {
      return errorResponse("invoice object is required in request body", 400, "BAD_REQUEST");
    }

    if (!invoice.invoiceNumber || !invoice.supplierName || !invoice.customerName) {
      return errorResponse("Missing required invoice fields (invoiceNumber, supplierName, customerName)", 400, "BAD_REQUEST");
    }

    // 3. Concurrency-safe atomic invoice quota check & increment
    const quotaResult = await checkAndIncrementInvoiceQuota(userId, env);
    if (!quotaResult.allowed) {
      return errorResponse(
        quotaResult.message || "Monthly successful invoice quota reached. Please upgrade your plan.",
        429,
        "INVOICE_QUOTA_EXCEEDED",
        {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: 0,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      );
    }

    // 4. Persist invoice to Supabase with server-enforced user_id
    const supabase = getServerSupabase(env);
    if (!supabase || userId === "local-dev-user") {
      // Local/mock fallback when Supabase is not configured in dev
      return jsonResponse({
        success: true,
        invoice,
        _usage: {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      });
    }

    const dbRow = {
      id: invoice.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId, // Server-enforced, cannot be forged
      invoice_number: invoice.invoiceNumber,
      supplier_name: invoice.supplierName,
      supplier_gstin: invoice.supplierGstin || null,
      supplier_address: invoice.supplierAddress || null,
      customer_name: invoice.customerName,
      customer_gstin: invoice.customerGstin || null,
      customer_address: invoice.customerAddress || null,
      date: invoice.date || new Date().toISOString().substring(0, 10),
      due_date: invoice.dueDate || null,
      items: invoice.items || [],
      subtotal: Number(invoice.subtotal) || 0,
      cgst: Number(invoice.cgst) || 0,
      sgst: Number(invoice.sgst) || 0,
      igst: Number(invoice.igst) || 0,
      tax_amount: Number(invoice.taxAmount) || 0,
      total_amount: Number(invoice.totalAmount) || 0,
      status: invoice.status || "unpaid",
      payment_status: invoice.paymentStatus || "due",
      amount_paid: Number(invoice.amountPaid) || 0,
      balance_due: Number(invoice.balanceDue) || Number(invoice.totalAmount) || 0,
      payments: invoice.payments || [],
      category: invoice.category || "Sales",
      expense_category: invoice.expenseCategory || null,
      tags: invoice.tags || [],
      notes: invoice.notes || null,
      ocr_source: invoice.ocrSource || null,
      created_at: invoice.createdAt || new Date().toISOString()
    };

    const { data: savedRow, error: insertError } = await supabase
      .from("invoices")
      .insert(dbRow)
      .select()
      .single();

    if (insertError) {
      // If saving failed, decrement invoices_used counter so user is not penalized
      try {
        await supabase
          .from("subscriptions")
          .update({ invoices_used: Math.max(0, (quotaResult.used || 1) - 1) })
          .eq("user_id", userId);
      } catch (refundErr) {
        console.error("Failed to refund invoice counter:", refundErr);
      }

      console.error("Failed to insert invoice into database:", insertError);
      return errorResponse(`Failed to persist invoice: ${insertError.message}`, 500, "DB_INSERT_ERROR");
    }

    return jsonResponse({
      success: true,
      invoice: {
        ...invoice,
        id: savedRow.id,
        createdAt: savedRow.created_at
      },
      _usage: {
        used: quotaResult.used,
        limit: quotaResult.limit,
        remaining: quotaResult.remaining,
        resetDate: quotaResult.resetDate,
        planId: quotaResult.planId
      }
    });
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in invoice/save:", err);
    return errorResponse(err.message || "Failed to save invoice", 500, "SERVER_ERROR");
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
