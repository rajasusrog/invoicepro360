import React from "react";
import { Calendar, ArrowRight, Sparkles, FileText, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 bg-[#0B1426]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white border border-[#E4DFD5] rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl relative"
        id="quota-exceeded-modal"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#526176] hover:text-[#0B1426] p-1 rounded-lg text-sm cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Title */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl shrink-0">
            {isAi ? <Sparkles className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-800 tracking-wider bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 inline-block mb-1">
              Monthly Limit Reached
            </span>
            <h3 className="font-bold text-[#0B1426] text-lg">
              {quotaName} Quota Exceeded
            </h3>
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="space-y-3 text-sm text-[#263449] leading-relaxed">
          <p>
            You have used all <b>{quotaUsed} of {formatQuotaLabel(quotaLimit)}</b> {quotaName.toLowerCase()} included in your <b>{currentPlan.name}</b> plan for the current monthly period.
          </p>

          {/* Reset Date Callout */}
          <div className="bg-[#F6F5F1] border border-[#E4DFD5] rounded-xl p-3.5 flex items-center space-x-3">
            <div className="p-2 bg-[#0B1426] text-[#C49A36] rounded-lg shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-[#526176] font-bold uppercase tracking-wider block">
                Automatic Monthly Reset
              </span>
              <span className="text-[#0B1426] font-medium text-xs block">
                Resets on <b>{formattedDate}</b> {daysRemaining !== null ? `(in ${daysRemaining} days)` : ""}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#526176]">
            To create more invoices or generate additional drafts using AI immediately, upgrade to Standard, Professional, or Elite (Monthly, Annual, or Lifetime).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#E4DFD5]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#F6F5F1] hover:bg-[#E4DFD5]/70 text-[#263449] border border-[#E4DFD5] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              onClose();
              onViewPlans();
            }}
            className="px-4 py-2 bg-[#0B1426] hover:bg-[#162442] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            id="view-plans-from-modal-btn"
          >
            <span>View Plans & Upgrade</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#C49A36]" />
          </button>
        </div>
      </div>
    </div>
  );
}
