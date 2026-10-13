import React, { useState, useMemo } from "react";
import { Invoice } from "../types";
import { formatRupees, validateInvoice, convertToStandardCSV, convertToGstReadyCSV, triggerFileDownload, categoryStyleMap } from "../utils/invoiceUtils";
import { generateBulkInvoicesZip } from "../utils/pdfUtils";
import CsvImportModal from "./CsvImportModal";
import AutoTaggingModal from "./AutoTaggingModal";
import { classifyInvoice, CATEGORY_DEFINITIONS, CoreExpenseCategory } from "../utils/taggingEngine";
import { isInvoiceDueForGeneration, generateNextRecurringInvoice } from "../utils/recurringUtils";
import { 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  PlusCircle, 
  FileDown, 
  Upload,
  Calendar, 
  Layers, 
  CreditCard, 
  Tag, 
  Sparkles, 
  Archive, 
  Loader2, 
  X,
  Zap,
  Terminal,
  Briefcase,
  Cpu,
  RotateCcw,
  Repeat
} from "lucide-react";

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onOpenCreateModal: () => void;
  searchFilter: string;
  onRecordPayment?: (invoice: Invoice) => void;
  onBatchInvoicesCreated?: (invoices: Invoice[]) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onBatchInvoicesUpdated?: (invoices: Invoice[]) => void;
}

export default function InvoiceList({ 
  invoices, 
  onSelectInvoice, 
  onDeleteInvoice, 
  onOpenCreateModal,
  searchFilter,
  onRecordPayment,
  onBatchInvoicesCreated,
  onUpdateInvoice,
  onBatchInvoicesUpdated
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState(searchFilter);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [showAutoTagModal, setShowAutoTagModal] = useState(false);

  // Bulk selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number; invoiceNumber: string }>({ current: 0, total: 0, invoiceNumber: "" });

  // Sync internal search with parent filter if modified
  React.useEffect(() => {
    if (searchFilter !== searchTerm) {
      setSearchTerm(searchFilter);
    }
  }, [searchFilter]);

  // Apply filters
  const filteredInvoices = invoices.filter(inv => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchLower) ||
      inv.supplierName.toLowerCase().includes(searchLower) ||
      inv.customerName.toLowerCase().includes(searchLower) ||
      (inv.supplierGstin && inv.supplierGstin.toLowerCase().includes(searchLower)) ||
      (inv.customerGstin && inv.customerGstin.toLowerCase().includes(searchLower)) ||
      (inv.category && inv.category.toLowerCase().includes(searchLower)) ||
      (inv.expenseCategory && inv.expenseCategory.toLowerCase().includes(searchLower)) ||
      (inv.tags && inv.tags.some(t => t.toLowerCase().includes(searchLower)));

    const matchesStatus = statusFilter === "all" 
      ? true 
      : statusFilter === "recurring" 
      ? Boolean(inv.isRecurring)
      : inv.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || inv.category === categoryFilter || inv.expenseCategory === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Track recurring invoices ready to auto-generate or flagged as due
  const dueRecurringInvoices = useMemo(() => {
    return invoices.filter(inv => isInvoiceDueForGeneration(inv));
  }, [invoices]);

  // Selection handlers
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id));

  // Handle Export actions
  const handleExportAllToCSV = () => {
    // Export entire invoice history
    const csvContent = convertToStandardCSV(invoices);
    const dateStr = new Date().toISOString().substring(0, 10);
    triggerFileDownload(`InvoicePro_Complete_History_${dateStr}.csv`, csvContent);
    setExportDropdownOpen(false);
  };

  const handleExportStandard = () => {
    // Export currently filtered invoices or selected invoices
    const targetInvoices = selectedIds.size > 0 ? selectedInvoices : filteredInvoices;
    const csvContent = convertToStandardCSV(targetInvoices);
    const dateStr = new Date().toISOString().substring(0, 10);
    triggerFileDownload(`InvoicePro_Export_${dateStr}.csv`, csvContent);
    setExportDropdownOpen(false);
  };

  const handleExportGst = () => {
    const targetInvoices = selectedIds.size > 0 ? selectedInvoices : filteredInvoices;
    const csvContent = convertToGstReadyCSV(targetInvoices);
    const dateStr = new Date().toISOString().substring(0, 10);
    triggerFileDownload(`InvoicePro_GSTR1_Ready_${dateStr}.csv`, csvContent);
    setExportDropdownOpen(false);
  };

  // Bulk ZIP Export handler
  const handleExportZip = async (targetInvoices: Invoice[]) => {
    if (targetInvoices.length === 0) return;
    setIsExportingZip(true);
    setZipProgress({ current: 0, total: targetInvoices.length, invoiceNumber: "" });

    try {
      const zipBlob = await generateBulkInvoicesZip(
        targetInvoices,
        undefined,
        (current, total, invoiceNumber) => {
          setZipProgress({ current, total, invoiceNumber });
        }
      );

      const dateStr = new Date().toISOString().substring(0, 10);
      const filename = `InvoicePro_PDF_Archive_${dateStr}_(${targetInvoices.length}_Invoices).zip`;

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bulk ZIP export failed:", err);
      alert("Failed to create PDF ZIP archive. Please try again.");
    } finally {
      setIsExportingZip(false);
      setExportDropdownOpen(false);
    }
  };

  return (
    <div className="bg-[#111113] rounded-2xl border border-white/5 animate-fade-in-up relative" id="invoice-list-card">
      {/* ZIP Generation Progress Overlay Modal */}
      {isExportingZip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-indigo-500/30 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/30">
              <Archive className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h4 className="font-display font-bold text-white text-base">
                Compiling Bulk PDF ZIP Archive
              </h4>
              <p className="text-xs text-slate-400">
                Generating print-ready PDF files and consolidating accounting ledger summary...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 truncate max-w-[200px]">Processing: {zipProgress.invoiceNumber}</span>
                <span className="text-indigo-400 font-bold">{zipProgress.current} / {zipProgress.total}</span>
              </div>
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${(zipProgress.current / Math.max(1, zipProgress.total)) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-mono">
              Please wait while your ZIP bundle is prepared for download.
            </p>
          </div>
        </div>
      )}

      {/* Header and Controls */}
      <div className="p-5 border-b border-white/5 space-y-4" id="invoice-list-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-white text-lg flex items-center space-x-2">
              <span>Invoices Ledger</span>
              <span className="text-xs text-slate-400 font-normal">({invoices.length} Total)</span>
            </h3>
            <p className="text-xs text-slate-400">Manage, review, validate, bulk-export, and download active business records</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto relative">
            {/* Automated Tagging Engine Button */}
            <button
              onClick={() => setShowAutoTagModal(true)}
              className="bg-gradient-to-r from-indigo-600/90 to-purple-600/90 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold px-3.5 py-2 rounded-xl text-sm transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer hover:scale-[1.02]"
              id="auto-tag-engine-btn"
              title="Automatically categorize invoices as Utilities, Software, Services, or Equipment using vendor and line item analysis"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Auto-Tag Engine</span>
            </button>

            {/* Bulk ZIP Download Button */}
            <button 
              onClick={() => handleExportZip(selectedIds.size > 0 ? selectedInvoices : filteredInvoices)}
              disabled={isExportingZip}
              className="bg-indigo-600/90 hover:bg-indigo-600 text-white font-semibold px-3.5 py-2 rounded-xl text-sm transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer hover:scale-[1.02] disabled:opacity-50"
              id="export-zip-bulk-button"
              title="Download selected invoices packed as PDF documents inside a ZIP archive"
            >
              <Archive className="w-4 h-4 text-indigo-200" />
              <span>
                {selectedIds.size > 0 
                  ? `Download ZIP (${selectedIds.size} PDFs)` 
                  : `Export All PDFs (.ZIP)`}
              </span>
            </button>

            {/* Dedicated 1-Click Export to CSV Button for External Accounting Software */}
            <button 
              onClick={handleExportAllToCSV}
              className="bg-emerald-600/90 hover:bg-emerald-600 text-white font-semibold px-3.5 py-2 rounded-xl text-sm transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer hover:scale-[1.02]"
              id="export-csv-direct-button"
              title="Download entire invoice history as standard CSV compatible with QuickBooks, Tally, Zoho Books, and Excel"
            >
              <FileDown className="w-4 h-4 text-white" />
              <span>Export to CSV</span>
            </button>

            {/* Import CSV Button */}
            <button
              onClick={() => setShowCsvImportModal(true)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-3.5 py-2 rounded-xl text-sm border border-emerald-500/20 transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-[1.02]"
              id="import-csv-direct-button"
              title="Bulk import invoices from CSV spreadsheet into database"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Import CSV</span>
            </button>

            {/* Export Dropdown */}
            <button 
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="bg-white/5 text-slate-300 hover:bg-white/10 px-3 py-2 rounded-xl text-sm font-medium border border-white/5 transition-all flex items-center space-x-1.5 cursor-pointer"
              id="export-dropdown-button"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Format Options</span>
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 top-11 bg-[#1e1e21] border border-white/10 rounded-xl shadow-lg p-2 z-30 w-72 space-y-1 animate-fade-in-up" id="export-options-dropdown">
                <button
                  onClick={() => { setShowAutoTagModal(true); setExportDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2 cursor-pointer border-b border-white/5 mb-1 pb-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <div>
                    <p className="font-semibold text-indigo-400">Run Automated Tagging Engine</p>
                    <p className="text-[10px] text-slate-500">Auto-tag Utilities, Software, Services & Equipment</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowCsvImportModal(true); setExportDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2 cursor-pointer border-b border-white/5 mb-1 pb-2"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-emerald-400">Import CSV Records</p>
                    <p className="text-[10px] text-slate-500">Bulk upload external accounting spreadsheets</p>
                  </div>
                </button>
                <button 
                  onClick={() => handleExportZip(selectedIds.size > 0 ? selectedInvoices : filteredInvoices)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5 text-indigo-400" />
                  <div>
                    <p className="font-semibold text-indigo-400">
                      Bulk PDF ZIP Archive ({selectedIds.size > 0 ? selectedIds.size : filteredInvoices.length} Invoices)
                    </p>
                    <p className="text-[10px] text-slate-500">All invoices rendered as individual PDFs in a .zip file</p>
                  </div>
                </button>
                <button 
                  onClick={handleExportAllToCSV}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-emerald-400">All History CSV ({invoices.length} Invoices)</p>
                    <p className="text-[10px] text-slate-500">Full ledger history for accounting software</p>
                  </div>
                </button>
                <button 
                  onClick={handleExportStandard}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <p className="font-semibold text-white">
                      {selectedIds.size > 0 ? `Selected CSV (${selectedIds.size} Invoices)` : `Filtered CSV (${filteredInvoices.length} Invoices)`}
                    </p>
                    <p className="text-[10px] text-slate-500">Standard accounting column structure</p>
                  </div>
                </button>
                <button 
                  onClick={handleExportGst}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <p className="font-semibold text-amber-400">GST GSTR-1 Compatible</p>
                    <p className="text-[10px] text-slate-500">Ready for GSTR-1 utility filing</p>
                  </div>
                </button>
              </div>
            )}

            <button 
              onClick={onOpenCreateModal}
              className="bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
              id="create-invoice-button"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3" id="invoice-filters-row">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-500" />
            <input 
              type="text"
              placeholder="Search by Invoice #, Supplier, Customer, GSTIN, Tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] transition-all"
              id="invoice-search-input"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] appearance-none"
              id="status-filter-select"
            >
              <option value="all" className="bg-[#111113]">All Payment Statuses</option>
              <option value="recurring" className="bg-[#111113]">🔁 Recurring Only</option>
              <option value="paid" className="bg-[#111113]">Paid Only</option>
              <option value="unpaid" className="bg-[#111113]">Unpaid Only</option>
              <option value="overdue" className="bg-[#111113]">Overdue Only</option>
              <option value="draft" className="bg-[#111113]">Drafts</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Layers className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] appearance-none"
              id="category-filter-select"
            >
              <option value="all" className="bg-[#111113]">All Categories</option>
              <option value="Utilities" className="bg-[#111113]">⚡ Utilities</option>
              <option value="Software" className="bg-[#111113]">💻 Software</option>
              <option value="Services" className="bg-[#111113]">💼 Services</option>
              <option value="Equipment" className="bg-[#111113]">🖥️ Equipment</option>
              <option value="Sales" className="bg-[#111113]">Sales (Inward)</option>
              <option value="Purchase" className="bg-[#111113]">Purchase (Outward)</option>
              <option value="Expense" className="bg-[#111113]">Expense</option>
              <option value="Credit Note" className="bg-[#111113]">Credit Note</option>
              <option value="Debit Note" className="bg-[#111113]">Debit Note</option>
            </select>
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1" id="category-filter-pills">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Categories:</span>
          
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              categoryFilter === "all"
                ? "bg-white/20 text-white shadow-sm"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            All ({invoices.length})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === "Utilities" ? "all" : "Utilities")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              categoryFilter === "Utilities"
                ? "bg-amber-500/25 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/40"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Utilities</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({invoices.filter(i => i.expenseCategory === "Utilities" || (i.category as string) === "Utilities").length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === "Software" ? "all" : "Software")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              categoryFilter === "Software"
                ? "bg-indigo-500/25 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/40"
                : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Software</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({invoices.filter(i => i.expenseCategory === "Software" || (i.category as string) === "Software").length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === "Services" ? "all" : "Services")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              categoryFilter === "Services"
                ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/40"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Services</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({invoices.filter(i => i.expenseCategory === "Services" || (i.category as string) === "Services").length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === "Equipment" ? "all" : "Equipment")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              categoryFilter === "Equipment"
                ? "bg-purple-500/25 border-purple-500/50 text-purple-300 ring-1 ring-purple-500/40"
                : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Equipment</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({invoices.filter(i => i.expenseCategory === "Equipment" || (i.category as string) === "Equipment").length})
            </span>
          </button>
        </div>
      </div>

      {/* Recurring Invoices Due Notification Banner */}
      {dueRecurringInvoices.length > 0 && (
        <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-6 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in" id="recurring-due-banner">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center space-x-2">
                <span>{dueRecurringInvoices.length} Recurring Invoice(s) Due</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
                  Action Required
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                These recurring invoices have reached their cycle date and are flagged as due or ready to auto-generate.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const generated = dueRecurringInvoices.map(inv => generateNextRecurringInvoice(inv));
                if (onBatchInvoicesCreated) {
                  onBatchInvoicesCreated(generated);
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              id="auto-generate-due-invoices-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Auto-Generate Due Invoices ({dueRecurringInvoices.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Sticky Bulk Actions Bar (When items are selected) */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-950/90 border-y border-indigo-500/30 px-5 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <span className="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedIds.size} Selected
            </span>
            <span className="text-xs text-indigo-200">
              Total Value: <b className="text-white font-mono">{formatRupees(selectedInvoices.reduce((s, i) => s + i.totalAmount, 0))}</b>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAutoTagModal(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              id="bulk-auto-tag-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-Tag Selected ({selectedIds.size})</span>
            </button>

            <button
              onClick={() => handleExportZip(selectedInvoices)}
              disabled={isExportingZip}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              id="bulk-download-zip-btn"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP Archive ({selectedIds.size} PDFs)</span>
            </button>

            <button
              onClick={handleExportStandard}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={clearSelection}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="overflow-x-auto" id="invoice-table-wrapper">
        <table className="w-full text-left border-collapse" id="invoice-main-table">
          <thead>
            <tr className="bg-white/5 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-white/5" id="table-head-row">
              <th className="py-3.5 px-4 w-10 text-center">
                <input 
                  type="checkbox"
                  checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  title="Select / Deselect all"
                />
              </th>
              <th className="py-3.5 px-5">Invoice Number & Date</th>
              <th className="py-3.5 px-5">Supplier & Customer Details</th>
              <th className="py-3.5 px-5">Type / Category</th>
              <th className="py-3.5 px-5 text-right">Taxable Value</th>
              <th className="py-3.5 px-5 text-right">Total Invoice Value</th>
              <th className="py-3.5 px-5 text-center">AI Tax Auditor Status</th>
              <th className="py-3.5 px-5 text-center">Payment Status</th>
              <th className="py-3.5 px-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5" id="table-body">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => {
                const audit = validateInvoice(inv, invoices);
                const isChecked = selectedIds.has(inv.id);
                return (
                  <tr 
                    key={inv.id}
                    className={`hover:bg-white/5 transition-colors group ${isChecked ? "bg-indigo-950/20" : ""}`}
                    id={`invoice-row-${inv.id}`}
                  >
                    {/* Multi-Select Checkbox */}
                    <td className="py-4 px-4 text-center">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectOne(inv.id)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </td>

                    {/* Invoice ID & Date */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <span className="font-mono text-sm font-bold text-white tracking-tight block cursor-pointer hover:text-indigo-400" onClick={() => onSelectInvoice(inv)}>
                          {inv.invoiceNumber}
                        </span>
                        <div className="flex items-center text-[11px] text-slate-500 space-x-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{inv.date}</span>
                        </div>
                      </div>
                    </td>

                    {/* Supplier & Customer */}
                    <td className="py-4 px-5">
                      <div className="space-y-1 max-w-[240px]">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-400 mr-1 text-[10px] uppercase">From:</span>
                          <span className="font-medium text-slate-200">{inv.supplierName}</span>
                          {inv.supplierGstin && (
                            <span className="font-mono text-[9px] bg-white/5 border border-white/5 text-slate-400 px-1 py-0.5 rounded block mt-0.5 max-w-[120px] truncate">
                              {inv.supplierGstin}
                            </span>
                          )}
                        </div>
                        <div className="text-xs border-t border-dashed border-white/5 pt-1">
                          <span className="font-semibold text-slate-400 mr-1 text-[10px] uppercase">To:</span>
                          <span className="font-medium text-slate-200">{inv.customerName}</span>
                          {inv.customerGstin && (
                            <span className="font-mono text-[9px] bg-white/5 border border-white/5 text-slate-400 px-1 py-0.5 rounded block mt-0.5 max-w-[120px] truncate">
                              {inv.customerGstin}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type / Category & AI Auto-Tags */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            inv.category === 'Sales' || inv.category === 'Export'
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : inv.category === 'Purchase' || inv.category === 'Expense'
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : "bg-white/5 text-slate-300 border border-white/5"
                          }`}>
                            {inv.category || "Sales"}
                          </span>

                          {inv.expenseCategory && (
                            <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                              categoryStyleMap[inv.expenseCategory]?.bg || 'bg-cyan-500/10'
                            } ${
                              categoryStyleMap[inv.expenseCategory]?.text || 'text-cyan-400'
                            } ${
                              categoryStyleMap[inv.expenseCategory]?.border || 'border-cyan-500/20'
                            }`}>
                              <span>{categoryStyleMap[inv.expenseCategory]?.icon || '🏷️'}</span>
                              <span>{inv.expenseCategory}</span>
                            </span>
                          )}

                          {inv.isRecurring && (
                            <span 
                              className="inline-flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
                              title={`Recurring: ${inv.recurringFrequency || 'monthly'}${inv.nextDueDate ? ` (Next: ${inv.nextDueDate})` : ''}`}
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span className="capitalize">{inv.recurringFrequency || "Recurring"}</span>
                            </span>
                          )}
                        </div>

                        {/* Tag pills if present */}
                        {inv.tags && inv.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {inv.tags.slice(0, 2).map((t, idx) => (
                              <span key={idx} className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.2 rounded">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Subtotal */}
                    <td className="py-4 px-5 text-right font-mono text-xs font-semibold text-slate-400">
                      {formatRupees(inv.subtotal)}
                    </td>

                    {/* Total Amount */}
                    <td className="py-4 px-5 text-right font-mono text-sm font-bold text-white">
                      {formatRupees(inv.totalAmount)}
                    </td>

                    {/* AI Auditor Checks */}
                    <td className="py-4 px-5 text-center">
                      {audit.passed ? (
                        <div className="inline-flex items-center space-x-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg text-[10px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Passed</span>
                        </div>
                      ) : (
                        <div 
                          onClick={() => onSelectInvoice(inv)}
                          className="inline-flex items-center space-x-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-rose-500/20 transition-colors"
                          title={audit.errors.join("\n")}
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>{audit.errors.length + audit.warnings.length} Issues</span>
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="py-4 px-5 text-center">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                          inv.status === 'paid' 
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                            : inv.status === 'partially_paid'
                            ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                            : inv.status === 'unpaid'
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                            : inv.status === 'overdue'
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                            : "bg-white/10 text-slate-400 border border-white/5"
                        }`}>
                          {inv.status === 'partially_paid' ? 'Partially Paid' : inv.status}
                        </span>
                        {inv.balanceDue !== undefined && inv.balanceDue > 0 && (
                          <span className="block text-[9px] font-mono text-amber-400">
                            Due: {formatRupees(inv.balanceDue)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* 1-Click Auto-Tag Button */}
                        <button
                          onClick={() => {
                            const classification = classifyInvoice(inv);
                            const updated: Invoice = {
                              ...inv,
                              category: inv.category === "Sales" ? "Expense" : (inv.category || "Expense"),
                              expenseCategory: classification.category,
                              tags: classification.suggestedTags
                            };
                            if (onUpdateInvoice) {
                              onUpdateInvoice(updated);
                            }
                          }}
                          className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/20 transition-all cursor-pointer"
                          title="Auto-Tag with Multi-Signal Engine (Categorize as Utilities, Software, Services, or Equipment)"
                          id={`autotag-row-btn-${inv.id}`}
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>

                        {/* Recurring Cycle Quick Generator Button */}
                        {inv.isRecurring && onBatchInvoicesCreated && (
                          <button
                            onClick={() => {
                              const newInv = generateNextRecurringInvoice(inv);
                              onBatchInvoicesCreated([newInv]);
                            }}
                            className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/20 transition-all cursor-pointer"
                            title={`Auto-generate next recurring cycle (${inv.recurringFrequency || 'monthly'})`}
                            id={`recurring-cycle-btn-${inv.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {onRecordPayment && inv.status !== 'paid' && (
                          <button
                            onClick={() => onRecordPayment(inv)}
                            className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                            title="Record Payment"
                            id={`record-payment-btn-${inv.id}`}
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="bg-white/5 text-slate-300 hover:bg-indigo-500/25 hover:text-indigo-400 p-1.5 rounded-lg border border-white/5 transition-all cursor-pointer"
                          title="View Details & Audit Report"
                          id={`view-btn-${inv.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteInvoice(inv.id)}
                          className="bg-white/5 text-slate-400 hover:bg-rose-500/25 hover:text-rose-400 p-1.5 rounded-lg border border-white/5 transition-all cursor-pointer"
                          title="Delete Record"
                          id={`delete-btn-${inv.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                  <div className="max-w-md mx-auto space-y-2">
                    <p className="font-semibold text-white">No invoices match your search or filter</p>
                    <p className="text-xs text-slate-500">
                      Try searching with a different phrase, clearing your filters, or generate a brand new invoice with AI!
                    </p>
                    <button 
                      onClick={onOpenCreateModal}
                      className="inline-flex items-center space-x-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-xl text-xs font-semibold mt-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Create New Invoice</span>
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer / Summary */}
      <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between text-xs text-slate-500" id="ledger-summary-footer">
        <span>Showing <b>{filteredInvoices.length}</b> of <b>{invoices.length}</b> records {selectedIds.size > 0 && `(${selectedIds.size} selected)`}</span>
        <span className="font-mono text-[10px]">InvoicePro LEDGER ENGINE v1.0</span>
      </div>

      {/* CSV Bulk Import Modal */}
      {showCsvImportModal && (
        <CsvImportModal
          onClose={() => setShowCsvImportModal(false)}
          onImportInvoices={async (importedInvoices) => {
            if (onBatchInvoicesCreated) {
              await onBatchInvoicesCreated(importedInvoices);
            }
          }}
        />
      )}

      {/* Automated Tagging Engine Modal */}
      {showAutoTagModal && (
        <AutoTaggingModal
          invoices={invoices}
          selectedIds={selectedIds.size > 0 ? selectedIds : undefined}
          onClose={() => setShowAutoTagModal(false)}
          onApplyBatchTags={async (updatedInvoices) => {
            if (onBatchInvoicesUpdated) {
              await onBatchInvoicesUpdated(updatedInvoices);
            } else if (onBatchInvoicesCreated) {
              await onBatchInvoicesCreated(updatedInvoices);
            }
          }}
        />
      )}
    </div>
  );
}

