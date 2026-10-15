import React from "react";
import { AlertCircle, Calendar, ArrowRight, ShieldAlert, Sparkles, FileText, X } from "lucide-react";
import { SubscriptionTierId } from "../types";
import { SUBSCRIPTION_PLANS, formatQuotaLabel } from "../utils/subscriptionPlans";

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "ai" | "invoice";
  used?: number;
  limit?: number;
  resetDate?: string;
  planId?: string;
  onViewPlans: () => void;
}

export default function QuotaExceededModal({
  isOpen,
  onClose,
  type,
  used,
  limit,
  resetDate,
  planId = "basic",
  onViewPlans
}: QuotaExceededModalProps) {
  if (!isOpen) return null;

  const currentPlan = SUBSCRIPTION_PLANS[(planId as SubscriptionTierId)] || SUBSCRIPTION_PLANS.basic;

  let formattedDate = "your next billing cycle";
  let daysRemaining: number | null = null;

  if (resetDate) {
    const d = new Date(resetDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      const diffMs = d.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  const isAi = type === "ai";
  const quotaName = isAi ? "AI Invoice Generations" : "Successful Invoices";
  const quotaLimit = limit !== undefined ? limit : (isAi ? currentPlan.aiGenerationQuota : currentPlan.invoiceQuota);
  const quotaUsed = used !== undefined ? used : quotaLimit;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-[#17171a] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-scale-up"
        id="quota-exceeded-modal"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg text-sm cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Title */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl shrink-0">
            {isAi ? <Sparkles className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-block mb-1">
              Monthly Limit Reached
            </span>
            <h3 className="font-display font-bold text-white text-lg">
              {quotaName} Quota Exceeded
            </h3>
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            You have used all <b>{quotaUsed} of {formatQuotaLabel(quotaLimit)}</b> {quotaName.toLowerCase()} included in your <b>{currentPlan.name}</b> plan for the current monthly period.
          </p>

          {/* Reset Date Callout */}
          <div className="bg-[#111113] border border-white/5 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Automatic Monthly Reset
              </span>
              <span className="text-white font-medium block">
                Resets on <b>{formattedDate}</b> {daysRemaining !== null ? `(in ${daysRemaining} days)` : ""}
              </span>
            </div>
          </div>

          <p className="text-slate-400">
            To create more invoices or generate additional drafts using AI immediately, consider upgrading to Standard, Professional, or Elite.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              onClose();
              onViewPlans();
            }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
            id="view-plans-from-modal-btn"
          >
            <span>View Plans & Upgrade</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
