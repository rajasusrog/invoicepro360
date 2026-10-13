import { Invoice, InvoiceItem } from "../types";
import { safeFetchJson } from "./apiUtils";
import { classifyInvoice } from "./taggingEngine";

export interface AICategorizationResult {
  expenseCategory: string;
  tags: string[];
  confidence: number;
  reasoning: string;
}

/**
 * Calls Gemini AI to classify an invoice based on its line item descriptions.
 * Falls back to offline heuristic analysis if server or API key is unavailable.
 */
export async function categorizeInvoiceWithGemini(
  invoice: Invoice
): Promise<AICategorizationResult> {
  const lineItems = (invoice.items || []).map(i => ({
    description: i.description,
    quantity: i.quantity,
    price: i.price,
    hsn: i.hsn
  }));

  try {
    const res = await safeFetchJson<AICategorizationResult>("/api/invoice/categorize-from-line-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineItems,
        supplierName: invoice.supplierName,
        notes: invoice.notes
      })
    });

    if (res && res.expenseCategory) {
      return {
        expenseCategory: res.expenseCategory,
        tags: Array.isArray(res.tags) ? res.tags : [`#${res.expenseCategory}`],
        confidence: typeof res.confidence === "number" ? res.confidence : 0.9,
        reasoning: res.reasoning || `Assigned ${res.expenseCategory} based on line item analysis`
      };
    }
  } catch (err) {
    console.warn("Gemini line-item categorization API failed or unavailable, using fallback:", err);
  }

  // Graceful local heuristic fallback
  const local = classifyInvoice(invoice);
  return {
    expenseCategory: local.category,
    tags: local.suggestedTags,
    confidence: local.confidence / 100,
    reasoning: local.reason
  };
}

/**
 * Batch categorizes a list of invoices using Gemini AI in the background.
 */
export async function batchCategorizeInvoicesWithGemini(
  invoices: Invoice[]
): Promise<Map<string, AICategorizationResult>> {
  const resultMap = new Map<string, AICategorizationResult>();
  if (!invoices || invoices.length === 0) return resultMap;

  try {
    const payload = invoices.map(inv => ({
      id: inv.id,
      supplierName: inv.supplierName,
      items: (inv.items || []).map(item => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price
      }))
    }));

    const response = await safeFetchJson<{ results: Array<{ id: string; expenseCategory: string; tags: string[]; confidence: number; reasoning: string }> }>(
      "/api/invoice/batch-categorize-from-line-items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoices: payload })
      }
    );

    if (response?.results && Array.isArray(response.results)) {
      for (const res of response.results) {
        resultMap.set(res.id, {
          expenseCategory: res.expenseCategory,
          tags: res.tags || [`#${res.expenseCategory}`],
          confidence: res.confidence || 0.85,
          reasoning: res.reasoning || ""
        });
      }
      return resultMap;
    }
  } catch (err) {
    console.warn("Batch Gemini categorization endpoint failed, falling back to sequential:", err);
  }

  // Fallback sequential execution
  for (const inv of invoices) {
    const res = await categorizeInvoiceWithGemini(inv);
    resultMap.set(inv.id, res);
  }

  return resultMap;
}

/**
 * Background function that automatically assigns categories (e.g. 'Office Supplies', 'Marketing', 'Hardware')
 * to invoices based on line item descriptions using Gemini AI.
 * 
 * Runs asynchronously without blocking the user interface.
 */
export async function runBackgroundAutoCategorization(
  invoices: Invoice[],
  onUpdateInvoice: (updatedInvoice: Invoice) => Promise<void> | void,
  options?: {
    forceAll?: boolean;
    onProgress?: (processed: number, total: number, lastInvoice?: Invoice) => void;
  }
): Promise<{ updatedCount: number; results: Invoice[] }> {
  // Filter invoices that need categorization: uncategorized, 'Other', or all if forceAll is true
  const candidates = invoices.filter(inv => {
    if (options?.forceAll) return true;
    const cat = inv.expenseCategory?.trim();
    return !cat || cat.toLowerCase() === "other" || cat === "Sales";
  });

  if (candidates.length === 0) {
    return { updatedCount: 0, results: [] };
  }

  const updatedInvoices: Invoice[] = [];
  const chunkSize = 6;

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const classifications = await batchCategorizeInvoicesWithGemini(chunk);

    for (const inv of chunk) {
      const classification = classifications.get(inv.id);
      if (classification && classification.expenseCategory) {
        // Merge tags
        const existingTags = inv.tags || [];
        const newTags = Array.from(new Set([...existingTags, ...classification.tags]));

        const updated: Invoice = {
          ...inv,
          expenseCategory: classification.expenseCategory,
          tags: newTags,
          category: inv.category === "Sales" ? "Expense" : (inv.category || "Expense")
        };

        try {
          await onUpdateInvoice(updated);
        } catch (err) {
          console.error(`Failed to update invoice ${inv.id} in background categorization:`, err);
        }

        updatedInvoices.push(updated);
        if (options?.onProgress) {
          options.onProgress(updatedInvoices.length, candidates.length, updated);
        }
      }
    }
  }

  return {
    updatedCount: updatedInvoices.length,
    results: updatedInvoices
  };
}
