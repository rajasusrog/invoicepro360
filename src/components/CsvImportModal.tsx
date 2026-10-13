import React, { useState, useRef } from "react";
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  X, 
  Download, 
  Loader2, 
  Check, 
  Trash2, 
  FileCheck, 
  Eye, 
  Building2, 
  Calendar,
  Sparkles
} from "lucide-react";
import { Invoice } from "../types";
import { formatRupees, triggerFileDownload, categoryStyleMap } from "../utils/invoiceUtils";
import { parseInvoicesFromCSV, generateSampleCsvTemplate, CsvParseResult } from "../utils/csvImportUtils";

interface CsvImportModalProps {
  onClose: () => void;
  onImportInvoices: (invoices: Invoice[]) => Promise<void> | void;
}

export default function CsvImportModal({ onClose, onImportInvoices }: CsvImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      setImportError("Please upload a valid .CSV file.");
      return;
    }

    setSelectedFile(file);
    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const result = parseInvoicesFromCSV(text);
          setParseResult(result);
          setSelectedRowIds(new Set(result.invoices.map(inv => inv.id)));
          if (result.invoices.length === 0 && result.errors.length > 0) {
            setImportError(result.errors.join("; "));
          }
        } catch (err: any) {
          console.error("CSV Parse Exception:", err);
          setImportError(err.message || "Failed to parse CSV file structure.");
        }
      }
    };
    reader.onerror = () => {
      setImportError("Failed to read the uploaded CSV file.");
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleCsvTemplate();
    triggerFileDownload("sample_invoices_ledger_template.csv", csvContent, "text/csv");
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRowIds(prev => {
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
    if (!parseResult) return;
    if (selectedRowIds.size === parseResult.invoices.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(parseResult.invoices.map(inv => inv.id)));
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.invoices.length === 0) return;

    const invoicesToImport = parseResult.invoices.filter(inv => selectedRowIds.has(inv.id));
    if (invoicesToImport.length === 0) {
      setImportError("Please select at least one invoice to import.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      await onImportInvoices(invoicesToImport);
      setIsImporting(false);
      setImportSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error("Bulk Import Execution Error:", err);
      setImportError(err?.message || "Failed to save imported invoices to the database.");
      setIsImporting(false);
    }
  };

  const selectedInvoices = parseResult ? parseResult.invoices.filter(inv => selectedRowIds.has(inv.id)) : [];
  const totalImportValue = selectedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="csv-import-modal-root">
      <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-lg flex items-center space-x-2">
                  <span>Import Invoices from CSV</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Bulk Database Engine
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Bulk upload accounting records, ERP exports, or vendor bills directly into your verified enterprise ledger
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/5 transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Download formatted CSV spreadsheet template"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sample Template</span>
            </button>

            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {importError && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2 animate-fade-in">
            <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {/* Success Alert */}
        {importSuccess && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs flex items-center space-x-3 animate-fade-in">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-400">Bulk Invoices Imported Successfully!</p>
              <p className="text-emerald-300/80">
                Created {selectedInvoices.length} invoice records in the database. Updating ledger...
              </p>
            </div>
          </div>
        )}

        {/* File Upload Zone */}
        {!parseResult ? (
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                dragActive 
                  ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]" 
                  : "border-white/10 hover:border-indigo-500 hover:bg-white/5 bg-black/30"
              }`}
              id="csv-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <Upload className="w-7 h-7 animate-bounce" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  Click to upload or drag & drop your CSV file here
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Supports standard accounting CSVs, Tally, Zoho, QuickBooks, and InvoicePro export templates.
                </p>
              </div>

              <span className="text-[10px] font-mono bg-white/5 text-slate-400 px-2.5 py-1 rounded-full border border-white/5">
                .CSV Files up to 10MB
              </span>
            </div>

            {/* Helper Instructions */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2 text-xs text-slate-300">
              <p className="font-bold text-white flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auto-Mapping & Automatic GST Computation</span>
              </p>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Our CSV parser automatically maps invoice numbers, supplier/customer details, state GST classifications, and line items. If tax breakdowns are omitted, standard GST brackets (18%) and balanced totals will be automatically calculated.
              </p>
            </div>
          </div>
        ) : (
          /* Parsed Invoices Preview & Validation Table */
          <div className="space-y-4 animate-fade-in">
            {/* Summary Bar */}
            <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <FileCheck className="w-4.5 h-4.5 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    Parsed {parseResult.invoices.length} Invoices from <span className="font-mono text-emerald-300">{selectedFile?.name}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Selected: <b className="text-emerald-400">{selectedInvoices.length}</b> • Total Value: <b className="text-white">{formatRupees(totalImportValue)}</b>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => { setParseResult(null); setSelectedFile(null); }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/5 transition-colors cursor-pointer"
                >
                  Choose Different File
                </button>
              </div>
            </div>

            {/* Warnings list if any */}
            {parseResult.warnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl space-y-1 text-xs text-amber-300">
                <p className="font-bold flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Parse Notices ({parseResult.warnings.length}):</span>
                </p>
                <div className="max-h-20 overflow-y-auto space-y-0.5 text-[11px] text-amber-300/80 pr-1 font-mono">
                  {parseResult.warnings.slice(0, 3).map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                  {parseResult.warnings.length > 3 && (
                    <p>+ {parseResult.warnings.length - 3} more notices...</p>
                  )}
                </div>
              </div>
            )}

            {/* Invoices Preview Table */}
            <div className="overflow-x-auto max-h-72 rounded-xl border border-white/5 bg-[#161618]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="p-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.size === parseResult.invoices.length && parseResult.invoices.length > 0}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Invoice # & Date</th>
                    <th className="p-3">Supplier (From)</th>
                    <th className="p-3">Customer (To)</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Taxable</th>
                    <th className="p-3 text-right">Total Value</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {parseResult.invoices.map((inv) => {
                    const isChecked = selectedRowIds.has(inv.id);
                    const catStyle = categoryStyleMap[inv.expenseCategory || 'Other'] || categoryStyleMap['Other'];

                    return (
                      <tr 
                        key={inv.id} 
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${isChecked ? "bg-emerald-950/20" : ""}`}
                        onClick={() => toggleSelectOne(inv.id)}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(inv.id)}
                            className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-white">
                          <div>{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{inv.date}</div>
                        </td>
                        <td className="p-3 font-medium text-slate-200 truncate max-w-[150px]">
                          {inv.supplierName}
                        </td>
                        <td className="p-3 text-slate-300 truncate max-w-[150px]">
                          {inv.customerName}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            <span>{catStyle.icon}</span>
                            <span>{inv.expenseCategory || inv.category}</span>
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-300">
                          {formatRupees(inv.subtotal)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">
                          {formatRupees(inv.totalAmount)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            inv.status === 'paid' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : inv.status === 'overdue'
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
              <span className="text-xs text-slate-400">
                Ready to insert <b>{selectedInvoices.length}</b> records into persistent database
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isImporting}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isImporting || selectedInvoices.length === 0}
                  onClick={handleConfirmImport}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all flex items-center space-x-2 shadow-sm cursor-pointer hover:scale-[1.02] disabled:opacity-50"
                  id="confirm-import-csv-btn"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Import {selectedInvoices.length} Invoices</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
