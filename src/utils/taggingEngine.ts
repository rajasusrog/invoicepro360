import { Invoice, InvoiceItem } from "../types";

export type CoreExpenseCategory = "Utilities" | "Software" | "Services" | "Equipment";

export interface CategoryMetadata {
  id: CoreExpenseCategory;
  label: string;
  description: string;
  colorClass: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  iconName: string;
  commonHsns: string[];
  defaultTags: string[];
}

export const CATEGORY_DEFINITIONS: Record<CoreExpenseCategory, CategoryMetadata> = {
  Utilities: {
    id: "Utilities",
    label: "Utilities",
    description: "Electricity, internet, telecom, water, fuel, and municipal recurring facility costs.",
    colorClass: "amber",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/30",
    badgeText: "text-amber-400",
    iconName: "Zap",
    commonHsns: ["9987", "2716", "2711", "9984"],
    defaultTags: ["#Utilities", "#MonthlyRecurring", "#FacilityCost", "#OfficeInfra"]
  },
  Software: {
    id: "Software",
    label: "Software",
    description: "Cloud hosting, SaaS subscriptions, developer tooling, licenses, and digital platforms.",
    colorClass: "indigo",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/30",
    badgeText: "text-indigo-400",
    iconName: "Terminal",
    commonHsns: ["998313", "998314", "998315", "998319", "9983"],
    defaultTags: ["#Software", "#SaaS", "#CloudHosting", "#DigitalTools", "#DevOps"]
  },
  Services: {
    id: "Services",
    label: "Services",
    description: "Legal, auditing, consulting, agency retainers, facility maintenance, and professional fees.",
    colorClass: "emerald",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-400",
    iconName: "Briefcase",
    commonHsns: ["9982", "9983", "9985", "9986", "9997", "9964"],
    defaultTags: ["#Services", "#ProfessionalFees", "#Consulting", "#VendorRetainer"]
  },
  Equipment: {
    id: "Equipment",
    label: "Equipment",
    description: "Hardware, laptops, servers, machinery, monitors, furniture, and capital assets.",
    colorClass: "purple",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/30",
    badgeText: "text-purple-400",
    iconName: "Cpu",
    commonHsns: ["8471", "8443", "8517", "9403", "8415", "8473", "8528"],
    defaultTags: ["#Equipment", "#Hardware", "#CapitalAsset", "#Depreciation", "#OfficeAsset"]
  }
};

// Keyword scoring model for Vendor Data and Line Item text
interface CategoryKeywords {
  vendors: string[];
  items: string[];
  hsns: string[];
}

const CATEGORY_RULES: Record<CoreExpenseCategory, CategoryKeywords> = {
  Utilities: {
    vendors: [
      "tata power", "adani electricity", "bescom", "mahanagar gas", "airtel", "jio", "vodafone",
      "bsnl", "act fibernet", "spectranet", "tata tele", "water board", "municipal", "electric",
      "power corp", "energy", "petro", "fuel", "gas authority", "utility", "broadband", "telecom"
    ],
    items: [
      "electricity", "power", "broadband", "internet", "leased line", "water supply", "gas",
      "lpg", "utility", "kwh", "units consumed", "meter reading", "telecom", "mobile postpaid",
      "fiber net", "pipeline", "sewage charge", "diesel for generator", "backup power", "utility bill"
    ],
    hsns: ["9987", "2716", "2711", "9984"]
  },
  Software: {
    vendors: [
      "aws", "amazon web services", "google cloud", "microsoft", "azure", "github", "atlassian",
      "slack", "zoom", "notion", "figma", "adobe", "zoho", "salesforce", "stripe", "twilio",
      "openai", "anthropic", "vercel", "digitalocean", "cloudflare", "intuit", "tally", "sendgrid",
      "hubspot", "datadog", "sentry", "supabase", "mongodb", "jetbrains", "postman", "docker"
    ],
    items: [
      "saas", "subscription", "cloud hosting", "server instance", "api credits", "database hosting",
      "developer license", "seat license", "software", "domain renewal", "ssl certificate", "crm",
      "ide license", "cloud storage", "compute", "tokens", "app license", "monthly tier", "enterprise plan"
    ],
    hsns: ["998313", "998314", "998315", "998319", "9983"]
  },
  Services: {
    vendors: [
      "consulting", "advisory", "associates", "law firm", "legal", "audit", "pwc", "ey", "kpmg",
      "deloitte", "marketing agency", "design studio", "hr solutions", "security services",
      "housekeeping", "facility management", "logistics", "courier", "blue dart", "fedex",
      "chartered accountants", "ca firm", "advocate", "consultants", "staffing"
    ],
    items: [
      "consulting", "legal fee", "statutory audit", "tax advisory", "marketing retainer",
      "seo optimization", "graphic design", "recruitment fee", "maintenance contract", "amc",
      "security guard", "housekeeping service", "professional fees", "accounting service",
      "freelance service", "retainer", "logistics charge", "courier service", "freight"
    ],
    hsns: ["9982", "9985", "9986", "9997", "9964"]
  },
  Equipment: {
    vendors: [
      "dell", "hp", "apple", "lenovo", "cisco", "canon", "epson", "godrej interio", "ikea",
      "siemens", "schneider", "caterpillar", "hardware", "machinery", "electronics", "compucom",
      "redington", "ingram micro", "samsung", "lg", "sony", "logitech", "tp-link"
    ],
    items: [
      "laptop", "desktop pc", "macbook", "monitor", "server rack", "office chair", "standing desk",
      "ergonomic chair", "cisco router", "network switch", "printer", "toner cartridge", "scanner",
      "air conditioner", "ac unit", "generator", "machinery", "tools", "workstation", "projector",
      "camera gear", "headset", "docking station", "hard drive", "ssd", "ram module", "cabinet"
    ],
    hsns: ["8471", "8443", "8517", "9403", "8415", "8473", "8528", "84", "85", "90"]
  }
};

export interface InvoiceClassification {
  category: CoreExpenseCategory;
  confidence: number; // 0 to 100
  matchedSignals: {
    vendorMatches: string[];
    itemMatches: string[];
    hsnMatches: string[];
  };
  reason: string;
  suggestedTags: string[];
}

/**
 * Categorizes an invoice into 'Utilities', 'Software', 'Services', or 'Equipment'
 * based on multi-signal analysis of vendor data and item details.
 */
export function classifyInvoice(invoice: Invoice): InvoiceClassification {
  const vendorText = `${invoice.supplierName || ""} ${invoice.supplierAddress || ""} ${invoice.notes || ""}`.toLowerCase();
  
  const itemsText = (invoice.items || [])
    .map(i => `${i.description || ""} ${i.hsn || ""}`)
    .join(" ")
    .toLowerCase();

  const allHsns = (invoice.items || []).map(i => (i.hsn || "").trim());

  const scores: Record<CoreExpenseCategory, {
    score: number;
    vendorMatches: string[];
    itemMatches: string[];
    hsnMatches: string[];
  }> = {
    Utilities: { score: 0, vendorMatches: [], itemMatches: [], hsnMatches: [] },
    Software: { score: 0, vendorMatches: [], itemMatches: [], hsnMatches: [] },
    Services: { score: 0, vendorMatches: [], itemMatches: [], hsnMatches: [] },
    Equipment: { score: 0, vendorMatches: [], itemMatches: [], hsnMatches: [] }
  };

  const categories: CoreExpenseCategory[] = ["Utilities", "Software", "Services", "Equipment"];

  for (const cat of categories) {
    const rules = CATEGORY_RULES[cat];

    // 1. Vendor Match (Weight: 45 points per keyword)
    for (const vKey of rules.vendors) {
      if (vendorText.includes(vKey)) {
        scores[cat].score += 45;
        if (!scores[cat].vendorMatches.includes(vKey)) {
          scores[cat].vendorMatches.push(vKey);
        }
      }
    }

    // 2. Line Item & Description Match (Weight: 30 points per keyword)
    for (const iKey of rules.items) {
      if (itemsText.includes(iKey)) {
        scores[cat].score += 30;
        if (!scores[cat].itemMatches.includes(iKey)) {
          scores[cat].itemMatches.push(iKey);
        }
      }
    }

    // 3. HSN / SAC Code Match (Weight: 35 points per matching HSN prefix)
    for (const hsn of allHsns) {
      if (!hsn) continue;
      for (const ruleHsn of rules.hsns) {
        if (hsn.startsWith(ruleHsn)) {
          scores[cat].score += 35;
          if (!scores[cat].hsnMatches.includes(hsn)) {
            scores[cat].hsnMatches.push(hsn);
          }
        }
      }
    }

    // Existing category tag bonus
    if (invoice.expenseCategory === cat) {
      scores[cat].score += 25;
    }
  }

  // Find top category
  let bestCategory: CoreExpenseCategory = "Services";
  let highestScore = -1;

  for (const cat of categories) {
    if (scores[cat].score > highestScore) {
      highestScore = scores[cat].score;
      bestCategory = cat;
    }
  }

  // Default fallback if no signals matched
  if (highestScore <= 0) {
    // Check if supplier or items resemble software / hardware / utility / service
    if (invoice.expenseCategory && categories.includes(invoice.expenseCategory as any)) {
      bestCategory = invoice.expenseCategory as CoreExpenseCategory;
      highestScore = 40;
    } else {
      bestCategory = "Services"; // Standard professional business services default
      highestScore = 20;
    }
  }

  const result = scores[bestCategory];
  const confidence = Math.min(99, Math.max(40, Math.round((highestScore / 110) * 100)));

  // Generate matched reason text
  const reasonParts: string[] = [];
  if (result.vendorMatches.length > 0) {
    reasonParts.push(`Vendor match: "${result.vendorMatches.slice(0, 2).join('", "')}"`);
  }
  if (result.itemMatches.length > 0) {
    reasonParts.push(`Line items: "${result.itemMatches.slice(0, 2).join('", "')}"`);
  }
  if (result.hsnMatches.length > 0) {
    reasonParts.push(`HSN codes: ${result.hsnMatches.slice(0, 2).join(", ")}`);
  }
  const reason = reasonParts.length > 0 
    ? reasonParts.join(" • ") 
    : `Classified as ${bestCategory} based on general billing profile`;

  // Merge default tags with existing tags
  const def = CATEGORY_DEFINITIONS[bestCategory];
  const suggestedTags = Array.from(new Set([
    `#${bestCategory}`,
    ...def.defaultTags,
    ...(invoice.tags || [])
  ]));

  return {
    category: bestCategory,
    confidence,
    matchedSignals: {
      vendorMatches: result.vendorMatches,
      itemMatches: result.itemMatches,
      hsnMatches: result.hsnMatches
    },
    reason,
    suggestedTags
  };
}

export interface BatchAutoTagResult {
  classifiedInvoices: {
    invoiceId: string;
    originalCategory?: string;
    newCategory: CoreExpenseCategory;
    confidence: number;
    tags: string[];
    reason: string;
    updatedInvoice: Invoice;
  }[];
  countsByCategory: Record<CoreExpenseCategory, number>;
  totalProcessed: number;
}

/**
 * Runs the automated tagging engine across an array of invoices
 */
export function batchClassifyInvoices(invoices: Invoice[]): BatchAutoTagResult {
  const countsByCategory: Record<CoreExpenseCategory, number> = {
    Utilities: 0,
    Software: 0,
    Services: 0,
    Equipment: 0
  };

  const classifiedInvoices = invoices.map(invoice => {
    const classification = classifyInvoice(invoice);
    countsByCategory[classification.category] += 1;

    const updatedInvoice: Invoice = {
      ...invoice,
      category: invoice.category === "Sales" ? "Expense" : (invoice.category || "Expense"),
      expenseCategory: classification.category,
      tags: classification.suggestedTags
    };

    return {
      invoiceId: invoice.id,
      originalCategory: invoice.expenseCategory || invoice.category,
      newCategory: classification.category,
      confidence: classification.confidence,
      tags: classification.suggestedTags,
      reason: classification.reason,
      updatedInvoice
    };
  });

  return {
    classifiedInvoices,
    countsByCategory,
    totalProcessed: invoices.length
  };
}
