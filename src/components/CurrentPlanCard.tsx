import React from "react";
import { UserSubscription, SubscriptionTierId } from "../types";
import { SUBSCRIPTION_PLANS, formatInrPrice, formatQuotaLabel } from "../utils/subscriptionPlans";
import { 
  Sparkles, 
  FileText, 
  Clock, 
  ArrowUpRight, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Crown,
  ShieldCheck,
  CreditCard
} from "lucide-react";

interface CurrentPlanCardProps {
  subscription: UserSubscription | null;
  onUpgradeClick: () => void;
  className?: string;
}

export default function CurrentPlanCard({ subscription, onUpgradeClick, className = "" }: CurrentPlanCardProps) {
  const planId: SubscriptionTierId = subscription?.planId || "basic";
  const planConfig = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.basic;

  const invoicesUsed = subscription?.invoicesUsed ?? 0;
  const invoiceQuota = subscription?.invoiceQuota ?? planConfig.invoiceQuota;
  const isInvoiceUnlimited = invoiceQuota === -1;
  const invoicePercent = isInvoiceUnlimited 
    ? 0 
    : Math.min(100, Math.round((invoicesUsed / invoiceQuota) * 100));

  const aiUsed = subscription?.aiGenerationsUsed ?? 0;
  const aiQuota = subscription?.aiGenerationQuota ?? planConfig.aiGenerationQuota;
  const isAiUnlimited = aiQuota === -1;
  const aiPercent = isAiUnlimited 
    ? 0 
    : Math.min(100, Math.round((aiUsed / aiQuota) * 100));

  // Compute days until reset
  const resetDateStr = subscription?.currentPeriodEnd;
  let daysUntilReset = 30;
  let formattedResetDate = "Next billing cycle";

  if (resetDateStr) {
    const end = new Date(resetDateStr);
    if (!isNaN(end.getTime())) {
      formattedResetDate = end.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      const diffMs = end.getTime() - Date.now();
      daysUntilReset = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Tier badge styling
  const badgeColors: Record<SubscriptionTierId, { bg: string; text: string; border: string }> = {
    basic: { bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/20" },
    standard: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    professional: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
    elite: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    ultra: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/30" }
  };
  const currentBadge = badgeColors[planId] || badgeColors.basic;

  return (
    <div className={`bg-[#111113] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden ${className}`} id="current-plan-card">
      {/* Background subtle ambient gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Plan identity & pricing */}
        <div className="space-y-3 max-w-sm">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-black text-white text-lg tracking-tight">
                  {planConfig.name} Plan
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}>
                  {subscription?.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {planConfig.isContactUs ? (
                  <span className="text-purple-400 font-semibold">Custom Enterprise Pricing</span>
                ) : (
                  <span>
                    <b className="text-white font-mono">{formatInrPrice(planConfig.priceInr)}</b> / month
                  </span>
                )}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {planConfig.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatQuotaLabel(planConfig.customerQuota)} Customers</span>
            </span>
            <span className="flex items-center space-x-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>{planConfig.teamMemberQuota} Team {planConfig.teamMemberQuota > 1 ? "Seats" : "Seat"}</span>
            </span>
          </div>
        </div>

        {/* Center: Usage progress bars */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {/* Invoice Quota Progress */}
          <div className="bg-[#17171a] border border-white/5 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center space-x-1.5 font-bold text-slate-200">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Monthly Invoices</span>
              </span>
              <span className="font-mono text-slate-300 font-semibold">
                <b className="text-white">{invoicesUsed}</b> / {formatQuotaLabel(invoiceQuota)}
              </span>
            </div>

            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  invoicePercent >= 100 ? "bg-rose-500" :
                  invoicePercent >= 80 ? "bg-amber-500" :
                  "bg-indigo-500"
                }`}
                style={{ width: `${isInvoiceUnlimited ? (invoicesUsed > 0 ? 15 : 0) : invoicePercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>{isInvoiceUnlimited ? "Unlimited fair use" : `${invoicePercent}% consumed`}</span>
              {isInvoiceUnlimited ? (
                <span className="text-indigo-400 font-semibold">Active</span>
              ) : (
                <span className={invoiceQuota - invoicesUsed <= 2 ? "text-amber-400 font-semibold" : ""}>
                  {Math.max(0, invoiceQuota - invoicesUsed)} remaining
                </span>
              )}
            </div>
          </div>

          {/* AI Generations Quota Progress */}
          <div className="bg-[#17171a] border border-white/5 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center space-x-1.5 font-bold text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>AI Generations</span>
              </span>
              <span className="font-mono text-slate-300 font-semibold">
                <b className="text-white">{aiUsed}</b> / {formatQuotaLabel(aiQuota)}
              </span>
            </div>

            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  aiPercent >= 100 ? "bg-rose-500" :
                  aiPercent >= 80 ? "bg-amber-500" :
                  "bg-purple-500"
                }`}
                style={{ width: `${isAiUnlimited ? (aiUsed > 0 ? 15 : 0) : aiPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>{isAiUnlimited ? "High volume" : `${aiPercent}% consumed`}</span>
              <span className={!isAiUnlimited && aiQuota - aiUsed <= 2 ? "text-amber-400 font-semibold" : ""}>
                {isAiUnlimited ? "High limit" : `${Math.max(0, aiQuota - aiUsed)} remaining`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Reset countdown & Upgrade Action */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0">
          <div className="text-left lg:text-right space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center lg:justify-end space-x-1">
              <Clock className="w-3 h-3" />
              <span>Next Monthly Reset</span>
            </span>
            <p className="text-xs font-semibold text-slate-300 font-mono">
              {formattedResetDate}
            </p>
            <span className="text-[10px] text-indigo-400 font-medium">
              in {daysUntilReset} {daysUntilReset === 1 ? "day" : "days"}
            </span>
          </div>

          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
            id="current-plan-upgrade-btn"
          >
            <span>Change Plan & Upgrade</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
