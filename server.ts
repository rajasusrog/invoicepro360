import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

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

// 1. Natural Language Invoice Generator endpoint
app.post("/api/invoice/create-from-text", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getGeminiClient();
    const systemInstruction = `You are an expert invoice processing AI. Convert natural language requests into structured invoice details.
Parse supplier names, customer names, date, invoice numbers, items, quantities, prices, tax rates (GST rates), and notes.
Also accurately classify the expense category (e.g., 'Utilities', 'Software', 'Travel', 'Hardware', 'Marketing', 'Consulting', 'Office Supplies', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Meals & Entertainment', 'Healthcare', 'Professional Services', 'Other') and provide relevant auto-tags.
If specific fields are not mentioned, use logical defaults or leave them empty (e.g. if tax is mentioned as 18% GST, set taxRate as 18).
Standard GST rates are typically 0, 5, 12, 18, 28. Use those if not specified.
Return the structured invoice details exactly matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "Invoice number or identifier, generate one if missing (e.g., INV-2026-001)" },
            supplierName: { type: Type.STRING, description: "Name of the supplier or merchant" },
            supplierGstin: { type: Type.STRING, description: "15-character GSTIN of the supplier if present" },
            supplierAddress: { type: Type.STRING, description: "Supplier's address if present" },
            customerName: { type: Type.STRING, description: "Name of the customer or buyer" },
            customerGstin: { type: Type.STRING, description: "15-character GSTIN of the customer if present" },
            customerAddress: { type: Type.STRING, description: "Customer's address if present" },
            date: { type: Type.STRING, description: "Invoice date in YYYY-MM-DD format. Default to today if not provided." },
            category: { type: Type.STRING, description: "Primary accounting type: 'Sales', 'Purchase', 'Expense', etc." },
            expenseCategory: { type: Type.STRING, description: "Category such as 'Utilities', 'Software', 'Travel', 'Hardware', 'Marketing', 'Consulting', 'Office Supplies', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Professional Services', 'Other'" },
            tags: {
              type: Type.ARRAY,
              description: "Relevant tags for the invoice (e.g. ['Software', 'Cloud', 'SaaS'], ['Utilities', 'Power'], ['Travel', 'Hotel'])",
              items: { type: Type.STRING }
            },
            items: {
              type: Type.ARRAY,
              description: "List of items or services in the invoice",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Item description" },
                  quantity: { type: Type.NUMBER, description: "Quantity of the item (default to 1)" },
                  price: { type: Type.NUMBER, description: "Unit price of the item" },
                  taxRate: { type: Type.NUMBER, description: "GST rate percentage (e.g., 18 for 18% GST, default to 18 if not specified)" },
                  hsn: { type: Type.STRING, description: "4-to-8 digit HSN code if relevant (e.g., steel rods might be HSN 7214)" }
                },
                required: ["description", "quantity", "price", "taxRate"]
              }
            },
            notes: { type: Type.STRING, description: "Any extra notes, payment instructions, or terms mentioned" }
          },
          required: ["supplierName", "customerName", "items"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from AI model");
    }

    const invoiceData = JSON.parse(text);
    res.json(invoiceData);
  } catch (error: any) {
    console.error("Error creating invoice from text:", error);
    res.status(500).json({ error: error.message || "Failed to process invoice request" });
  }
});

// 2. OCR Extraction endpoint
app.post("/api/invoice/ocr", async (req, res) => {
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "fileBase64 and mimeType are required" });
    }

    const ai = getGeminiClient();
    const imagePart = {
      inlineData: {
        mimeType,
        data: fileBase64,
      },
    };

    const textPart = {
      text: `Analyze this invoice scan/image/photo and extract all relevant details into structured JSON format.
Be highly accurate in reading the numeric values, dates, supplier and customer details, items, HSN codes, and GST rates.
Also accurately categorize the invoice into an expenseCategory (e.g., 'Utilities', 'Software', 'Travel', 'Hardware', 'Marketing', 'Consulting', 'Office Supplies', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Professional Services', 'Other') and generate descriptive tags.
If any field is unreadable, leave it empty or make a best guess based on context.
Return the structured invoice details exactly matching the schema.`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "Invoice number or identifier found on the page" },
            supplierName: { type: Type.STRING, description: "Legal or brand name of the supplier" },
            supplierGstin: { type: Type.STRING, description: "15-character GSTIN of the supplier" },
            supplierAddress: { type: Type.STRING, description: "Supplier's address" },
            customerName: { type: Type.STRING, description: "Name of the customer or buyer" },
            customerGstin: { type: Type.STRING, description: "15-character GSTIN of the customer" },
            customerAddress: { type: Type.STRING, description: "Customer's address" },
            date: { type: Type.STRING, description: "Invoice date in YYYY-MM-DD format (convert from the read date format)" },
            expenseCategory: { type: Type.STRING, description: "Category such as 'Utilities', 'Software', 'Travel', 'Hardware', 'Marketing', 'Consulting', 'Office Supplies', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Professional Services', 'Other'" },
            tags: {
              type: Type.ARRAY,
              description: "Relevant tags extracted from the invoice (e.g. ['Software', 'SaaS'], ['Utilities', 'Electric'], ['Travel', 'Hotel'])",
              items: { type: Type.STRING }
            },
            items: {
              type: Type.ARRAY,
              description: "Items or services in the table",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Item name or description" },
                  quantity: { type: Type.NUMBER, description: "Quantity" },
                  price: { type: Type.NUMBER, description: "Unit price before tax" },
                  taxRate: { type: Type.NUMBER, description: "GST rate percentage (e.g. 18, 5, 12, 28, 0)" },
                  hsn: { type: Type.STRING, description: "HSN code if listed" }
                },
                required: ["description", "quantity", "price", "taxRate"]
              }
            },
            notes: { type: Type.STRING, description: "Any other details, notes, terms, bank details found" }
          },
          required: ["supplierName", "customerName", "items"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from AI OCR model");
    }

    const extractedData = JSON.parse(text);
    res.json(extractedData);
  } catch (error: any) {
    console.error("Error in OCR extraction:", error);
    res.status(500).json({ error: error.message || "Failed to extract invoice details" });
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
      model: "gemini-3.8-flash",
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
      model: "gemini-3.8-flash",
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
      model: "gemini-3.8-flash",
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

// 3. AI Chat over Invoices endpoint
app.post("/api/invoice/chat", async (req, res) => {
  try {
    const { messages, invoices } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const ai = getGeminiClient();

    // We can present the list of invoices to the system instruction or as user context
    // Keep it readable and compact so it fits within context comfortably
    const compactInvoices = (invoices || []).map((inv: any) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      supplier: inv.supplierName,
      customer: inv.customerName,
      date: inv.date,
      subtotal: inv.subtotal,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
      status: inv.status,
      category: inv.category,
      supplierGstin: inv.supplierGstin,
      customerGstin: inv.customerGstin,
      itemCount: inv.items?.length || 0,
      itemsSummary: (inv.items || []).map((item: any) => `${item.description} (Qty: ${item.quantity}, Price: ${item.price}, Tax: ${item.taxRate}%)`).join(", ")
    }));

    const systemInstruction = `You are InvoicePro AI Assistant, a professional and helpful accounting bot.
You have secure access to the user's current list of invoices:
${JSON.stringify(compactInvoices, null, 2)}

Your job is to answer queries about these invoices.
Common questions include:
- Invoices above certain values (e.g., show invoices above ₹50,000)
- Finding duplicate invoices (same number or very similar vendor/amount)
- Finding invoices missing GSTIN details
- Customer purchase analysis (which customer bought the most, top clients)
- Vendor spend analysis (top suppliers)
- Date-based queries (last month, specific date range)
- Monthly revenue, tax totals, or outstanding unpaid balances.

Guidelines:
1. Always format financial figures in Indian Rupees (₹) with proper formatting (e.g. ₹50,000).
2. When answering, be concise and highly professional.
3. Use clean Markdown tables to present invoice lists or comparisons.
4. You can suggest a specific action (like "filter" with a query, or "highlight_invoice" with an ID) in the JSON response to help the UI focus the user's view.
5. If the user asks a question that requires filtering the list, explain your findings and specify the filter query or invoice ID in the suggestedAction block.
   For example, if they ask about "Tata", you can output a filter query of "Tata".

Always return your response in JSON format matching the schema:
{
  "text": "Your markdown answer text here...",
  "suggestedAction": {
    "type": "highlight_invoice" | "filter" | "none",
    "invoiceId": "the invoice ID if referencing a single invoice",
    "filterQuery": "the string to search or filter invoices in the UI"
  }
}`;

    // Prepare message history for Gemini chat
    // The last message is the user prompt
    const userPrompt = messages[messages.length - 1].text;
    
    // We can include previous conversation turns to provide excellent context
    const chatHistory = messages.slice(0, -1).map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Generate response
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        ...chatHistory,
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The response markdown text to show the user" },
            suggestedAction: {
              type: Type.OBJECT,
              description: "Optional action for the UI to execute",
              properties: {
                type: { type: Type.STRING, description: "Must be 'highlight_invoice', 'filter', or 'none'" },
                invoiceId: { type: Type.STRING, description: "ID of the invoice if highlighting a single invoice" },
                filterQuery: { type: Type.STRING, description: "Filter search query (e.g. vendor name, status) to filter the invoices list in the UI" }
              },
              required: ["type"]
            }
          },
          required: ["text"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text from Gemini chat");
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error in AI Invoice Chat:", error);
    res.status(500).json({ error: error.message || "Chat failed to process" });
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
