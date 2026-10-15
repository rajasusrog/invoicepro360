// Multi-provider LLM abstraction layer for Cloudflare Pages Functions and Node.js environments.
// Supported providers: Google Gemini (default), OpenAI (GPT-4o / GPT-4o-mini), and Anthropic Claude (extensible).

export type LLMProvider = "gemini" | "openai" | "anthropic";

export interface ProviderModelConfig {
  defaultModel: string;
  visionModel: string;
  allowedModels: string[];
}

export const PROVIDER_CONFIGS: Record<LLMProvider, ProviderModelConfig> = {
  gemini: {
    defaultModel: "gemini-3.8-flash",
    visionModel: "gemini-3.8-flash",
    allowedModels: [
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3-flash-preview"
    ]
  },
  openai: {
    defaultModel: "gpt-4o-mini",
    visionModel: "gpt-4o-mini",
    allowedModels: ["gpt-4o-mini", "gpt-4o"]
  },
  anthropic: {
    defaultModel: "claude-3-5-sonnet-20241022",
    visionModel: "claude-3-5-sonnet-20241022",
    allowedModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
  }
};

export interface EnvBindings {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  [key: string]: any;
}

/**
 * Safely resolves the API key for the chosen provider from Cloudflare env bindings or process.env.
 * Never exposes keys to the client.
 */
export function resolveApiKey(env: EnvBindings = {}, provider: LLMProvider): string {
  let key: string | undefined;

  if (provider === "gemini") {
    key = env.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
  } else if (provider === "openai") {
    key = env.OPENAI_API_KEY || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined);
  } else if (provider === "anthropic") {
    key = env.ANTHROPIC_API_KEY || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : undefined);
  }

  if (!key || !key.trim()) {
    const keyName = `${provider.toUpperCase()}_API_KEY`;
    throw new Error(
      `${keyName} is not configured in Cloudflare environment bindings or server secrets. Please set ${keyName} to use the ${provider} provider.`
    );
  }

  return key.trim();
}

/**
 * Normalizes provider name from request input, defaulting to 'gemini'.
 */
export function normalizeProvider(input?: string): LLMProvider {
  if (!input) return "gemini";
  const p = input.toLowerCase().trim();
  if (p === "openai" || p === "gpt") return "openai";
  if (p === "anthropic" || p === "claude") return "anthropic";
  return "gemini";
}

/**
 * Normalizes and validates the model identifier for the provider.
 */
export function resolveModel(provider: LLMProvider, requestedModel?: string, isVision = false): string {
  const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.gemini;
  if (requestedModel && config.allowedModels.includes(requestedModel)) {
    return requestedModel;
  }
  return isVision ? config.visionModel : config.defaultModel;
}

/**
 * Strips markdown code block fences (```json ... ```) from model text output.
 */
export function cleanJsonOutput(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

/**
 * Standard HTTP response helper for Cloudflare Functions
 */
export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

// -------------------------------------------------------------
// Gemini REST implementation
// -------------------------------------------------------------
export async function callGemini(
  apiKey: string,
  model: string,
  options: {
    contents: any[];
    systemInstruction?: string;
    responseSchema?: any;
    responseMimeType?: string;
  }
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig: any = {};
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }
  if (options.responseSchema) {
    generationConfig.responseSchema = options.responseSchema;
  }

  const requestBody: any = {
    contents: options.contents,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
  };

  if (options.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "invoicepro-360-edge"
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Gemini API returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`);
  }

  if (!response.ok || data.error) {
    const errMsg = data.error?.message || `Gemini API request failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  const candidate = data.candidates?.[0];
  if (!candidate || !candidate.content?.parts?.[0]?.text) {
    throw new Error("No output text received from Gemini model candidate");
  }

  return candidate.content.parts[0].text;
}

// -------------------------------------------------------------
// OpenAI REST implementation
// -------------------------------------------------------------
export async function callOpenAI(
  apiKey: string,
  model: string,
  options: {
    messages: Array<{ role: string; content: any }>;
    systemInstruction?: string;
    requireJson?: boolean;
    schemaPrompt?: string;
  }
): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const fullMessages: Array<{ role: string; content: any }> = [];

  let systemPrompt = options.systemInstruction || "";
  if (options.requireJson && options.schemaPrompt) {
    systemPrompt += `\n\nCRITICAL: Respond ONLY with valid JSON matching this schema:\n${options.schemaPrompt}`;
  } else if (options.requireJson && !systemPrompt.toLowerCase().includes("json")) {
    systemPrompt += "\n\nCRITICAL: Respond with a valid JSON object.";
  }

  if (systemPrompt.trim()) {
    fullMessages.push({ role: "system", content: systemPrompt.trim() });
  }

  fullMessages.push(...options.messages);

  const requestBody: any = {
    model,
    messages: fullMessages,
    temperature: 0.1
  };

  if (options.requireJson) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "User-Agent": "invoicepro-360-edge"
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`OpenAI API returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`);
  }

  if (!response.ok || data.error) {
    const errMsg = data.error?.message || `OpenAI API request failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  const choice = data.choices?.[0];
  if (!choice || !choice.message?.content) {
    throw new Error("No output content received from OpenAI model");
  }

  return choice.message.content;
}

// -------------------------------------------------------------
// Anthropic REST implementation (Structured for immediate or future use)
// -------------------------------------------------------------
export async function callAnthropic(
  apiKey: string,
  model: string,
  options: {
    messages: Array<{ role: string; content: any }>;
    systemInstruction?: string;
    schemaPrompt?: string;
  }
): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  let systemPrompt = options.systemInstruction || "";
  if (options.schemaPrompt) {
    systemPrompt += `\n\nCRITICAL: You must return valid JSON matching the following schema. Wrap your JSON in <json> and </json> tags:\n${options.schemaPrompt}`;
  }

  const requestBody: any = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: options.messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }))
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Anthropic API returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`);
  }

  if (!response.ok || data.error) {
    const errMsg = data.error?.message || `Anthropic API request failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  const block = data.content?.[0];
  if (!block || !block.text) {
    throw new Error("No text block returned from Anthropic model");
  }

  let text = block.text;
  const match = text.match(/<json>([\s\S]*?)<\/json>/);
  if (match) {
    text = match[1];
  }

  return cleanJsonOutput(text);
}

// -------------------------------------------------------------
// Unified High-Level Operations across all providers
// -------------------------------------------------------------

export interface GenerateInvoiceFromTextParams {
  prompt: string;
  provider?: string;
  model?: string;
  env?: EnvBindings;
  systemInstruction?: string;
  responseSchema?: any;
}

export async function generateInvoiceFromText(params: GenerateInvoiceFromTextParams): Promise<any> {
  const provider = normalizeProvider(params.provider);
  const model = resolveModel(provider, params.model, false);
  const apiKey = resolveApiKey(params.env, provider);

  const systemInstruction = params.systemInstruction || `You are an expert invoice processing AI. Convert natural language requests into structured invoice details.
Parse supplier names, customer names, date, invoice numbers, items, quantities, prices, tax rates (GST rates), and notes.
Also accurately classify the expense category (e.g., 'Utilities', 'Software', 'Travel', 'Hardware', 'Marketing', 'Consulting', 'Office Supplies', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Meals & Entertainment', 'Healthcare', 'Professional Services', 'Other') and provide relevant auto-tags.
If specific fields are not mentioned, use logical defaults or leave them empty (e.g. if tax is mentioned as 18% GST, set taxRate as 18).
Standard GST rates are typically 0, 5, 12, 18, 28. Use those if not specified.
Return the structured invoice details exactly matching the schema.`;

  const schema = params.responseSchema || {
    type: "OBJECT",
    properties: {
      invoiceNumber: { type: "STRING", description: "Invoice number or identifier, generate one if missing (e.g., INV-2026-001)" },
      supplierName: { type: "STRING", description: "Name of the supplier or merchant" },
      supplierGstin: { type: "STRING", description: "15-character GSTIN of the supplier if present" },
      supplierAddress: { type: "STRING", description: "Supplier's address if present" },
      customerName: { type: "STRING", description: "Name of the customer or buyer" },
      customerGstin: { type: "STRING", description: "15-character GSTIN of the customer if present" },
      customerAddress: { type: "STRING", description: "Customer's address if present" },
      date: { type: "STRING", description: "Invoice date in YYYY-MM-DD format. Default to today if not provided." },
      expenseCategory: { type: "STRING", description: "Expense category" },
      tags: { type: "ARRAY", items: { type: "STRING" } },
      items: {
        type: "ARRAY",
        description: "List of items or services in the invoice",
        items: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Item description" },
            quantity: { type: "NUMBER", description: "Quantity of the item (default to 1)" },
            price: { type: "NUMBER", description: "Unit price of the item" },
            taxRate: { type: "NUMBER", description: "GST rate percentage (e.g., 18 for 18% GST, default to 18 if not specified)" },
            hsn: { type: "STRING", description: "4-to-8 digit HSN code if relevant" }
          },
          required: ["description", "quantity", "price", "taxRate"]
        }
      },
      notes: { type: "STRING", description: "Any extra notes, payment instructions, or terms mentioned" }
    },
    required: ["supplierName", "customerName", "items"]
  };

  let rawJson: string;

  if (provider === "gemini") {
    rawJson = await callGemini(apiKey, model, {
      contents: [{ parts: [{ text: params.prompt }] }],
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: schema
    });
  } else if (provider === "openai") {
    rawJson = await callOpenAI(apiKey, model, {
      messages: [{ role: "user", content: params.prompt }],
      systemInstruction,
      requireJson: true,
      schemaPrompt: JSON.stringify(schema, null, 2)
    });
  } else {
    rawJson = await callAnthropic(apiKey, model, {
      messages: [{ role: "user", content: params.prompt }],
      systemInstruction,
      schemaPrompt: JSON.stringify(schema, null, 2)
    });
  }

  const cleaned = cleanJsonOutput(rawJson);
  return JSON.parse(cleaned);
}

export interface ExtractInvoiceFromOcrParams {
  fileBase64: string;
  mimeType: string;
  provider?: string;
  model?: string;
  env?: EnvBindings;
  responseSchema?: any;
}

export async function extractInvoiceFromOcr(params: ExtractInvoiceFromOcrParams): Promise<any> {
  const provider = normalizeProvider(params.provider);
  const model = resolveModel(provider, params.model, true);
  const apiKey = resolveApiKey(params.env, provider);

  const promptText = `Analyze this invoice scan/image/photo and extract all relevant details into structured JSON format.
Be highly accurate in reading the numeric values, dates, supplier and customer details, items, HSN codes, and GST rates.
Also accurately categorize the invoice into an expenseCategory (e.g., 'Utilities', 'Software', 'Travel', 'Hardware', 'Marketing', 'Consulting', 'Office Supplies', 'Logistics', 'Raw Materials', 'Maintenance', 'Rent', 'Professional Services', 'Other') and generate descriptive tags.
If any field is unreadable, leave it empty or make a best guess based on context.
Return the structured invoice details exactly matching the schema.`;

  const schema = params.responseSchema || {
    type: "OBJECT",
    properties: {
      invoiceNumber: { type: "STRING", description: "Invoice number or identifier found on the page" },
      supplierName: { type: "STRING", description: "Legal or brand name of the supplier" },
      supplierGstin: { type: "STRING", description: "15-character GSTIN of the supplier" },
      supplierAddress: { type: "STRING", description: "Supplier's address" },
      customerName: { type: "STRING", description: "Name of the customer or buyer" },
      customerGstin: { type: "STRING", description: "15-character GSTIN of the customer" },
      customerAddress: { type: "STRING", description: "Customer's address" },
      date: { type: "STRING", description: "Invoice date in YYYY-MM-DD format" },
      expenseCategory: { type: "STRING", description: "Expense category" },
      tags: { type: "ARRAY", items: { type: "STRING" } },
      items: {
        type: "ARRAY",
        description: "Items or services in the table",
        items: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Item name or description" },
            quantity: { type: "NUMBER", description: "Quantity" },
            price: { type: "NUMBER", description: "Unit price before tax" },
            taxRate: { type: "NUMBER", description: "GST rate percentage (e.g. 18, 5, 12, 28, 0)" },
            hsn: { type: "STRING", description: "HSN code if listed" }
          },
          required: ["description", "quantity", "price", "taxRate"]
        }
      },
      notes: { type: "STRING", description: "Any other details, notes, terms, bank details found" }
    },
    required: ["supplierName", "customerName", "items"]
  };

  let rawJson: string;

  if (provider === "gemini") {
    const imagePart = {
      inlineData: {
        mimeType: params.mimeType,
        data: params.fileBase64
      }
    };
    const textPart = { text: promptText };

    rawJson = await callGemini(apiKey, model, {
      contents: [{ parts: [imagePart, textPart] }],
      responseMimeType: "application/json",
      responseSchema: schema
    });
  } else if (provider === "openai") {
    // OpenAI Vision format
    const imageUrl = `data:${params.mimeType};base64,${params.fileBase64}`;
    rawJson = await callOpenAI(apiKey, model, {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      systemInstruction: "You are a professional invoice OCR data extraction engine.",
      requireJson: true,
      schemaPrompt: JSON.stringify(schema, null, 2)
    });
  } else {
    // Anthropic Claude vision format
    rawJson = await callAnthropic(apiKey, model, {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: params.mimeType,
                data: params.fileBase64
              }
            },
            { type: "text", text: promptText }
          ]
        }
      ],
      systemInstruction: "You are a professional invoice OCR data extraction engine.",
      schemaPrompt: JSON.stringify(schema, null, 2)
    });
  }

  const cleaned = cleanJsonOutput(rawJson);
  return JSON.parse(cleaned);
}

export interface ChatWithInvoicesParams {
  messages: Array<{ sender?: string; role?: string; text: string }>;
  invoices: any[];
  provider?: string;
  model?: string;
  env?: EnvBindings;
}

export async function chatWithInvoices(params: ChatWithInvoicesParams): Promise<any> {
  const provider = normalizeProvider(params.provider);
  const model = resolveModel(provider, params.model, false);
  const apiKey = resolveApiKey(params.env, provider);

  const compactInvoices = (params.invoices || []).map((inv: any) => ({
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
    itemsSummary: (inv.items || [])
      .map((item: any) => `${item.description} (Qty: ${item.quantity}, Price: ${item.price}, Tax: ${item.taxRate}%)`)
      .join(", ")
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

  const responseSchema = {
    type: "OBJECT",
    properties: {
      text: { type: "STRING", description: "The response markdown text to show the user" },
      suggestedAction: {
        type: "OBJECT",
        description: "Optional action for the UI to execute",
        properties: {
          type: { type: "STRING", description: "Must be 'highlight_invoice', 'filter', or 'none'" },
          invoiceId: { type: "STRING", description: "ID of the invoice if highlighting a single invoice" },
          filterQuery: { type: "STRING", description: "Filter search query to filter the invoices list in the UI" }
        },
        required: ["type"]
      }
    },
    required: ["text"]
  };

  const userMessages = params.messages || [];
  const lastMsg = userMessages[userMessages.length - 1];
  const userPrompt = lastMsg?.text || "Hello";

  let rawJson: string;

  if (provider === "gemini") {
    const chatHistory = userMessages.slice(0, -1).map((msg: any) => ({
      role: msg.sender === "user" || msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    }));

    const contents = [
      ...chatHistory,
      { role: "user", parts: [{ text: userPrompt }] }
    ];

    rawJson = await callGemini(apiKey, model, {
      contents,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    });
  } else if (provider === "openai") {
    const formattedMessages = userMessages.map((msg: any) => ({
      role: msg.sender === "user" || msg.role === "user" ? "user" : "assistant",
      content: msg.text
    }));

    rawJson = await callOpenAI(apiKey, model, {
      messages: formattedMessages,
      systemInstruction,
      requireJson: true,
      schemaPrompt: JSON.stringify(responseSchema, null, 2)
    });
  } else {
    const formattedMessages = userMessages.map((msg: any) => ({
      role: msg.sender === "user" || msg.role === "user" ? "user" : "assistant",
      content: msg.text
    }));

    rawJson = await callAnthropic(apiKey, model, {
      messages: formattedMessages,
      systemInstruction,
      schemaPrompt: JSON.stringify(responseSchema, null, 2)
    });
  }

  const cleaned = cleanJsonOutput(rawJson);
  return JSON.parse(cleaned);
}
