import { Invoice } from "../types";

export const SAMPLE_INVOICES: Invoice[] = [
  {
    id: "inv-sample-101",
    invoiceNumber: "INV-2026-1041",
    supplierName: "UNIKORN360 Business Intelligence",
    supplierGstin: "33AABCU1234A1Z8",
    supplierAddress: "VK Complex, P.J.N. Road, Vaniyambadi, Tamil Nadu 635751",
    customerName: "Reliance Digital Retail Ltd",
    customerGstin: "33AAACR1283D1Z9",
    customerAddress: "Anna Salai, Teynampet, Chennai, Tamil Nadu 600018",
    date: "2026-10-18",
    dueDate: "2026-11-02",
    items: [
      {
        id: "item-1",
        description: "Enterprise Business Intelligence & GST Automation Suite",
        quantity: 1,
        price: 85000,
        taxRate: 18,
        hsn: "998314",
        total: 85000
      },
      {
        id: "item-2",
        description: "Dedicated System Integration & Onboarding",
        quantity: 1,
        price: 25000,
        taxRate: 18,
        hsn: "998313",
        total: 25000
      }
    ],
    subtotal: 110000,
    cgst: 9900,
    sgst: 9900,
    igst: 0,
    taxAmount: 19800,
    totalAmount: 129800,
    status: "paid",
    paymentStatus: "paid",
    amountPaid: 129800,
    balanceDue: 0,
    category: "Sales",
    expenseCategory: "Software",
    tags: ["Enterprise", "BI", "GST"],
    notes: "Paid via NEFT corporate settlement.",
    createdAt: "2026-10-18T09:30:00.000Z"
  },
  {
    id: "inv-sample-102",
    invoiceNumber: "EXP-2026-2089",
    supplierName: "Amazon Web Services (AWS) India Pvt Ltd",
    supplierGstin: "27AABCA1234A1Z1",
    supplierAddress: "Cyber City, Bandra Kurla Complex, Mumbai, Maharashtra 400051",
    customerName: "UNIKORN360 Business Intelligence",
    customerGstin: "33AABCU1234A1Z8",
    customerAddress: "VK Complex, P.J.N. Road, Vaniyambadi, Tamil Nadu 635751",
    date: "2026-11-01",
    dueDate: "2026-11-15",
    items: [
      {
        id: "item-3",
        description: "AWS EC2 Production Compute Cluster & CloudFront CDN",
        quantity: 1,
        price: 42000,
        taxRate: 18,
        hsn: "998315",
        total: 42000
      }
    ],
    subtotal: 42000,
    cgst: 0,
    sgst: 0,
    igst: 7560,
    taxAmount: 7560,
    totalAmount: 49560,
    status: "unpaid",
    paymentStatus: "due",
    amountPaid: 0,
    balanceDue: 49560,
    category: "Expense",
    expenseCategory: "Software",
    tags: ["Cloud", "AWS", "Infrastructure"],
    notes: "Monthly cloud infrastructure billing.",
    createdAt: "2026-11-01T10:00:00.000Z"
  },
  {
    id: "inv-sample-103",
    invoiceNumber: "INV-2026-1048",
    supplierName: "UNIKORN360 Business Intelligence",
    supplierGstin: "33AABCU1234A1Z8",
    supplierAddress: "VK Complex, P.J.N. Road, Vaniyambadi, Tamil Nadu 635751",
    customerName: "TVS Supply Chain Solutions Ltd",
    customerGstin: "33AAACT4012F1Z2",
    customerAddress: "Madurai Road, Tiruchirappalli, Tamil Nadu 620001",
    date: "2026-11-05",
    dueDate: "2026-11-20",
    items: [
      {
        id: "item-4",
        description: "AI Document Extraction & OCR Processing Retainer",
        quantity: 1,
        price: 64000,
        taxRate: 18,
        hsn: "998314",
        total: 64000
      }
    ],
    subtotal: 64000,
    cgst: 5760,
    sgst: 5760,
    igst: 0,
    taxAmount: 11520,
    totalAmount: 75520,
    status: "unpaid",
    paymentStatus: "due",
    amountPaid: 0,
    balanceDue: 75520,
    category: "Sales",
    expenseCategory: "Consulting",
    tags: ["AI", "OCR", "Retainer"],
    notes: "Net-15 corporate billing cycle.",
    createdAt: "2026-11-05T11:15:00.000Z"
  }
];
