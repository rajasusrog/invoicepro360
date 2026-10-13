import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { Invoice, CompanySettings } from "../types";
import { formatRupees, convertToStandardCSV } from "./invoiceUtils";

/**
 * Generates a clean, professional, print-ready PDF document for a single invoice.
 */
export function generateInvoicePdf(invoice: Invoice, companySettings?: CompanySettings): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Background Header Accent
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 8, "F");

  // Company / Supplier branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);

  const supplierTitle = invoice.supplierName || companySettings?.name || "Tax Invoice";
  doc.text(supplierTitle.substring(0, 32), 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("GST Compliant Tax Invoice & Payment Notice", 14, 28);

  // Invoice Title & Metadata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("TAX INVOICE", 140, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 140, 28);
  doc.text(`Date: ${invoice.date}`, 140, 33);
  if (invoice.dueDate) {
    doc.text(`Due Date: ${invoice.dueDate}`, 140, 38);
  }
  doc.text(`Status: ${(invoice.status || "unpaid").toUpperCase()}`, 140, invoice.dueDate ? 43 : 38);
  doc.text(`Category: ${invoice.category || "Sales"}${invoice.expenseCategory ? ` (${invoice.expenseCategory})` : ""}`, 140, invoice.dueDate ? 48 : 43);

  // Separator Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  // Billed From (Supplier) - Left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("FROM (SUPPLIER)", 14, 59);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(invoice.supplierName, 14, 65);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const supplierAddrLines = doc.splitTextToSize(invoice.supplierAddress || "Address not provided", 80);
  doc.text(supplierAddrLines, 14, 70);

  const supplierGstinY = 70 + supplierAddrLines.length * 4.2;
  if (invoice.supplierGstin) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${invoice.supplierGstin}`, 14, supplierGstinY);
  }

  // Billed To (Customer) - Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("TO (CUSTOMER / BILLED TO)", 110, 59);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(invoice.customerName, 110, 65);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const customerAddrLines = doc.splitTextToSize(invoice.customerAddress || "Address not provided", 80);
  doc.text(customerAddrLines, 110, 70);

  const customerGstinY = 70 + customerAddrLines.length * 4.2;
  if (invoice.customerGstin) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${invoice.customerGstin}`, 110, customerGstinY);
  } else {
    doc.setFont("helvetica", "italic");
    doc.text("Unregistered Consumer", 110, customerGstinY);
  }

  const startTableY = Math.max(supplierGstinY, customerGstinY) + 10;

  // Items Table Header
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(14, startTableY - 5, 182, 8, "F");
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, startTableY - 5, 196, startTableY - 5);
  doc.line(14, startTableY + 3, 196, startTableY + 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Item / Description", 16, startTableY);
  doc.text("HSN", 92, startTableY, { align: "center" });
  doc.text("Qty", 112, startTableY, { align: "center" });
  doc.text("Rate", 135, startTableY, { align: "right" });
  doc.text("Tax Rate", 160, startTableY, { align: "center" });
  doc.text("Amount (INR)", 194, startTableY, { align: "right" });

  let curY = startTableY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  invoice.items.forEach((item, index) => {
    // Check if new page needed
    if (curY > 255) {
      doc.addPage();
      curY = 20;
    }

    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, curY - 4, 182, 7, "F");
    }

    const descLines = doc.splitTextToSize(item.description, 72);
    doc.text(descLines, 16, curY);

    doc.text(item.hsn || "-", 92, curY, { align: "center" });
    doc.text(String(item.quantity), 112, curY, { align: "center" });
    doc.text(formatRupees(item.price).replace("₹", "Rs. "), 135, curY, { align: "right" });
    doc.text(`${item.taxRate}%`, 160, curY, { align: "center" });
    doc.text(formatRupees(item.quantity * item.price).replace("₹", "Rs. "), 194, curY, { align: "right" });

    curY += Math.max(descLines.length * 4.5, 6.5);
  });

  // Table bottom border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, curY, 196, curY);
  curY += 6;

  // Summary Totals Box (Right aligned)
  const totalsBoxX = 115;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text("Taxable Subtotal:", totalsBoxX, curY);
  doc.text(formatRupees(invoice.subtotal).replace("₹", "Rs. "), 194, curY, { align: "right" });
  curY += 5;

  if (invoice.cgst > 0 || invoice.sgst > 0) {
    doc.text(`CGST:`, totalsBoxX, curY);
    doc.text(formatRupees(invoice.cgst).replace("₹", "Rs. "), 194, curY, { align: "right" });
    curY += 4.5;

    doc.text(`SGST:`, totalsBoxX, curY);
    doc.text(formatRupees(invoice.sgst).replace("₹", "Rs. "), 194, curY, { align: "right" });
    curY += 4.5;
  }

  if (invoice.igst > 0) {
    doc.text(`IGST (Inter-state):`, totalsBoxX, curY);
    doc.text(formatRupees(invoice.igst).replace("₹", "Rs. "), 194, curY, { align: "right" });
    curY += 4.5;
  }

  doc.text("Total Tax Amount:", totalsBoxX, curY);
  doc.text(formatRupees(invoice.taxAmount).replace("₹", "Rs. "), 194, curY, { align: "right" });
  curY += 6;

  // Grand Total Highlight
  doc.setFillColor(241, 245, 249);
  doc.rect(totalsBoxX - 2, curY - 4, 83, 9, "F");
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.8);
  doc.line(totalsBoxX - 2, curY - 4, 196, curY - 4);
  doc.line(totalsBoxX - 2, curY + 5, 196, curY + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Grand Total:", totalsBoxX, curY + 1.5);
  doc.setTextColor(79, 70, 229);
  doc.text(formatRupees(invoice.totalAmount).replace("₹", "Rs. "), 194, curY + 1.5, { align: "right" });
  curY += 12;

  // Payment Status / Amount Paid / Balance Due
  if (invoice.balanceDue !== undefined || invoice.amountPaid !== undefined) {
    const paid = invoice.amountPaid || (invoice.status === 'paid' ? invoice.totalAmount : 0);
    const balance = invoice.balanceDue !== undefined ? invoice.balanceDue : Math.max(0, invoice.totalAmount - paid);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Amount Paid: ${formatRupees(paid).replace("₹", "Rs. ")}`, totalsBoxX, curY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(balance > 0 ? 225 : 16, balance > 0 ? 29 : 185, balance > 0 ? 72 : 129);
    doc.text(`Balance Due: ${formatRupees(balance).replace("₹", "Rs. ")}`, 194, curY, { align: "right" });
    curY += 8;
  }

  // Notes & Payment Instructions (Left)
  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Notes & Payment Instructions:", 14, curY - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(invoice.notes, 90);
    doc.text(noteLines, 14, curY - 9);
  }

  // Footer Disclaimer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 280, 196, 280);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Generated by InvoicePro enterprise billing system. This is a computer-generated tax invoice.", 14, 285);
  doc.text(`Page 1 of 1`, 194, 285, { align: "right" });

  return doc;
}

/**
 * Generates a ZIP archive containing all selected invoices in PDF format
 * alongside a consolidated accounting CSV ledger.
 */
export async function generateBulkInvoicesZip(
  invoices: Invoice[], 
  companySettings?: CompanySettings,
  onProgress?: (current: number, total: number, currentInvoice: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("Invoices_PDF_Export") || zip;

  const total = invoices.length;

  for (let i = 0; i < total; i++) {
    const inv = invoices[i];
    if (onProgress) {
      onProgress(i + 1, total, inv.invoiceNumber);
    }

    try {
      const doc = generateInvoicePdf(inv, companySettings);
      // Get binary ArrayBuffer / Uint8Array from jsPDF
      const pdfArrayBuffer = doc.output("arraybuffer");
      
      // Clean file name
      const safeNumber = inv.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
      const safeCustomer = (inv.customerName || "Customer").replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 20);
      const filename = `Invoice_${safeNumber}_${safeCustomer}.pdf`;

      folder.file(filename, pdfArrayBuffer);
    } catch (err) {
      console.error(`Failed to generate PDF for invoice ${inv.invoiceNumber}:`, err);
    }
  }

  // Also include a master CSV summary inside the ZIP
  const csvData = convertToStandardCSV(invoices);
  folder.file("Invoices_Ledger_Summary.csv", csvData);

  // Generate the ZIP blob
  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  return zipBlob;
}
