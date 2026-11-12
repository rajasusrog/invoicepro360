import { jsonResponse, errorResponse } from "../../_gemini";
import { authenticateRequest, getServerSupabase } from "../../_subscription";
import {
  checkAndReserveBatchInvoiceQuota,
  rollbackBatchInvoiceQuota
} from "../../_billing";

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

    if (authResult.user.is_suspended) {
      return errorResponse(
        "Your account is currently restricted. Please contact administrative support.",
        403,
        "ACCOUNT_SUSPENDED"
      );
    }

    // 2. Parse and validate single or batch invoice payload BEFORE checking/charging quota
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400, "BAD_REQUEST");
    }

    const isBatch = Array.isArray(body?.invoices);
    const invoiceList: any[] = isBatch ? body.invoices : body?.invoice ? [body.invoice] : [];

    if (invoiceList.length === 0) {
      return errorResponse("At least one valid invoice object is required in request body", 400, "BAD_REQUEST");
    }

    for (const inv of invoiceList) {
      if (!inv || typeof inv !== "object" || !inv.invoiceNumber || !inv.supplierName || !inv.customerName) {
        return errorResponse(
          "Missing required invoice fields (invoiceNumber, supplierName, customerName). Quota was not charged.",
          400,
          "BAD_REQUEST"
        );
      }
    }

    const idempotencyKey =
      body?.idempotencyKey ||
      `inv_batch_${userId}_${invoiceList.map((i) => i.id || i.invoiceNumber).join("_")}`;

    // 3. Concurrency-safe atomic invoice quota check & reservation for the ENTIRE batch
    const quotaResult = await checkAndReserveBatchInvoiceQuota(
      userId,
      invoiceList.length,
      idempotencyKey,
      env
    );

    if (!quotaResult.allowed) {
      return errorResponse(
        quotaResult.message || "Monthly invoice quota reached. Please upgrade your plan.",
        429,
        "INVOICE_QUOTA_EXCEEDED",
        {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      );
    }

    // 4. Persist invoice(s) to Supabase with server-enforced user_id
    const supabase = getServerSupabase(env);
    if (!supabase || userId === "local-dev-user") {
      return jsonResponse({
        success: true,
        invoice: invoiceList[0],
        invoices: invoiceList,
        usage: {
          invoicesUsed: quotaResult.used,
          invoiceQuota: quotaResult.limit,
          remaining: quotaResult.remaining
        },
        _usage: {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      });
    }

    const dbRows = invoiceList.map((invoice) => ({
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
      balance_due: Number(invoice.balanceDue) ?? Number(invoice.totalAmount) ?? 0,
      payments: invoice.payments || [],
      category: invoice.category || "Sales",
      expense_category: invoice.expenseCategory || null,
      tags: invoice.tags || [],
      notes: invoice.notes || null,
      ocr_source: invoice.ocrSource || null,
      created_at: invoice.createdAt || new Date().toISOString()
    }));

    const { data: savedRows, error: insertError } = await supabase
      .from("invoices")
      .insert(dbRows)
      .select();

    if (insertError) {
      // Rollback reserved quota so failed creation never consumes quota
      await rollbackBatchInvoiceQuota(userId, invoiceList.length, env);
      console.error("Failed to insert invoice(s) into database:", insertError);
      return errorResponse(`Failed to persist invoice(s): ${insertError.message}`, 500, "DB_INSERT_ERROR");
    }

    const savedInvoices = invoiceList.map((inv, idx) => ({
      ...inv,
      id: savedRows?.[idx]?.id || inv.id,
      createdAt: savedRows?.[idx]?.created_at || inv.createdAt
    }));

    return jsonResponse({
      success: true,
      invoice: savedInvoices[0],
      invoices: savedInvoices,
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
