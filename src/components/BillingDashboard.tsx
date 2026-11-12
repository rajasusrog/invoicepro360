import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Loader2,
  Receipt,
  Calendar
} from "lucide-react";
import { UserSubscription, SubscriptionTierId, BillingCycle } from "../types";
import {
  BillingSubscriptionSummary,
  BillingPaymentItem,
  fetchUserBillingDashboard,
  requestSubscriptionCancellation,
  formatPaiseToInr,
  formatQuotaDisplay
} from "../lib/billing";

interface BillingDashboardProps {
  subscription: UserSubscription | null;
  onRefreshSubscription: () => Promise<void>;
  onNavigateToPricing: (cycle?: BillingCycle) => void;
  onSelectPlanForCheckout: (planCode: SubscriptionTierId, cycle: BillingCycle) => void;
}

export default function BillingDashboard({
  subscription,
  onRefreshSubscription,
  onNavigateToPricing,
  onSelectPlanForCheckout
}: BillingDashboardProps) {
  const [subSummary, setSubSummary] = useState<BillingSubscriptionSummary | null>(null);
  const [payments, setPayments] = useState<BillingPaymentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await fetchUserBillingDashboard();
      setSubSummary(data.subscription);
      setPayments(data.payments || []);
    } catch (err) {
      console.warn("Error loading billing dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [subscription]);

  const handleCancelSubscription = async (mode: "period_end" | "immediate") => {
    setCancelling(true);
    setFeedbackBanner(null);
    try {
      const res = await requestSubscriptionCancellation(mode);
      setSubSummary(res.subscription);
      setCancelModalOpen(false);
      setFeedbackBanner({
        type: "success",
        text: res.message
      });
      await onRefreshSubscription();
    } catch (err: any) {
      setFeedbackBanner({
        type: "error",
        text: err.message || "Unable to cancel subscription."
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return iso;
    }
  };

  const activePlanCode: SubscriptionTierId = subSummary?.planCode || subscription?.planId || "basic";
  const activePlanName = subSummary?.planName || subscription?.planName || "Basic";
  const billingModel = subSummary?.billingModel || subscription?.billingModel || "free";
  const isLifetime = Boolean(subSummary?.lifetimeEntitlement || billingModel === "lifetime");
  const isRecurring = billingModel === "monthly" || billingModel === "annual";
  const cancelAtPeriodEnd = Boolean(subSummary?.cancelAtPeriodEnd);
  const status = subSummary?.status || subscription?.status || "active";

  const invoicesUsed = subSummary?.invoicesUsed ?? subscription?.invoicesUsed ?? 0;
  const invoiceQuota = subSummary?.invoiceQuota ?? subscription?.invoiceQuota ?? 10;
  const aiUsed = subSummary?.aiGenerationsUsed ?? subscription?.aiGenerationsUsed ?? 0;
  const aiQuota = subSummary?.aiQuota ?? subscription?.aiGenerationQuota ?? 5;

  const invPercent =
    invoiceQuota <= 0 ? 15 : Math.min(100, Math.round((invoicesUsed / invoiceQuota) * 100));
  const aiPercent =
    aiQuota <= 0 ? 15 : Math.min(100, Math.round((aiUsed / aiQuota) * 100));

  const renderStatusText = (st: string) => {
    switch (st) {
      case "active":
      case "captured":
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>Active / Paid</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <Clock className="w-4 h-4" />
            <span>Pending Confirmation</span>
          </span>
        );
      case "past_due":
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <XCircle className="w-4 h-4" />
            <span>Payment Failed / Past Due</span>
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <AlertCircle className="w-4 h-4" />
            <span>Refunded</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#526176] capitalize">
            <span>{st}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8" id="billing-dashboard-container">
      {/* Page Title & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DFD5] pb-5">
        <div>
          <h1 className="text-[28px] font-bold text-[#0B1426] tracking-tight">
            Billing & Subscription
          </h1>
          <p className="text-[15px] text-[#526176] mt-1">
            Manage your commercial plan, inspect monthly resetting invoice and AI quotas, and review verified payment history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToPricing()}
          className="px-5 py-2.5 rounded-xl bg-[#0B1426] hover:bg-[#162442] text-white text-sm font-semibold inline-flex items-center gap-2 self-start transition-colors cursor-pointer"
          id="compare-all-plans-btn"
        >
          <span>Compare Plans & Upgrade</span>
          <ArrowUpRight className="w-4 h-4 text-[#C49A36]" />
        </button>
      </div>

      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            feedbackBanner.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : "bg-red-50 border-red-300 text-red-950"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-semibold underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Grid: Active Entitlement Card + Monthly Allowance Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Plan Overview */}
        <div className="bg-white border border-[#E4DFD5] rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#526176]">
                Current Entitlement
              </span>
              {renderStatusText(status)}
            </div>

            <div>
              <h2 className="text-[20px] font-bold text-[#0B1426] flex items-center gap-2">
                <span>{activePlanName} Plan</span>
                <span className="text-xs font-medium text-[#526176] capitalize">
                  · {isLifetime ? "Lifetime Access" : billingModel}
                </span>
              </h2>
              <p className="text-sm text-[#526176] mt-1">
                {isLifetime
                  ? "Perpetual feature tier access with monthly resetting quotas."
                  : isRecurring
                  ? cancelAtPeriodEnd
                    ? `Scheduled to end on ${formatDate(subSummary?.currentPeriodEnd)} (no further charges).`
                    : `Next renewal date: ${formatDate(subSummary?.currentPeriodEnd)}`
                  : "Default free GST invoicing workspace."}
              </p>
            </div>

            <div className="pt-3 border-t border-[#E4DFD5] space-y-2 text-sm text-[#263449]">
              <div className="flex items-center justify-between">
                <span className="text-[#526176]">Monthly Allowance Reset</span>
                <span className="font-semibold tabular-nums">
                  {formatDate(subSummary?.usagePeriodEnd || subscription?.currentPeriodEnd)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526176]">Customer Directory Limit</span>
                <span className="font-semibold tabular-nums">
                  {formatQuotaDisplay(subSummary?.customerQuota ?? subscription?.customerQuota ?? 25)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526176]">Team Member Seats</span>
                <span className="font-semibold tabular-nums">
                  {subSummary?.teamQuota ?? subscription?.teamMemberQuota ?? 1}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E4DFD5] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateToPricing()}
              className="px-4 py-2 rounded-xl bg-[#0B1426] hover:bg-[#162442] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {activePlanCode === "basic" ? "Upgrade Plan" : "Change Plan"}
            </button>

            {isRecurring && !cancelAtPeriodEnd && status === "active" && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#F6F5F1] text-[#263449] border border-[#E4DFD5] text-sm font-semibold transition-colors cursor-pointer"
                id="open-cancel-modal-btn"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Monthly Quota Consumption Meters */}
        <div className="lg:col-span-2 bg-white border border-[#E4DFD5] rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#E4DFD5] pb-3">
            <div>
              <h2 className="text-[20px] font-bold text-[#0B1426]">
                Monthly Quota & Usage Counters
              </h2>
              <p className="text-sm text-[#526176]">
                Failed creations never consume quota. Batch imports validate the entire batch before saving.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Quota Bar */}
            <div className="p-5 rounded-xl bg-[#F6F5F1] border border-[#E4DFD5] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0B1426]">
                  Monthly GST Invoices
                </span>
                <span className="text-sm font-bold text-[#0B1426] tabular-nums">
                  {invoicesUsed} / {formatQuotaDisplay(invoiceQuota)}
                </span>
              </div>
              <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-[#E4DFD5]">
                <div
                  className={`h-full transition-all ${
                    invPercent >= 90 ? "bg-red-600" : invPercent >= 75 ? "bg-amber-600" : "bg-[#0B1426]"
                  }`}
                  style={{ width: `${invPercent}%` }}
                />
              </div>
              <p className="text-xs text-[#526176]">
                {invoiceQuota === -1
                  ? "Fair-use unlimited monthly invoice creation active."
                  : `${Math.max(0, invoiceQuota - invoicesUsed)} invoice(s) remaining in current monthly cycle.`}
              </p>
            </div>

            {/* AI Generation Quota Bar */}
            <div className="p-5 rounded-xl bg-[#F6F5F1] border border-[#E4DFD5] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0B1426]">
                  Monthly AI Generations
                </span>
                <span className="text-sm font-bold text-[#0B1426] tabular-nums">
                  {aiUsed} / {formatQuotaDisplay(aiQuota)}
                </span>
              </div>
              <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-[#E4DFD5]">
                <div
                  className={`h-full transition-all ${
                    aiPercent >= 90 ? "bg-red-600" : aiPercent >= 75 ? "bg-amber-600" : "bg-[#C49A36]"
                  }`}
                  style={{ width: `${aiPercent}%` }}
                />
              </div>
              <p className="text-xs text-[#526176]">
                Independent of invoice count. Covers AI text drafting, OCR extraction, and AI Copilot queries.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E4DFD5] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#526176]">
            <span>
              Recurring Invoice Quota Policy: Auto-due recurring invoices check your remaining monthly allowance before generating a new ledger record.
            </span>
            <button
              type="button"
              onClick={() => onSelectPlanForCheckout("professional", "annual")}
              className="text-[#0B1426] font-semibold hover:underline whitespace-nowrap cursor-pointer"
            >
              Need higher monthly limits? Upgrade to Professional →
            </button>
          </div>
        </div>
      </div>

      {/* Verified Payment History Table */}
      <div className="bg-white border border-[#E4DFD5] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4DFD5] flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-[#0B1426]">
              Payment & Subscription History
            </h2>
            <p className="text-sm text-[#526176]">
              Verified transactions recorded in integer paise with GST breakdown.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#526176] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#0B1426]" />
            <span>Loading payment history...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Receipt className="w-7 h-7 text-[#526176] mx-auto" />
            <div className="text-base font-semibold text-[#0B1426]">
              No Commercial Payments Recorded Yet
            </div>
            <p className="text-sm text-[#526176] max-w-md mx-auto">
              When you subscribe to a Monthly, Annual, or Lifetime tier, your verified Razorpay receipts and tax breakdowns will appear here.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToPricing()}
              className="px-4 py-2 rounded-xl bg-[#0B1426] text-white text-sm font-semibold cursor-pointer"
            >
              Explore Commercial Plans
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F6F5F1] border-b border-[#E4DFD5] text-[#0B1426] font-semibold">
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-4">Plan & Cycle</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4 text-right">Base Amount</th>
                  <th className="py-3.5 px-4 text-right">GST (18%)</th>
                  <th className="py-3.5 px-4 text-right">Total Paid</th>
                  <th className="py-3.5 px-4">Gateway Ref</th>
                  <th className="py-3.5 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD5] text-[#263449]">
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-[#F6F5F1]/60 transition-colors">
                    <td className="py-3.5 px-6 tabular-nums whitespace-nowrap">
                      {formatDate(pay.paidAt || pay.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#0B1426] capitalize">
                      {pay.planName} ({pay.billingCycle})
                    </td>
                    <td className="py-3.5 px-4 text-[#526176]">
                      {pay.paymentType === "one_time_lifetime"
                        ? "Lifetime Purchase"
                        : pay.paymentType === "manual_admin"
                        ? "Admin Grant"
                        : "Recurring Subscription"}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      {formatPaiseToInr(pay.baseAmountPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      {formatPaiseToInr(pay.taxAmountPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-[#0B1426] tabular-nums">
                      {formatPaiseToInr(pay.amountPaise)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#526176]">
                      {pay.razorpayPaymentId || pay.razorpayOrderId || pay.razorpaySubscriptionId || "—"}
                    </td>
                    <td className="py-3.5 px-6">{renderStatusText(pay.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Dialog */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFD5] rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <h3 className="text-[20px] font-bold text-[#0B1426]">
              Cancel Recurring Subscription
            </h3>
            <p className="text-sm text-[#263449] leading-relaxed">
              Choose how you would like to cancel your <strong className="text-[#0B1426]">{activePlanName}</strong> subscription:
            </p>

            <div className="space-y-3">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => handleCancelSubscription("period_end")}
                className="w-full p-4 rounded-xl border border-[#E4DFD5] hover:border-[#C49A36] text-left transition-colors cursor-pointer"
                id="cancel-at-period-end-btn"
              >
                <div className="text-sm font-bold text-[#0B1426]">
                  Cancel at Period End (Recommended)
                </div>
                <div className="text-xs text-[#526176] mt-1">
                  Stop future renewals while keeping your current plan quotas until {formatDate(subSummary?.currentPeriodEnd)}.
                </div>
              </button>

              <button
                type="button"
                disabled={cancelling}
                onClick={() => handleCancelSubscription("immediate")}
                className="w-full p-4 rounded-xl border border-red-200 hover:bg-red-50 text-left transition-colors cursor-pointer"
                id="cancel-immediately-btn"
              >
                <div className="text-sm font-bold text-red-700">
                  Cancel Immediately
                </div>
                <div className="text-xs text-[#526176] mt-1">
                  End subscription immediately and revert your workspace to the Basic free limits (10 invoices / month).
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E4DFD5]">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E4DFD5] text-sm font-semibold text-[#526176] hover:text-[#0B1426] cursor-pointer"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
