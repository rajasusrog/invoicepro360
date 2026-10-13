import React, { useState, useMemo } from "react";
import { Invoice } from "../types";
import { 
  CoreExpenseCategory, 
  CATEGORY_DEFINITIONS, 
  batchClassifyInvoices,
  classifyInvoice 
} from "../utils/taggingEngine";
import { formatRupees } from "../utils/invoiceUtils";
import { 
  Sparkles, 
  Tag, 
  CheckCircle2, 
  Zap, 
  Terminal, 
  Briefcase, 
  Cpu, 
  X, 
  ArrowRight, 
  Layers, 
  Check, 
  AlertCircle,
  HelpCircle,
  Loader2
} from "lucide-react";

interface AutoTaggingModalProps {
  invoices: Invoice[];
  selectedIds?: Set<string>;
  onClose: () => void;
  onApplyBatchTags: (updatedInvoices: Invoice[]) => Promise<void>;
}

export default function AutoTaggingModal({
  invoices,
  selectedIds,
  onClose,
  onApplyBatchTags
}: AutoTaggingModalProps) {
  const [activeCategoryTab, setActiveCategoryTab] = useState<"ALL" | CoreExpenseCategory>("ALL");
  const [selectedToApply, setSelectedToApply] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Filter invoices to process: if selectedIds are provided and non-empty, process only those, else all
  const invoicesToProcess = useMemo(() => {
    if (selectedIds && selectedIds.size > 0) {
      return invoices.filter(inv => selectedIds.has(inv.id));
    }
    return invoices;
  }, [invoices, selectedIds]);

  // Run the classification engine
  const classificationResult = useMemo(() => {
    return batchClassifyInvoices(invoicesToProcess);
  }, [invoicesToProcess]);

  // Initialize all to selected by default
  React.useEffect(() => {
    const allIds = new Set(classificationResult.classifiedInvoices.map(c => c.invoiceId));
    setSelectedToApply(allIds);
  }, [classificationResult]);

  const toggleSelectInvoice = (id: string) => {
    const next = new Set(selectedToApply);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedToApply(next);
  };

  const handleSelectAll = () => {
    if (selectedToApply.size === classificationResult.classifiedInvoices.length) {
      setSelectedToApply(new Set());
    } else {
      setSelectedToApply(new Set(classificationResult.classifiedInvoices.map(c => c.invoiceId)));
    }
  };

  const handleApply = async () => {
    if (selectedToApply.size === 0) return;
    setIsApplying(true);
    try {
      const invoicesToSave = classificationResult.classifiedInvoices
        .filter(c => selectedToApply.has(c.invoiceId))
        .map(c => c.updatedInvoice);

      await onApplyBatchTags(invoicesToSave);
      setAppliedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error("Error applying batch categorization:", err);
    } finally {
      setIsApplying(false);
    }
  };

  const filteredClassifications = useMemo(() => {
    if (activeCategoryTab === "ALL") {
      return classificationResult.classifiedInvoices;
    }
    return classificationResult.classifiedInvoices.filter(c => c.newCategory === activeCategoryTab);
  }, [classificationResult, activeCategoryTab]);

  const getCategoryIcon = (category: CoreExpenseCategory) => {
    switch (category) {
      case "Utilities":
        return <Zap className="w-4 h-4 text-amber-400" />;
      case "Software":
        return <Terminal className="w-4 h-4 text-indigo-400" />;
      case "Services":
        return <Briefcase className="w-4 h-4 text-emerald-400" />;
      case "Equipment":
        return <Cpu className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="auto-tagging-modal">
      <div className="bg-[#111113] border border-white/10 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#141417]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-bold text-white text-lg">
                  Automated Invoice Tagging Engine
                </h3>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Heuristic Multi-Signal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Categorizing ledger records into <span className="text-amber-400 font-semibold">Utilities</span>, <span className="text-indigo-400 font-semibold">Software</span>, <span className="text-emerald-400 font-semibold">Services</span>, or <span className="text-purple-400 font-semibold">Equipment</span> using vendor metadata & line item HSNs.
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors cursor-pointer"
            id="close-autotag-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Breakdown Cards */}
        <div className="px-6 py-4 bg-[#0d0d0f] border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["Utilities", "Software", "Services", "Equipment"] as CoreExpenseCategory[]).map(cat => {
            const count = classificationResult.countsByCategory[cat] || 0;
            const meta = CATEGORY_DEFINITIONS[cat];
            const isSelected = activeCategoryTab === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryTab(isSelected ? "ALL" : cat)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected 
                    ? `${meta.badgeBg} ${meta.badgeBorder} ring-1 ring-white/20` 
                    : "bg-white/5 border-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(cat)}
                    <span className="font-bold text-xs text-white">{cat}</span>
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${meta.badgeBg} ${meta.badgeText} border ${meta.badgeBorder}`}>
                    {count}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{meta.description}</p>
              </button>
            );
          })}
        </div>

        {/* Filter bar & Selection controls */}
        <div className="px-6 py-3 bg-[#111113] border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5"
            >
              <Check className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {selectedToApply.size === classificationResult.classifiedInvoices.length ? "Deselect All" : "Select All"}
              </span>
            </button>
            <span className="text-slate-500">
              Selected <b>{selectedToApply.size}</b> of <b>{classificationResult.classifiedInvoices.length}</b> invoices
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveCategoryTab("ALL")}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeCategoryTab === "ALL" 
                  ? "bg-white/20 text-white font-bold" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Categories ({classificationResult.totalProcessed})
            </button>
          </div>
        </div>

        {/* List of Classified Invoices */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#0a0a0c]" id="classified-invoices-list">
          {filteredClassifications.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-white text-sm">No invoices found for category {activeCategoryTab}</p>
              <p className="text-xs text-slate-500">Try switching to another category or viewing all.</p>
            </div>
          ) : (
            filteredClassifications.map(item => {
              const invoice = item.updatedInvoice;
              const meta = CATEGORY_DEFINITIONS[item.newCategory];
              const isChecked = selectedToApply.has(item.invoiceId);

              return (
                <div 
                  key={item.invoiceId}
                  onClick={() => toggleSelectInvoice(item.invoiceId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isChecked 
                      ? "bg-[#141418] border-white/15 hover:border-indigo-500/40" 
                      : "bg-[#0f0f11] border-white/5 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div
                      className="mt-1 rounded bg-[#1e1e21] border-white/20 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                          {invoice.invoiceNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-300 truncate max-w-[200px]">
                          {invoice.supplierName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({invoice.date})
                        </span>
                        <span className="text-xs font-bold text-indigo-400 font-mono">
                          {formatRupees(invoice.totalAmount)}
                        </span>
                      </div>

                      {/* Items sample snippet */}
                      <p className="text-xs text-slate-400 truncate">
                        <b className="text-slate-500">Items:</b> {invoice.items.map(i => `${i.description} (x${i.quantity})`).join(", ")}
                      </p>

                      {/* Matched signal reason */}
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">{item.reason}</span>
                      </div>

                      {/* Suggested Tags Pill Row */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.tags.slice(0, 4).map((t, idx) => (
                          <span 
                            key={idx}
                            className="text-[10px] bg-white/5 text-slate-300 px-2 py-0.5 rounded-md border border-white/5 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right side Category Badge */}
                  <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 gap-2">
                    <div className="flex items-center space-x-1.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}>
                        {getCategoryIcon(item.newCategory)}
                        <span>{item.newCategory}</span>
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400">
                      Confidence: <b className="text-white">{item.confidence}%</b>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#141417] border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {appliedSuccess ? (
              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Successfully categorized and tagged {selectedToApply.size} invoices!</span>
              </span>
            ) : (
              <span>Ready to tag <b>{selectedToApply.size}</b> invoices with automated category classifications.</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || selectedToApply.size === 0 || appliedSuccess}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all cursor-pointer"
              id="apply-autotags-btn"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Categorizing & Tagging...</span>
                </>
              ) : appliedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Tags Applied!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Apply Categories & Tags ({selectedToApply.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
