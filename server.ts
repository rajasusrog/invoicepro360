import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { 
  generateInvoiceFromText, 
  extractInvoiceFromOcr, 
  chatWithInvoices 
} from "./functions/_providers";
import {
  authenticateRequest,
  checkAndIncrementAiQuota,
  refundAiQuota,
  checkAndIncrementInvoiceQuota,
  getUserSubscription,
  getServerSupabase
} from "./functions/_subscription";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit to handle base64 invoice uploads (images)
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Lazy initializer for Gemini client to prevent crash if key is missing on startup
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// 1. Natural Language Invoice Generator endpoint (Supports multi-provider + quota enforcement)
app.post("/api/invoice/create-from-text", async (req, res) => {
  let authenticatedUserId: string | null = null;
  try {
    // 1. Authenticate user from Supabase session Bearer token
    const authResult = await authenticateRequest(req.headers, process.env);
    if (!authResult.user) {
      return res.status(401).json({ error: authResult.error || "Authentication required", code: "AUTH_REQUIRED" });
    }
    authenticatedUserId = authResult.user.id;

    const { prompt, provider, model } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required and must not be empty", code: "BAD_REQUEST" });
    }

    // 2. Concurrency-safe atomic AI quota enforcement
    const quotaResult = await checkAndIncrementAiQuota(authenticatedUserId, process.env);
    if (!quotaResult.allowed) {
      return res.status(429).json({
        error: quotaResult.message || "Monthly AI generation limit reached. Please upgrade your plan.",
        code: "AI_QUOTA_EXCEEDED",
        used: quotaResult.used,
        limit: quotaResult.limit,
        remaining: 0,
        resetDate: quotaResult.resetDate,
        planId: quotaResult.planId
      });
    }

    try {
      const invoiceData = await generateInvoiceFromText({
        prompt: prompt.trim(),
        provider,
        model,
        env: process.env
      });

      res.json({
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
      await refundAiQuota(authenticatedUserId, process.env);
      console.error("Downstream AI Provider error in create-from-text:", providerError);
      res.status(500).json({ error: providerError.message || "Failed to process invoice request", code: "AI_PROVIDER_ERROR" });
    }
  } catch (error: any) {
    console.error("Error creating invoice from text:", error);
    res.status(500).json({ error: error.message || "Failed to process invoice request", code: "SERVER_ERROR" });
  }
});

// 2. OCR Extraction endpoint (Supports multi-provider + quota enforcement)
app.post("/api/invoice/ocr", async (req, res) => {
  let authenticatedUserId: string | null = null;
  try {
    const authResult = await authenticateRequest(req.headers, process.env);
    if (!authResult.user) {
      return res.status(401).json({ error: authResult.error || "Authentication required", code: "AUTH_REQUIRED" });
    }
    authenticatedUserId = authResult.user.id;

    const { fileBase64, mimeType, provider, model } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "fileBase64 and mimeType are required", code: "BAD_REQUEST" });
    }

    // Concurrency-safe atomic AI quota enforcement
    const quotaResult = await checkAndIncrementAiQuota(authenticatedUserId, process.env);
    if (!quotaResult.allowed) {
      return res.status(429).json({
        error: quotaResult.message || "Monthly AI generation quota reached. Upgrade your plan to extract more invoices.",
        code: "AI_QUOTA_EXCEEDED",
        used: quotaResult.used,
        limit: quotaResult.limit,
        remaining: 0,
        resetDate: quotaResult.resetDate,
        planId: quotaResult.planId
      });
    }

    try {
      const extractedData = await extractInvoiceFromOcr({
        fileBase64,
        mimeType,
        provider,
        model,
        env: process.env
      });

      res.json({
        ...extractedData,
        _usage: {
          used: quotaResult.used,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate,
          planId: quotaResult.planId
        }
      });
    } catch (providerError: any) {
      await refundAiQuota(authenticatedUserId, process.env);
      console.error("Downstream AI Provider error in ocr:", providerError);
      res.status(500).json({ error: providerError.message || "Failed to extract invoice details", code: "AI_PROVIDER_ERROR" });
    }
  } catch (error: any) {
    console.error("Error in OCR extraction:", error);
    res.status(500).json({ error: error.message || "Failed to extract invoice details", code: "SERVER_ERROR" });
  }
});

// 3. AI Auto-Tagging & Categorization endpoint (Individual Invoice)
app.post("/api/invoice/auto-tag", async (req, res) => {
  try {
    const { invoice } = req.body;
    if (!invoice) {
      return res.status(400).json({ error: "Invoice data is required for auto-tagging" });
    }

    const ai = getGeminiClient();
    const prompt = `Analyze the following invoice details and categorize it into the most accurate business category and tags based primarily on its line item descriptions:
Supplier: ${invoice.supplierName || 'Unknown'}
Customer: ${invoice.customerName || 'Unknown'}
Total Amount: ${invoice.totalAmount || 0}
Items: ${(invoice.items || []).map((i: any) => `${i.description} (Qty: ${i.quantity || 1}, Price: ${i.price || 0})`).join(', ')}
Notes: ${invoice.notes || 'None'}

Target Categories:
- 'Office Supplies' (Stationery, pens, paper reams, printer ink, folders, desk organizers, office pantry, cleaning materials)
- 'Marketing' (Advertising campaigns, Google/Meta Ads, promotional merchandise, SEO, social media, branding, flyers, PR)
- 'Hardware' (Laptops, desktop PCs, monitors, servers, networking gear, hard drives, cables, electronics, equipment)
- 'Software' (SaaS subscriptions, cloud hosting, AWS, GCP, Azure, software licenses, dev tools, domains)
- 'Utilities' (Electricity, water, broadband internet, telecom, gas, power tariff)
- 'Services' (Professional fees, legal, audit, consulting, agency retainer, maintenance contracts, cleaning)
- 'Travel' (Airlines, flight tickets, hotels, cabs, train fares, corporate travel)
- 'Logistics' (Freight, courier, shipping, delivery, transport, warehousing)
- 'Raw Materials' (Steel, cement, industrial materials, chemicals, fabrication inputs)
- 'Maintenance' (Hardware repairs, AC servicing, facility repairs, AMC)
- 'Rent' (Office lease, coworking space, property rent)
- 'Meals & Entertainment' (Client dinners, catering, team meals)
- 'Healthcare' (Medical supplies, health insurance, pharmacy)
- 'Other'

Generate:
1. The single best primary category ('expenseCategory') - e.g., 'Office Supplies', 'Marketing', 'Hardware', 'Software', 'Utilities', or 'Services'
2. An array of 2 to 5 specific, high-value keyword tags (e.g. ['Office Supplies', 'Stationery', 'Paper'] or ['Marketing', 'PPC', 'Google Ads'])
3. A confidence score between 0.0 and 1.0
4. A brief 1-sentence reasoning for the categorization.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expenseCategory: { 
              type: Type.STRING, 
              description: "The primary classified category: 'Office Supplies', 'Marketing', 'Hardware', 'Software', 'Utilities', 'Services', 'Travel', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Meals & Entertainment', 'Healthcare', or 'Other'" 
            },
            tags: {
              type: Type.ARRAY,
              description: "2 to 5 relevant descriptive tags",
              items: { type: Type.STRING }
            },
            confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" },
            reasoning: { type: Type.STRING, description: "Short explanation for why this category and tags were assigned" }
          },
          required: ["expenseCategory", "tags", "confidence", "reasoning"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text from Gemini auto-tagging");
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error in AI Auto-Tagging:", error);
    res.status(500).json({ error: error.message || "Failed to auto-tag invoice" });
  }
});

// 4. Background Line Item Categorization endpoint (Single or Fast Inference)
app.post("/api/invoice/categorize-from-line-items", async (req, res) => {
  try {
    const { lineItems, supplierName, notes } = req.body;
    if (!lineItems || (!Array.isArray(lineItems) && typeof lineItems !== "string")) {
      return res.status(400).json({ error: "lineItems array or description string is required" });
    }

    const itemsSummary = Array.isArray(lineItems)
      ? lineItems.map((i: any) => typeof i === "string" ? i : `${i.description || i.name || "Item"} (Qty: ${i.quantity || 1})`).join(", ")
      : String(lineItems);

    const ai = getGeminiClient();
    const prompt = `Analyze these invoice line item descriptions and assign the most appropriate business expense category:
Line Items: ${itemsSummary}
Supplier / Vendor: ${supplierName || 'Not specified'}
Additional Notes: ${notes || 'None'}

Primary Categories:
- 'Office Supplies': Stationery, paper, pens, printers, toner/ink, desk accessories, pantry items, files, folders.
- 'Marketing': Advertising, Google Ads, Meta Ads, social media marketing, SEO, promotional prints, merchandise, PR.
- 'Hardware': Laptops, desktop PCs, monitors, servers, switches, computer accessories, networking, storage, electronics.
- 'Software': SaaS, cloud compute (AWS, GCP, Azure), software licenses, developer tools, database subscriptions, domains.
- 'Utilities': Electricity, water, telecom, broadband internet, power consumption, gas.
- 'Services': Consulting, legal counsel, audits, accounting, advisory, freelance retainers, maintenance.
- 'Travel': Flights, hotel accommodations, cabs, train travel.
- 'Logistics': Shipping, courier, freight, transport.
- 'Raw Materials': Construction materials, industrial steel, chemicals, parts.
- 'Maintenance': Repairs, AC service, equipment maintenance.
- 'Rent': Office rental, coworking lease.
- 'Meals & Entertainment': Food catering, team meals.
- 'Healthcare': Medical equipment, pharmaceutical products.
- 'Other'

Return valid JSON with:
1. expenseCategory: The best primary category (e.g. 'Office Supplies', 'Marketing', 'Hardware', etc.)
2. tags: 2-5 relevant tags (e.g. ['#OfficeSupplies', '#Stationery'])
3. confidence: Number between 0.0 and 1.0
4. reasoning: 1-sentence explanation of why the line items triggered this category.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expenseCategory: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["expenseCategory", "tags", "confidence", "reasoning"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini categorization");
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error in categorize-from-line-items:", error);
    res.status(500).json({ error: error.message || "Failed to categorize line items" });
  }
});

// 5. Background Batch Categorization endpoint for Multiple Invoices
app.post("/api/invoice/batch-categorize-from-line-items", async (req, res) => {
  try {
    const { invoices } = req.body;
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ error: "invoices array is required" });
    }

    const ai = getGeminiClient();

    // Prepare compact invoice summaries for batch reasoning
    const invoiceListSummary = invoices.map((inv: any, idx: number) => {
      const itemsText = (inv.items || inv.lineItems || [])
        .map((i: any) => typeof i === "string" ? i : `${i.description || i.name} (x${i.quantity || 1})`)
        .join("; ");
      return `[ID: ${inv.id || `inv-${idx}`}] Vendor: ${inv.supplierName || 'Unknown'}, Items: ${itemsText || 'General item'}`;
    }).join("\n");

    const prompt = `You are an automated background accountant. Categorize each invoice in the list based strictly on its line item descriptions and vendor.
Categories must be one of:
'Office Supplies', 'Marketing', 'Hardware', 'Software', 'Utilities', 'Services', 'Travel', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Meals & Entertainment', 'Healthcare', 'Other'.

Invoice list:
${invoiceListSummary}

Return a JSON array containing an object for each invoice with:
- id: string (matching the ID in the input)
- expenseCategory: string (e.g. 'Office Supplies', 'Marketing', 'Hardware')
- tags: array of 2 to 4 relevant tags
- confidence: number between 0.0 and 1.0
- reasoning: brief reason`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  expenseCategory: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  confidence: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING }
                },
                required: ["id", "expenseCategory", "tags", "confidence"]
              }
            }
          },
          required: ["results"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from batch Gemini categorization");
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error in batch line item categorization:", error);
    res.status(500).json({ error: error.message || "Failed to batch categorize invoices" });
  }
});

// 6. AI Chat over Invoices endpoint (Supports multi-provider: Gemini default, OpenAI, Claude)
app.post("/api/invoice/chat", async (req, res) => {
  try {
    const authResult = await authenticateRequest(req.headers, process.env);
    if (!authResult.user) {
      return res.status(401).json({ error: authResult.error || "Authentication required", code: "AUTH_REQUIRED" });
    }

    const { messages, invoices, provider, model } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required", code: "BAD_REQUEST" });
    }

    const result = await chatWithInvoices({
      messages,
      invoices,
      provider,
      model,
      env: process.env
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error in AI Invoice Chat:", error);
    res.status(500).json({ error: error.message || "Chat failed to process", code: "SERVER_ERROR" });
  }
});

// 7. Save Invoice with Server-Enforced Quota & User Isolation
app.post("/api/invoice/save", async (req, res) => {
  try {
    const authResult = await authenticateRequest(req.headers, process.env);
    if (!authResult.user) {
      return res.status(401).json({ error: authResult.error || "Authentication required", code: "AUTH_REQUIRED" });
    }
    const userId = authResult.user.id;

    const { invoice } = req.body || {};
    if (!invoice || typeof invoice !== "object") {
      return res.status(400).json({ error: "invoice object is required in request body", code: "BAD_REQUEST" });
    }

    if (!invoice.invoiceNumber || !invoice.supplierName || !invoice.customerName) {
      return res.status(400).json({ error: "Missing required invoice fields (invoiceNumber, supplierName, customerName)", code: "BAD_REQUEST" });
    }

    // Concurrency-safe atomic invoice quota check & increment
    const quotaResult = await checkAndIncrementInvoiceQuota(userId, process.env);
    if (!quotaResult.allowed) {
      return res.status(429).json({
        error: quotaResult.message || "Monthly successful invoice quota reached. Please upgrade your plan.",
        code: "INVOICE_QUOTA_EXCEEDED",
        used: quotaResult.used,
        limit: quotaResult.limit,
        remaining: 0,
        resetDate: quotaResult.resetDate,
        planId: quotaResult.planId
      });
    }

    // Persist to Supabase
    const supabase = getServerSupabase(process.env);
    if (!supabase || userId === "local-dev-user") {
      return res.json({
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
      user_id: userId,
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
      try {
        await supabase
          .from("subscriptions")
          .update({ invoices_used: Math.max(0, (quotaResult.used || 1) - 1) })
          .eq("user_id", userId);
      } catch (refundErr) {
        console.error("Failed to refund invoice counter:", refundErr);
      }
      return res.status(500).json({ error: `Failed to persist invoice: ${insertError.message}`, code: "DB_INSERT_ERROR" });
    }

    res.json({
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
  } catch (error: any) {
    console.error("Error saving invoice:", error);
    res.status(500).json({ error: error.message || "Failed to save invoice", code: "SERVER_ERROR" });
  }
});

// 8. Get Subscription, Plan & Quota Details
app.get("/api/subscription", async (req, res) => {
  try {
    const authResult = await authenticateRequest(req.headers, process.env);
    if (!authResult.user) {
      return res.status(401).json({ error: authResult.error || "Authentication required", code: "AUTH_REQUIRED" });
    }

    const subInfo = await getUserSubscription(authResult.user.id, process.env);
    res.json(subInfo);
  } catch (error: any) {
    console.error("Error fetching subscription info:", error);
    res.status(500).json({ error: error.message || "Failed to fetch subscription", code: "SERVER_ERROR" });
  }
});

// Configure Vite or production static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
