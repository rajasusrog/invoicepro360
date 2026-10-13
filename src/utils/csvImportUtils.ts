import { Invoice, InvoiceItem, ExpenseCategory } from "../types";
import { generateId, calculateInvoiceTotals, defaultExpenseCategories } from "./invoiceUtils";

/**
 * Splits a CSV line taking into account quoted strings that may contain commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quotes
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses full CSV text into rows of columns, respecting multiline quoted strings.
 */
function parseFullCsv(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(parseCsvLine(currentLine));
      }
      currentLine = "";
      // Handle CRLF
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(parseCsvLine(currentLine));
  }

  return lines;
}

export interface CsvParseResult {
  invoices: Invoice[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  successCount: number;
}

/**
 * Parses CSV text and converts each row into a complete, balanced Invoice object.
 */
export function parseInvoicesFromCSV(csvText: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const invoices: Invoice[] = [];

  const rawRows = parseFullCsv(csvText);
  if (rawRows.length < 2) {
    return {
      invoices: [],
      errors: ["CSV file must contain at least a header row and one data row."],
      warnings: [],
      totalRows: 0,
      successCount: 0
    };
  }

  // Normalize header mapping
  const headers = rawRows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  const getColIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = headers.indexOf(cleanAlias);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colInvoiceNum = getColIndex("invoicenumber", "invoiceno", "invno", "invoicenum", "number", "id");
  const colDate = getColIndex("invoicedate", "date", "billdate", "createdat");
  const colDueDate = getColIndex("duedate", "due", "paymentdue");
  const colSupplierName = getColIndex("suppliername", "supplier", "vendor", "vendorname", "from", "billedfrom", "seller");
  const colSupplierGstin = getColIndex("suppliergstin", "suppliergst", "vendorgstin", "fromgstin", "sellergstin");
  const colSupplierAddress = getColIndex("supplieraddress", "vendoraddress", "fromaddress");
  const colCustomerName = getColIndex("customername", "customer", "client", "clientname", "to", "billedto", "buyer");
  const colCustomerGstin = getColIndex("customergstin", "customergst", "clientgstin", "togstin", "buyergstin", "receivergstin");
  const colCustomerAddress = getColIndex("customeraddress", "clientaddress", "toaddress");
  const colCategory = getColIndex("category", "type", "invoicetype", "documenttype");
  const colExpenseCategory = getColIndex("expensecategory", "expensetype", "costcategory", "spendcategory");
  const colTags = getColIndex("tags", "tag", "labels", "keywords");
  const colSubtotal = getColIndex("subtotal", "taxablevalue", "subtotalamount", "taxableamount", "amount");
  const colCgst = getColIndex("cgst", "centraltax", "cgstamount");
  const colSgst = getColIndex("sgst", "statetax", "sgstamount");
  const colIgst = getColIndex("igst", "integratedtax", "igstamount");
  const colTaxAmount = getColIndex("totaltax", "taxamount", "tax", "gsttotal", "totaltaxamount");
  const colTotalAmount = getColIndex("totalinvoicevalue", "totalamount", "total", "invoicevalue", "grandtotal", "netamount");
  const colStatus = getColIndex("status", "invoicestatus");
  const colPaymentStatus = getColIndex("paymentstatus", "paystatus");
  const colAmountPaid = getColIndex("amountpaid", "paidamount", "paid");
  const colBalanceDue = getColIndex("balancedue", "dueamount", "outstanding", "balance");
  const colNotes = getColIndex("notes", "description", "remarks", "terms");
  const colItemDesc = getColIndex("itemdescription", "items", "itemname", "product", "services");

  // Parse each row
  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const row = rawRows[rowIndex];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue; // skip empty line
    }

    const getVal = (colIdx: number, defaultVal = ""): string => {
      if (colIdx >= 0 && colIdx < row.length) {
        return row[colIdx].trim();
      }
      return defaultVal;
    };

    const getNum = (colIdx: number, defaultVal = 0): number => {
      const valStr = getVal(colIdx);
      if (!valStr) return defaultVal;
      // Strip currency symbols and commas (e.g. ₹ 45,000.00 -> 45000)
      const cleanNum = parseFloat(valStr.replace(/[^\d.-]/g, ""));
      return isNaN(cleanNum) ? defaultVal : cleanNum;
    };

    // Extract fields
    const invoiceNumber = getVal(colInvoiceNum) || `INV-IMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const supplierName = getVal(colSupplierName) || "Imported Vendor";
    const customerName = getVal(colCustomerName) || "Primary Client";
    const dateStr = getVal(colDate) || new Date().toISOString().substring(0, 10);
    const dueDateStr = getVal(colDueDate) || undefined;
    const supplierGstin = getVal(colSupplierGstin) || undefined;
    const supplierAddress = getVal(colSupplierAddress) || undefined;
    const customerGstin = getVal(colCustomerGstin) || undefined;
    const customerAddress = getVal(colCustomerAddress) || undefined;
    
    // Categorization
    let rawCategory = getVal(colCategory, "Sales");
    if (!["Sales", "Purchase", "Expense", "Credit Note", "Debit Note", "Advance", "Export", "Import"].includes(rawCategory)) {
      rawCategory = "Sales";
    }
    const category = rawCategory as Invoice["category"];

    let expenseCategory = getVal(colExpenseCategory);
    if (!expenseCategory) {
      // Auto-detect from notes, supplier name, or category
      const combined = `${supplierName} ${getVal(colNotes)} ${getVal(colItemDesc)}`.toLowerCase();
      if (combined.includes("aws") || combined.includes("software") || combined.includes("cloud") || combined.includes("hosting") || combined.includes("saas")) {
        expenseCategory = "Software";
      } else if (combined.includes("electric") || combined.includes("power") || combined.includes("water") || combined.includes("internet") || combined.includes("fiber")) {
        expenseCategory = "Utilities";
      } else if (combined.includes("flight") || combined.includes("hotel") || combined.includes("travel") || combined.includes("cab")) {
        expenseCategory = "Travel";
      } else if (combined.includes("hardware") || combined.includes("laptop") || combined.includes("monitor") || combined.includes("server")) {
        expenseCategory = "Hardware";
      } else if (combined.includes("marketing") || combined.includes("ads") || combined.includes("google") || combined.includes("meta")) {
        expenseCategory = "Marketing";
      } else if (combined.includes("consult") || combined.includes("legal") || combined.includes("advisory")) {
        expenseCategory = "Consulting";
      } else if (combined.includes("office") || combined.includes("paper") || combined.includes("chair") || combined.includes("desk")) {
        expenseCategory = "Office Supplies";
      } else if (combined.includes("steel") || combined.includes("raw") || combined.includes("cement") || combined.includes("material")) {
        expenseCategory = "Raw Materials";
      } else if (combined.includes("rent") || combined.includes("lease") || combined.includes("wework")) {
        expenseCategory = "Rent";
      } else {
        expenseCategory = category === "Expense" || category === "Purchase" ? "Other" : undefined;
      }
    }

    // Parse tags
    let tags: string[] = [];
    const rawTags = getVal(colTags);
    if (rawTags) {
      tags = rawTags.split(/[,;|]/).map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    }
    if (tags.length === 0 && expenseCategory) {
      tags = [expenseCategory, "CSV-Imported"];
    }

    // Amounts & Tax calculations
    let subtotal = getNum(colSubtotal);
    let totalAmount = getNum(colTotalAmount);
    let cgst = getNum(colCgst);
    let sgst = getNum(colSgst);
    let igst = getNum(colIgst);
    let taxAmount = getNum(colTaxAmount);

    // If total was given but subtotal was not
    if (totalAmount > 0 && subtotal === 0) {
      if (taxAmount > 0) {
        subtotal = Math.max(0, totalAmount - taxAmount);
      } else {
        // Assume standard 18% GST if tax isn't split
        subtotal = Math.round(totalAmount / 1.18);
        taxAmount = totalAmount - subtotal;
      }
    } else if (subtotal > 0 && totalAmount === 0) {
      if (taxAmount === 0) {
        taxAmount = Math.round(subtotal * 0.18);
      }
      totalAmount = subtotal + taxAmount;
    } else if (subtotal === 0 && totalAmount === 0) {
      // Default fallback amount
      subtotal = 5000;
      taxAmount = 900;
      totalAmount = 5900;
      warnings.push(`Row ${rowIndex} (Invoice ${invoiceNumber}): Amount was missing; set default ₹5,900.`);
    }

    // Balance tax components if taxAmount is present but cgst/sgst/igst are 0
    if (taxAmount > 0 && cgst === 0 && sgst === 0 && igst === 0) {
      const isInterstate = supplierGstin && customerGstin && supplierGstin.substring(0, 2) !== customerGstin.substring(0, 2);
      if (isInterstate) {
        igst = taxAmount;
      } else {
        cgst = taxAmount / 2;
        sgst = taxAmount / 2;
      }
    } else if (cgst > 0 || sgst > 0 || igst > 0) {
      taxAmount = cgst + sgst + igst;
      if (totalAmount === subtotal) {
        totalAmount = subtotal + taxAmount;
      }
    }

    // Line items
    const itemDesc = getVal(colItemDesc) || `${category} - General Services / Supplies`;
    const items: InvoiceItem[] = [
      {
        id: generateId(),
        description: itemDesc,
        quantity: 1,
        price: subtotal,
        taxRate: subtotal > 0 ? Math.round((taxAmount / subtotal) * 100) : 18,
        total: subtotal
      }
    ];

    // Status and Payment
    let rawStatus = getVal(colStatus).toLowerCase();
    let status: Invoice["status"] = "unpaid";
    if (rawStatus.includes("paid") && !rawStatus.includes("unpaid") && !rawStatus.includes("partial")) {
      status = "paid";
    } else if (rawStatus.includes("partial")) {
      status = "partially_paid";
    } else if (rawStatus.includes("overdue")) {
      status = "overdue";
    } else if (rawStatus.includes("draft")) {
      status = "draft";
    }

    let amountPaid = getNum(colAmountPaid, status === "paid" ? totalAmount : 0);
    let balanceDue = getNum(colBalanceDue, status === "paid" ? 0 : Math.max(0, totalAmount - amountPaid));

    let paymentStatus: 'paid' | 'partially_paid' | 'due' | 'overdue' = 'due';
    if (status === 'paid' || balanceDue <= 0.5) {
      paymentStatus = 'paid';
      status = 'paid';
      amountPaid = totalAmount;
      balanceDue = 0;
    } else if (amountPaid > 0) {
      paymentStatus = 'partially_paid';
      status = 'partially_paid';
    } else if (status === 'overdue' || (dueDateStr && new Date(dueDateStr).getTime() < Date.now())) {
      paymentStatus = 'overdue';
      status = 'overdue';
    }

    const notes = getVal(colNotes) || `Imported from CSV ledger on ${new Date().toLocaleDateString('en-IN')}`;

    const invoice: Invoice = {
      id: "inv-" + generateId(),
      invoiceNumber,
      supplierName,
      supplierGstin,
      supplierAddress,
      customerName,
      customerGstin,
      customerAddress,
      date: dateStr,
      dueDate: dueDateStr,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      taxAmount,
      totalAmount,
      status,
      paymentStatus,
      amountPaid,
      balanceDue,
      category,
      expenseCategory,
      tags,
      notes,
      ocrSource: "CSV Bulk Import",
      createdAt: new Date().toISOString()
    };

    invoices.push(invoice);
  }

  return {
    invoices,
    errors,
    warnings,
    totalRows: rawRows.length - 1,
    successCount: invoices.length
  };
}

/**
 * Generates a standard sample CSV template with pre-filled sample rows
 */
export function generateSampleCsvTemplate(): string {
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
    "Notes"
  ];

  const sampleRows = [
    [
      "INV-2026-081",
      "2026-08-15",
      "2026-08-30",
      "Amazon Web Services India Pvt Ltd",
      "27AABCA1234A1Z1",
      "Cyber City, Mumbai, MH 400051",
      "Unikorn360 AI Solutions",
      "27AABCU1234A1Z8",
      "BKC, Mumbai, MH 400051",
      "Expense",
      "Software",
      "Software; Cloud; AWS; Recurring",
      "45000",
      "4050",
      "4050",
      "0",
      "8100",
      "53100",
      "unpaid",
      "Monthly AWS EC2 and Aurora DB infrastructure"
    ],
    [
      "INV-2026-082",
      "2026-08-18",
      "2026-09-02",
      "Maharashtra State Electricity Co",
      "27AAACM2456K1Z9",
      "Bandra East, Mumbai 400051",
      "Unikorn360 AI Solutions",
      "27AABCU1234A1Z8",
      "BKC, Mumbai, MH 400051",
      "Expense",
      "Utilities",
      "Utilities; Electricity; Office",
      "18500",
      "1665",
      "1665",
      "0",
      "3330",
      "21830",
      "paid",
      "Commercial power consumption for August 2026"
    ],
    [
      "INV-2026-083",
      "2026-08-20",
      "2026-09-05",
      "MakeMyTrip Corporate Travel",
      "07AABCM6789G1Z5",
      "DLF Cyber City, Gurugram, HR 122002",
      "Unikorn360 AI Solutions",
      "27AABCU1234A1Z8",
      "BKC, Mumbai, MH 400051",
      "Expense",
      "Travel",
      "Travel; Flights; Business",
      "32000",
      "0",
      "0",
      "5760",
      "5760",
      "37760",
      "overdue",
      "Client executive on-site flight tickets (BOM-DEL)"
    ],
    [
      "INV-2026-084",
      "2026-08-22",
      "2026-09-10",
      "Unikorn360 AI Solutions",
      "27AABCU1234A1Z8",
      "BKC, Mumbai, MH 400051",
      "Tata Consultancy Services Ltd",
      "27AAACT2901G1Z2",
      "TCS House, Fort, Mumbai, MH 400001",
      "Sales",
      "Consulting",
      "Sales; Consulting; Enterprise AI",
      "120000",
      "10800",
      "10800",
      "0",
      "21600",
      "141600",
      "paid",
      "Enterprise AI Model Tuning & Deployment SOW"
    ]
  ];

  return [headers.join(","), ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
}
