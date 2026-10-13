import { Invoice, InvoiceItem, InvoiceValidation, InvoiceTemplate } from "../types";

// Generate a random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Format currency in Indian Rupees
export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Calculate total taxes and sums for an invoice
export function calculateInvoiceTotals(items: Omit<InvoiceItem, 'id' | 'total'>[], supplierGstin?: string, customerGstin?: string): {
  items: InvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let totalTax = 0;

  const processedItems = items.map(item => {
    const itemTotal = item.quantity * item.price;
    subtotal += itemTotal;
    const itemTax = itemTotal * (item.taxRate / 100);
    totalTax += itemTax;

    return {
      ...item,
      id: (item as any).id || generateId(),
      total: itemTotal
    };
  });

  // Determine state tax rules based on GSTIN (first 2 digits represent state code)
  let isInterstate = false;
  if (supplierGstin && customerGstin && supplierGstin.length >= 2 && customerGstin.length >= 2) {
    const supplierState = supplierGstin.substring(0, 2);
    const customerState = customerGstin.substring(0, 2);
    isInterstate = supplierState !== customerState;
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate) {
    igst = totalTax;
  } else {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  }

  return {
    items: processedItems,
    subtotal,
    cgst,
    sgst,
    igst,
    taxAmount: totalTax,
    totalAmount: subtotal + totalTax
  };
}

// Check if a string is a valid Indian GSTIN (15-character alphanumeric format)
export function isValidGstin(gstin?: string): boolean {
  if (!gstin) return false;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
}

// Run deterministic and AI audit validation on an invoice
export function validateInvoice(invoice: Invoice, allInvoices: Invoice[]): InvoiceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checks: InvoiceValidation["checks"] = {
    gstin: { passed: true, message: "Valid GSTIN format" },
    math: { passed: true, message: "Calculations are accurate" },
    taxPercent: { passed: true, message: "Standard GST rates are applied" },
    duplicates: { passed: true, message: "No duplicates found" },
    missingFields: { passed: true, message: "All required fields are present" },
    stateTax: { passed: true, message: "Correct tax classification (CGST/SGST vs IGST)" }
  };

  // 1. Missing Fields Check
  const missing: string[] = [];
  if (!invoice.invoiceNumber) missing.push("Invoice Number");
  if (!invoice.supplierName) missing.push("Supplier Name");
  if (!invoice.customerName) missing.push("Customer Name");
  if (!invoice.date) missing.push("Invoice Date");
  if (!invoice.items || invoice.items.length === 0) missing.push("Line Items");

  if (missing.length > 0) {
    checks.missingFields = {
      passed: false,
      message: `Missing fields: ${missing.join(", ")}`
    };
    errors.push(`Required information missing: ${missing.join(", ")}`);
  }

  // 2. GSTIN Format Check
  const isSupplierGstValid = !invoice.supplierGstin || isValidGstin(invoice.supplierGstin);
  const isCustomerGstValid = !invoice.customerGstin || isValidGstin(invoice.customerGstin);

  if (!isSupplierGstValid || !isCustomerGstValid) {
    const badFields = [];
    if (!isSupplierGstValid) badFields.push("Supplier GSTIN");
    if (!isCustomerGstValid) badFields.push("Customer GSTIN");

    checks.gstin = {
      passed: false,
      message: `Invalid format for ${badFields.join(", ")}`,
      details: "GSTIN must be a 15-character alphanumeric string matching Indian GST format (e.g., 27AAPCS1030F1Z4)."
    };
    warnings.push(`Formatting error: ${badFields.join(", ")} does not match standard 15-character GSTIN pattern.`);
  }

  // 3. Math Accuracy Check
  let calculatedSubtotal = 0;
  let calculatedTaxAmount = 0;

  invoice.items.forEach(item => {
    calculatedSubtotal += item.quantity * item.price;
    calculatedTaxAmount += (item.quantity * item.price) * (item.taxRate / 100);
  });

  const calculatedTotal = calculatedSubtotal + calculatedTaxAmount;
  const mathMargin = 1.0; // Allow slight rounding discrepancies under 1 rupee

  const isSubtotalOff = Math.abs(invoice.subtotal - calculatedSubtotal) > mathMargin;
  const isTaxOff = Math.abs(invoice.taxAmount - calculatedTaxAmount) > mathMargin;
  const isTotalOff = Math.abs(invoice.totalAmount - calculatedTotal) > mathMargin;

  if (isSubtotalOff || isTaxOff || isTotalOff) {
    checks.math = {
      passed: false,
      message: "Mathematical discrepancy in totals",
      details: `Expected subtotal: ${formatRupees(calculatedSubtotal)}, expected tax: ${formatRupees(calculatedTaxAmount)}, expected total: ${formatRupees(calculatedTotal)}.`
    };
    errors.push(`Math Error: Stated invoice total (${formatRupees(invoice.totalAmount)}) does not match recalculated sum (${formatRupees(calculatedTotal)}).`);
  }

  // 4. Tax Percent Validation
  const standardRates = [0, 5, 12, 18, 28];
  const hasCustomRates = invoice.items.some(item => !standardRates.includes(item.taxRate));

  if (hasCustomRates) {
    checks.taxPercent = {
      passed: false,
      message: "Non-standard GST rate detected",
      details: "In India, typical GST brackets are 0%, 5%, 12%, 18%, or 28%. Custom rates should be verified."
    };
    warnings.push("Tax warning: Non-standard tax rate found. Please verify if this falls under specialized brackets.");
  }

  // 5. State Tax Classification Check
  if (invoice.supplierGstin && invoice.customerGstin && isSupplierGstValid && isCustomerGstValid) {
    const supplierState = invoice.supplierGstin.trim().substring(0, 2);
    const customerState = invoice.customerGstin.trim().substring(0, 2);
    const isInterstate = supplierState !== customerState;

    if (isInterstate && (invoice.cgst > 0 || invoice.sgst > 0)) {
      checks.stateTax = {
        passed: false,
        message: "Wrong tax type charged for inter-state transaction",
        details: `Inter-state (State ${supplierState} to State ${customerState}) should incur IGST instead of CGST/SGST.`
      };
      errors.push(`Tax Classification Audit: Inter-state invoice uses CGST/SGST. Must be revised to IGST.`);
    } else if (!isInterstate && invoice.igst > 0) {
      checks.stateTax = {
        passed: false,
        message: "Wrong tax type charged for intra-state transaction",
        details: `Intra-state (Same state ${supplierState}) should incur CGST/SGST instead of IGST.`
      };
      errors.push(`Tax Classification Audit: Intra-state invoice uses IGST. Must be revised to equal CGST and SGST.`);
    }
  }

  // 6. Duplicate Detection
  const duplicate = allInvoices.find(inv => 
    inv.id !== invoice.id &&
    inv.invoiceNumber.trim().toLowerCase() === invoice.invoiceNumber.trim().toLowerCase() &&
    inv.supplierName.trim().toLowerCase() === invoice.supplierName.trim().toLowerCase()
  );

  if (duplicate) {
    checks.duplicates = {
      passed: false,
      message: "Duplicate invoice detected",
      details: `Invoice number ${invoice.invoiceNumber} from ${invoice.supplierName} already exists in the system.`
    };
    warnings.push(`Duplicate Alert: Invoice ${invoice.invoiceNumber} from ${invoice.supplierName} has been recorded previously.`);
  }

  const passed = errors.length === 0;

  return {
    passed,
    checks,
    warnings,
    errors
  };
}

// Convert invoice list to Standard CSV format (Compatible with external accounting software: Tally, Zoho, QuickBooks, Excel)
export function convertToStandardCSV(invoices: Invoice[]): string {
  const headers = [
    "Invoice Number",
    "Invoice Date",
    "Due Date",
    "Supplier Name",
    "Supplier GSTIN",
    "Supplier Address",
    "Customer Name",
    "Customer GSTIN",
    "Customer Address",
    "Category",
    "Expense Category",
    "Tags",
    "Subtotal (Taxable)",
    "CGST",
    "SGST",
    "IGST",
    "Total Tax",
    "Total Invoice Value",
    "Status",
    "Payment Status",
    "Amount Paid",
    "Balance Due",
    "Notes",
    "OCR Source"
  ];

  const rows = invoices.map(inv => [
    `"${inv.invoiceNumber}"`,
    inv.date || "",
    inv.dueDate || "",
    `"${(inv.supplierName || '').replace(/"/g, '""')}"`,
    `"${inv.supplierGstin || ''}"`,
    `"${(inv.supplierAddress || '').replace(/"/g, '""')}"`,
    `"${(inv.customerName || '').replace(/"/g, '""')}"`,
    `"${inv.customerGstin || ''}"`,
    `"${(inv.customerAddress || '').replace(/"/g, '""')}"`,
    inv.category || "Sales",
    inv.expenseCategory || "Other",
    `"${(inv.tags || []).join(', ')}"`,
    inv.subtotal || 0,
    inv.cgst || 0,
    inv.sgst || 0,
    inv.igst || 0,
    inv.taxAmount || 0,
    inv.totalAmount || 0,
    inv.status || "unpaid",
    inv.paymentStatus || "due",
    inv.amountPaid || 0,
    inv.balanceDue || (inv.status === 'paid' ? 0 : inv.totalAmount),
    `"${(inv.notes || '').replace(/"/g, '""')}"`,
    `"${inv.ocrSource || ''}"`
  ]);

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

// Convert invoice list to GST Ready format (GSTR-1 B2B-style layout)
export function convertToGstReadyCSV(invoices: Invoice[]): string {
  const headers = [
    "Receiver GSTIN/UIN",
    "Receiver Name",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value (Total)",
    "Place Of Supply (State Code)",
    "Reverse Charge (Y/N)",
    "Applicable % of Tax Rate",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Taxable Value (Subtotal)",
    "Integrated Tax (IGST)",
    "Central Tax (CGST)",
    "State/UT Tax (SGST)"
  ];

  const rows: any[] = [];

  invoices.forEach(inv => {
    const placeOfSupply = inv.customerGstin ? inv.customerGstin.substring(0, 2) : "";
    const isReverse = "N";
    const invoiceType = "Regular";

    // Split items by tax rates if multi-rate to match GSTR-1 format properly,
    // or group them. For simplicity in a single-row CSV export:
    rows.push([
      `"${inv.customerGstin || 'URP'}"`, // URP = Unregistered Person
      `"${inv.customerName}"`,
      `"${inv.invoiceNumber}"`,
      inv.date,
      inv.totalAmount,
      `"${placeOfSupply}"`,
      `"${isReverse}"`,
      "", // Multi-rate summary
      `"${invoiceType}"`,
      "",
      inv.subtotal,
      inv.igst,
      inv.cgst,
      inv.sgst
    ]);
  });

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

// Download a text file in the browser
export function triggerFileDownload(filename: string, content: string, mimeType = "text/csv") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Calculate payment totals and derive payment status
export function calculatePaymentTotals(invoice: Invoice): Invoice {
  const payments = invoice.payments || [];
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, invoice.totalAmount - amountPaid);

  let status = invoice.status;
  let paymentStatus: 'paid' | 'partially_paid' | 'due' | 'overdue' = 'due';

  if (balanceDue <= 0.5) {
    status = 'paid';
    paymentStatus = 'paid';
  } else if (amountPaid > 0) {
    status = 'partially_paid';
    paymentStatus = 'partially_paid';
  } else if (invoice.status === 'overdue') {
    paymentStatus = 'overdue';
  } else {
    status = 'unpaid';
    paymentStatus = 'due';
  }

  return {
    ...invoice,
    status,
    paymentStatus,
    amountPaid,
    balanceDue,
    payments
  };
}

// Category colors and metadata for UI rendering
export const categoryStyleMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  'Utilities': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: '⚡' },
  'Software': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: '💻' },
  'Services': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: '💼' },
  'Equipment': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', icon: '🖥️' },
  'Travel': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', icon: '✈️' },
  'Hardware': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', icon: '⚙️' },
  'Marketing': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', icon: '📣' },
  'Consulting': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: '👔' },
  'Office Supplies': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: '📎' },
  'Logistics': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: '🚚' },
  'Raw Materials': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', icon: '🧱' },
  'Maintenance': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', icon: '🔧' },
  'Rent': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', icon: '🏢' },
  'Meals & Entertainment': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', icon: '🍽️' },
  'Healthcare': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', icon: '🏥' },
  'Professional Services': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', icon: '⚖️' },
  'Other': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', icon: '🏷️' }
};

export const defaultExpenseCategories = [
  'Utilities',
  'Software',
  'Services',
  'Equipment',
  'Travel',
  'Hardware',
  'Marketing',
  'Consulting',
  'Office Supplies',
  'Logistics',
  'Raw Materials',
  'Maintenance',
  'Rent',
  'Professional Services'
];

// Helper to prefill and suggest natural language creation templates
export const sampleCreationTemplates = [
  {
    title: "AWS Cloud & SaaS (Software)",
    prompt: "Create a software subscription invoice from Amazon Web Services (AWS) India Pvt Ltd (GSTIN: 27AABCA1234A1Z1). Customer: Unikorn360 AI Solutions (GSTIN: 27AABCU1234A1Z8). Items: AWS EC2 Cloud Compute Cluster (Qty: 1, Price: ₹42,000, 18% GST), Amazon Aurora PostgreSQL Database Hosting (Qty: 1, Price: ₹18,500, 18% GST). Category: Software."
  },
  {
    title: "Electricity & Telecom (Utilities)",
    prompt: "Generate an expense utility bill from Maharashtra State Electricity Distribution Co. (MSEDCL, GSTIN: 27AAACM2456K1Z9). Commercial 3-Phase Power consumption for July 2026 (Qty: 1, Price: ₹24,800, 18% GST), High-speed Fiber Internet Line (Qty: 1, Price: ₹3,200, 18% GST). Category: Utilities."
  },
  {
    title: "Business Flights & Hotel (Travel)",
    prompt: "Create an invoice for Corporate Travel from MakeMyTrip Business India (GSTIN: 07AABCM6789G1Z5). Client: Unikorn360 AI Solutions. Return Flights Mumbai to Bangalore (Qty: 2, Price: ₹14,500 each, 18% GST), 3 Nights Executive Hotel Suite Bangalore (Qty: 1, Price: ₹22,000, 12% GST). Category: Travel."
  },
  {
    title: "Steel Supplies (Raw Materials)",
    prompt: "Create an invoice for ABC Traders. Supplier GSTIN: 27AAPCS1030F1Z4. Customer: Tata Projects Ltd, GSTIN: 27AAACT2901G1Z2. Items: 15 Steel Rods at ₹600 each with 18% GST, and 10 Galvanized beams at ₹2200 each with 18% GST. Invoice Date is 2026-07-18."
  },
  {
    title: "Senior Tech Consulting",
    prompt: "Generate consulting invoice for Techflow LLP to Client: Reliance Industries, GSTIN 27AAACR1283D1Z9. 25 hours of Senior Dev Consulting at ₹4500 per hour, tax rate 18% GST. Date is today."
  },
  {
    title: "Office Electronics Purchase",
    prompt: "Generate an expense invoice DL-2026-991 from Delhi Retailers CP to John Doe Enterprises. 2 Projectors at ₹35,000 each with 28% GST. HSN is 8471. Add a note requesting payment within 15 days."
  }
];

// Default Recurring Vendor Templates
export const defaultVendorTemplates: InvoiceTemplate[] = [
  {
    id: "tmpl-aws-cloud",
    name: "AWS Cloud Infrastructure",
    description: "Monthly recurring cloud hosting & PostgreSQL database cluster invoice",
    vendorName: "Amazon Web Services (AWS) India Pvt Ltd",
    vendorGstin: "27AABCA1234A1Z1",
    vendorAddress: "Level 14, Tower B, Cyber City, Mumbai, MH 400051",
    category: "Expense",
    expenseCategory: "Software",
    tags: ["Software", "Cloud", "SaaS", "AWS", "Infrastructure"],
    recurringFrequency: "Monthly",
    defaultItems: [
      { description: "AWS EC2 High-Compute Node Cluster", quantity: 1, price: 42000, taxRate: 18, hsn: "998313" },
      { description: "Amazon Aurora Managed PostgreSQL Engine", quantity: 1, price: 18500, taxRate: 18, hsn: "998314" }
    ],
    notes: "Auto-charged via corporate debit card on the 1st of every calendar month.",
    createdAt: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "tmpl-electricity-msedcl",
    name: "Commercial Power & Telecom (MSEDCL)",
    description: "Monthly power grid consumption and dedicated leased fiber line",
    vendorName: "Maharashtra State Electricity Distribution Co. (MSEDCL)",
    vendorGstin: "27AAACM2456K1Z9",
    vendorAddress: "Prakashgad, Bandra East, Mumbai, Maharashtra, 400051",
    category: "Expense",
    expenseCategory: "Utilities",
    tags: ["Utilities", "Power", "Telecom", "Electric", "Recurring"],
    recurringFrequency: "Monthly",
    defaultItems: [
      { description: "Commercial 3-Phase Industrial Power Consumption", quantity: 1, price: 24800, taxRate: 18, hsn: "998711" },
      { description: "High-Speed Leased Optical Fiber Line (1Gbps)", quantity: 1, price: 3200, taxRate: 18, hsn: "998412" }
    ],
    notes: "Utility payment due within 10 days of meter reading.",
    createdAt: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "tmpl-corporate-travel-mmt",
    name: "MakeMyTrip Corporate Flights & Lodging",
    description: "Monthly flight bookings, executive airport cabs, and business hotel stays",
    vendorName: "MakeMyTrip India Pvt Ltd",
    vendorGstin: "07AABCM6789G1Z5",
    vendorAddress: "DLF Cyber City, Tower A, Gurugram, Haryana, 122002",
    category: "Expense",
    expenseCategory: "Travel",
    tags: ["Travel", "Flights", "Hotels", "Corporate Travel"],
    recurringFrequency: "Monthly",
    defaultItems: [
      { description: "Executive Business Flight Tickets (BOM-BLR Return)", quantity: 2, price: 14500, taxRate: 18, hsn: "9964" },
      { description: "3 Nights Corporate Hotel Accommodation", quantity: 1, price: 22000, taxRate: 12, hsn: "9963" }
    ],
    notes: "Corporate travel bookings billed under master travel SLA.",
    createdAt: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "tmpl-wework-rent",
    name: "WeWork Office Lease & Private Suite",
    description: "Monthly office space rental and conference credit package",
    vendorName: "WeWork India Management Pvt Ltd",
    vendorGstin: "27AAACW9912A1Z3",
    vendorAddress: "Level 9, Enkay Towers, Goregaon East, Mumbai, MH, 400063",
    category: "Expense",
    expenseCategory: "Rent",
    tags: ["Rent", "Office", "Workspace", "Facilities"],
    recurringFrequency: "Monthly",
    defaultItems: [
      { description: "Dedicated 20-Seat Enterprise Office Suite", quantity: 1, price: 95000, taxRate: 18, hsn: "997212" },
      { description: "Monthly Conference Room Access Credits", quantity: 1, price: 8000, taxRate: 18, hsn: "997212" }
    ],
    notes: "Office lease invoice payable on or before 5th of each month.",
    createdAt: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "tmpl-tata-steel",
    name: "Tata Steel Industrial Raw Materials",
    description: "Recurring supplier purchase order for construction & fabrication bars",
    vendorName: "Tata Steel Trading Ltd",
    vendorGstin: "27AAPCS1030F1Z4",
    vendorAddress: "Bombay House, 24 Homi Mody Street, Mumbai, MH 400001",
    category: "Purchase",
    expenseCategory: "Raw Materials",
    tags: ["Raw Materials", "Steel", "Industrial", "Manufacturing"],
    recurringFrequency: "Monthly",
    defaultItems: [
      { description: "High-Tensile TMT Steel Bars 12mm (Fe 550D)", quantity: 25, price: 2400, taxRate: 18, hsn: "721420" },
      { description: "Galvanized Steel Structural Beams (Grade 50)", quantity: 10, price: 5500, taxRate: 18, hsn: "721633" }
    ],
    notes: "Supplied against PO-2026-TR. Delivery at central warehouse.",
    createdAt: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "tmpl-meta-google-ads",
    name: "Digital Marketing & Performance Ads",
    description: "Monthly pay-per-click advertising spend on Google Ads and Meta",
    vendorName: "Google India Private Limited",
    vendorGstin: "29AABCG1234D1Z8",
    vendorAddress: "Prestige Sigma, 3 Vittal Mallya Road, Bengaluru, KA 560001",
    category: "Expense",
    expenseCategory: "Marketing",
    tags: ["Marketing", "Advertising", "Google Ads", "Growth"],
    recurringFrequency: "Monthly",
    defaultItems: [
      { description: "Search Engine PPC Marketing & App Install Campaigns", quantity: 1, price: 50000, taxRate: 18, hsn: "998363" }
    ],
    notes: "Billed monthly based on direct ad clicks and conversion spend.",
    createdAt: new Date().toISOString(),
    isPreset: true
  }
];

// Simulated base64 sample images (high contrast SVG mock placeholders representing actual scan documents)
// These allow testing OCR extraction instantaneously with extremely high-fidelity outputs
export const sampleOcrInvoices = [
  {
    name: "Apex_Office_Supplies_Scan.png",
    supplier: "Apex Office Supplies Ltd (GSTIN: 07AAACA4401G1Z3)",
    customer: "Vardhaman & Sons",
    amount: "₹18,500",
    // We pass structured placeholder content along with the image so the OCR handler can mock parse or real parse
    prompt: "Apex Office Supplies Ltd. GSTIN: 07AAACA4401G1Z3. Customer: Vardhaman & Sons. Invoice #: AO-88421. Date: 2026-07-14. Category: Office Supplies. Items: 10 ergonomic desk chairs at ₹1500 each with 18% GST, and 5 metal paper bins at ₹700 each with 12% GST."
  },
  {
    name: "Indigo_Airlines_Corporate_Travel.pdf",
    supplier: "InterGlobe Aviation Ltd (IndiGo) (GSTIN: 07AAACO1234D1Z2)",
    customer: "Unikorn360 AI Solutions",
    amount: "₹38,200",
    prompt: "InterGlobe Aviation Ltd (IndiGo). GSTIN: 07AAACO1234D1Z2. Customer: Unikorn360 AI Solutions. Invoice #: 6E-2026-4491. Date: 2026-07-20. Category: Travel. Items: 2 Corporate Business Flights DEL-BLR at ₹19,100 each with 5% GST (HSN 9964)."
  },
  {
    name: "Pharma_Wholesale_Bill.jpg",
    supplier: "Metropolis Biotech (GSTIN: 27AAPCM2201F1Z2)",
    customer: "LifeCare Pharma Dist",
    amount: "₹1,12,000",
    prompt: "Metropolis Biotech. GSTIN: 27AAPCM2201F1Z2. Customer: LifeCare Pharma Dist, GSTIN: 27AABCL0912D1Z4. Invoice #: MB-9901. Date: 2026-07-12. Category: Healthcare. Items: 100 Vaccine boxes at ₹1000 each with 12% GST (HSN 3004)."
  }
];

// Helper to convert an InvoiceTemplate to an Invoice object ready for saving
export function createInvoiceFromTemplate(
  template: InvoiceTemplate, 
  customInvoiceNumber?: string, 
  customDate?: string,
  userCompanySettings?: { name: string; address: string; gstin: string }
): Invoice {
  const mathResult = calculateInvoiceTotals(
    template.defaultItems, 
    template.vendorGstin, 
    template.customerGstin || userCompanySettings?.gstin
  );

  const dateStr = customDate || new Date().toISOString().substring(0, 10);
  const prefix = template.category === 'Expense' ? 'EXP' : template.category === 'Purchase' ? 'PUR' : 'INV';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const invNumber = customInvoiceNumber || `${prefix}-${new Date().getFullYear()}-${randomNum}`;

  return {
    id: "inv-" + generateId(),
    invoiceNumber: invNumber,
    supplierName: template.vendorName,
    supplierGstin: template.vendorGstin || "",
    supplierAddress: template.vendorAddress || "",
    customerName: template.customerName || userCompanySettings?.name || "Client Business",
    customerGstin: template.customerGstin || userCompanySettings?.gstin || "",
    customerAddress: template.customerAddress || userCompanySettings?.address || "",
    date: dateStr,
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10),
    items: mathResult.items,
    subtotal: mathResult.subtotal,
    cgst: mathResult.cgst,
    sgst: mathResult.sgst,
    igst: mathResult.igst,
    taxAmount: mathResult.taxAmount,
    totalAmount: mathResult.totalAmount,
    status: 'unpaid',
    paymentStatus: 'due',
    amountPaid: 0,
    balanceDue: mathResult.totalAmount,
    category: template.category,
    expenseCategory: template.expenseCategory || 'Other',
    tags: template.tags && template.tags.length > 0 ? template.tags : [template.expenseCategory || 'Recurring', 'Template'],
    notes: template.notes || `Recurring vendor invoice generated from ${template.name} template.`,
    createdAt: new Date().toISOString()
  };
}

// Convert template to natural language prompt for Prompt Creator
export function convertTemplateToPrompt(template: InvoiceTemplate): string {
  const itemsText = template.defaultItems
    .map(i => `${i.quantity}x ${i.description} at ₹${i.price} (${i.taxRate}% GST${i.hsn ? `, HSN ${i.hsn}` : ''})`)
    .join(', ');

  let prompt = `Create a ${template.category.toLowerCase()} invoice from ${template.vendorName}`;
  if (template.vendorGstin) {
    prompt += ` (GSTIN: ${template.vendorGstin})`;
  }
  if (template.customerName) {
    prompt += ` to ${template.customerName}`;
    if (template.customerGstin) {
      prompt += ` (GSTIN: ${template.customerGstin})`;
    }
  }
  prompt += `. Category: ${template.expenseCategory || template.category}. Items: ${itemsText}.`;
  if (template.notes) {
    prompt += ` Notes: ${template.notes}`;
  }
  return prompt;
}

