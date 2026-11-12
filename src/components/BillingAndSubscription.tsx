import React, { useState, useEffect } from "react";
import { UserSubscription, SubscriptionTierId, BillingCycle, SubscriptionPaymentRecord } from "../types";
import { 
  SUBSCRIPTION_PLANS, 
  ORDERED_PLAN_IDS, 
  formatInrPrice, 
  formatQuotaLabel 
} from "../utils/subscriptionPlans";
import { 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  FileText, 
  CreditCard, 
  Users, 
  Zap, 
  Download, 
  Receipt,
  HelpCircle,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import CheckoutModal from "./CheckoutModal";
import { getSession } from "../lib/supabase";

interface BillingAndSubscriptionProps {
  subscription: UserSubscription | null;
  onRefreshSubscription: () => Promise<void>;
}

export default function BillingAndSubscription({
  subscription,
  onRefreshSubscription
}: BillingAndSubscriptionProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionTierId | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<SubscriptionPaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const activePlanId: SubscriptionTierId = subscription?.planId || "basic";
  const activePlan = SUBSCRIPTION_PLANS[activePlanId];

  // Calculate days remaining in period
  const calculateDaysRemaining = (): number => {
    if (!subscription?.currentPeriodEnd) return 30;
    const diffMs = new Date(subscription.currentPeriodEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = calculateDaysRemaining();
  const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
  const isExpired = daysRemaining === 0 && subscription?.planId !== "basic";

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      return new Date(isoString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return isoString;
    }
  };

  // Fetch user's payment history
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const session = await getSession();
        if (session?.access_token) {
          const res = await fetch("/api/payment/history", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setPaymentHistory(data.payments || []);
          }
        }
      } catch (err) {
        console.error("Error loading payment history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [subscription]);

  // Check if user came from public pricing with an intended plan
  useEffect(() => {
    const intended = sessionStorage.getItem("intended_plan_checkout");
    if (intended && (intended === "standard" || intended === "professional" || intended === "elite")) {
      sessionStorage.removeItem("intended_plan_checkout");
      setSelectedPlanForCheckout(intended as SubscriptionTierId);
      setIsCheckoutOpen(true);
    }
  }, []);

  const handleSelectPlan = (planId: SubscriptionTierId) => {
    if (planId === "basic") {
      return; // Basic is default free plan
    }
    if (planId === "ultra") {
      window.location.href = "mailto:sales@unikorn360.com?subject=InvoicePro%20360%20Ultra%20Enterprise%20Inquiry";
      return;
    }
    setSelectedPlanForCheckout(planId);
    setIsCheckoutOpen(true);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="text-emerald-400 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Paid</span>;
      case "failed":
        return <span className="text-rose-400 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>Failed</span>;
      case "refunded":
        return <span className="text-amber-400 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Refunded</span>;
      default:
        return <span className="text-slate-400 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Pending</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up" id="billing-and-subscription-page">
      {/* Expiry Advisory Banner */}
      {isExpiringSoon && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Your <strong className="text-white capitalize">{activePlan.name}</strong> subscription period ends in{" "}
              <strong>{daysRemaining} day{daysRemaining > 1 ? "s" : ""}</strong> on {formatDate(subscription?.currentPeriodEnd)}. Renew or upgrade now to avoid quota interruption.
            </span>
          </div>
          <button
            onClick={() => handleSelectPlan(activePlanId)}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold rounded-lg text-xs transition-colors shrink-0"
          >
            Renew Subscription
          </button>
        </div>
      )}

      {isExpired && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Your subscription period expired on {formatDate(subscription?.currentPeriodEnd)}. Please renew your plan to restore full invoice and AI generation quotas.
            </span>
          </div>
          <button
            onClick={() => handleSelectPlan(activePlanId)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
          >
            Reactivate Plan
          </button>
        </div>
      )}

      {/* 1. Current Plan & Quota Status Section */}
      <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono uppercase text-indigo-400 font-bold tracking-wider">
                  Active Subscription
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  {subscription?.status || "Active"}
                </span>
              </div>
              <h2 className="text-2xl font-bold font-display text-white mt-0.5">
                {activePlan.name} Tier
              </h2>
            </div>
          </div>

          <div className="flex flex-col sm:items-end text-left sm:text-right text-xs text-slate-400 space-y-1">
            <div className="flex items-center sm:justify-end gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Current Period: <strong className="text-white">{formatDate(subscription?.currentPeriodStart)}</strong> to <strong className="text-white">{formatDate(subscription?.currentPeriodEnd)}</strong></span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {daysRemaining > 0 ? (
                <span className="text-emerald-400 font-semibold">{daysRemaining} days remaining in cycle</span>
              ) : (
                <span className="text-rose-400 font-semibold">Cycle completed</span>
              )}
            </div>
          </div>
        </div>

        {/* Quota Progress Meters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Invoice Usage */}
          <div className="bg-[#0c0c0e] border border-white/5 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-white">Monthly Invoices</span>
              <FileText className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {subscription?.invoicesUsed ?? 0}{" "}
              <span className="text-xs text-slate-500 font-normal">
                / {formatQuotaLabel(subscription?.invoiceQuota ?? activePlan.invoiceQuota)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ 
                  width: `${Math.min(100, (subscription?.invoiceQuota ?? activePlan.invoiceQuota) > 0 
                    ? ((subscription?.invoicesUsed ?? 0) / (subscription?.invoiceQuota ?? activePlan.invoiceQuota)) * 100 
                    : 0)}%` 
                }}
              />
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>{subscription?.invoicesRemaining ?? 0} remaining</span>
              <span>Resets {formatDate(subscription?.currentPeriodEnd)}</span>
            </div>
          </div>

          {/* AI Generations */}
          <div className="bg-[#0c0c0e] border border-white/5 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-white">AI Generations</span>
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {subscription?.aiGenerationsUsed ?? 0}{" "}
              <span className="text-xs text-slate-500 font-normal">
                / {formatQuotaLabel(subscription?.aiGenerationQuota ?? activePlan.aiGenerationQuota)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 transition-all"
                style={{ 
                  width: `${Math.min(100, (subscription?.aiGenerationQuota ?? activePlan.aiGenerationQuota) > 0 
                    ? ((subscription?.aiGenerationsUsed ?? 0) / (subscription?.aiGenerationQuota ?? activePlan.aiGenerationQuota)) * 100 
                    : 0)}%` 
                }}
              />
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>{subscription?.aiGenerationsRemaining ?? 0} remaining</span>
              <span>Resets {formatDate(subscription?.currentPeriodEnd)}</span>
            </div>
          </div>

          {/* Customer / Vendor Directory Quota */}
          <div className="bg-[#0c0c0e] border border-white/5 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-white">Customer Directory</span>
              <Users className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {formatQuotaLabel(subscription?.customerQuota ?? activePlan.customerQuota)}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Maximum active customer & vendor profiles
            </p>
          </div>

          {/* Team Seats */}
          <div className="bg-[#0c0c0e] border border-white/5 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-white">Team Member Seats</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {subscription?.teamMemberQuota ?? activePlan.teamMemberQuota} seat(s)
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Concurrent collaborative accounting users
            </p>
          </div>
        </div>
      </div>

      {/* 2. Plan Switcher & Pricing Grid */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold font-display text-white">Upgrade or Switch Plan</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Change your tier instantly. All payments are verified on server before quota activation.
            </p>
          </div>

          {/* Billing Cycle Switch */}
          <div className="flex items-center space-x-3 bg-[#111113] border border-white/5 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                billingCycle === "monthly" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                billingCycle === "annual" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {ORDERED_PLAN_IDS.map((planId) => {
            const plan = SUBSCRIPTION_PLANS[planId];
            const isCurrent = activePlanId === planId;
            const isPopular = planId === "professional";

            const displayPrice = billingCycle === "annual" && plan.priceInr > 0
              ? Math.round(plan.priceInr * 0.8)
              : plan.priceInr;

            return (
              <div
                key={planId}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "bg-[#141418] border-indigo-500/40 shadow-lg shadow-indigo-950/20"
                    : isPopular
                    ? "bg-[#111113] border-indigo-500/20 hover:border-indigo-500/40"
                    : "bg-[#111113] border-white/5 hover:border-white/10"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">{plan.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <span className="text-2xl font-black font-mono text-white">
                      {formatInrPrice(displayPrice, plan.isContactUs)}
                    </span>
                    {!plan.isContactUs && plan.priceInr > 0 && (
                      <span className="text-xs text-slate-500 font-normal"> /mo</span>
                    )}
                  </div>
                  {billingCycle === "annual" && plan.priceInr > 0 && (
                    <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      Billed annually (₹{(displayPrice * 12).toLocaleString("en-IN")}/yr)
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Invoices:</span>
                      <span className="font-mono font-bold">{formatQuotaLabel(plan.invoiceQuota)} / mo</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">AI Gens:</span>
                      <span className="font-mono font-bold">{formatQuotaLabel(plan.aiGenerationQuota)} / mo</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Directory:</span>
                      <span className="font-mono font-bold">{formatQuotaLabel(plan.customerQuota)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Team Seats:</span>
                      <span className="font-mono font-bold">{plan.teamMemberQuota}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-white/5 text-slate-400 font-bold text-xs cursor-not-allowed border border-white/5"
                    >
                      Active Plan
                    </button>
                  ) : plan.isContactUs ? (
                    <button
                      onClick={() => handleSelectPlan(planId)}
                      className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/10"
                    >
                      Contact Sales
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(planId)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                        isPopular
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                          : "bg-white hover:bg-slate-100 text-slate-900"
                      }`}
                    >
                      <span>Upgrade to {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Feature Comparison Matrix */}
      <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-4">
        <h3 className="text-lg font-bold font-display text-white">Full Feature Comparison Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Feature / Capability</th>
                <th className="py-3 px-3 text-center">Basic (₹0)</th>
                <th className="py-3 px-3 text-center">Standard (₹499)</th>
                <th className="py-3 px-3 text-center bg-indigo-500/5 text-indigo-300">Professional (₹1,499)</th>
                <th className="py-3 px-3 text-center">Elite (₹3,999)</th>
                <th className="py-3 px-3 text-center">Ultra (Enterprise)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              <tr>
                <td className="py-3 px-4 font-medium text-white">Monthly Successful Invoices</td>
                <td className="py-3 px-3 text-center font-mono">10</td>
                <td className="py-3 px-3 text-center font-mono">50</td>
                <td className="py-3 px-3 text-center font-mono bg-indigo-500/5 font-bold text-white">300</td>
                <td className="py-3 px-3 text-center font-mono">1,000</td>
                <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white">Monthly AI Generations</td>
                <td className="py-3 px-3 text-center font-mono">5</td>
                <td className="py-3 px-3 text-center font-mono">25</td>
                <td className="py-3 px-3 text-center font-mono bg-indigo-500/5 font-bold text-white">150</td>
                <td className="py-3 px-3 text-center font-mono">500</td>
                <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold">2,500</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white">Smart OCR Image Scanning</td>
                <td className="py-3 px-3 text-center text-slate-600">—</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400 bg-indigo-500/5">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white">AI Ledger Copilot Chat</td>
                <td className="py-3 px-3 text-center text-slate-600">—</td>
                <td className="py-3 px-3 text-center text-slate-600">—</td>
                <td className="py-3 px-3 text-center text-emerald-400 bg-indigo-500/5 font-bold">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white">Multi-LLM Failover (Gemini + OpenAI)</td>
                <td className="py-3 px-3 text-center text-slate-600">—</td>
                <td className="py-3 px-3 text-center text-slate-600">—</td>
                <td className="py-3 px-3 text-center text-slate-600 bg-indigo-500/5">—</td>
                <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white">GST Calculation & E-way Support</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400 bg-indigo-500/5">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
                <td className="py-3 px-3 text-center text-emerald-400">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Payment & Invoice History Section */}
      <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold font-display text-white">Payment & Billing History</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified order transactions, payment references, and tax receipts.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {paymentHistory.length} Record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Order / Payment ID</th>
                <th className="py-3 px-4">Subscription Plan</th>
                <th className="py-3 px-4">Base Fee</th>
                <th className="py-3 px-4">18% GST</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loadingHistory ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    Loading payment records...
                  </td>
                </tr>
              ) : paymentHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No billing transactions found for this account.
                  </td>
                </tr>
              ) : (
                paymentHistory.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {formatDate(p.paidAt || p.createdAt)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                      <div>{p.gatewayPaymentId || p.gatewayOrderId || p.id.slice(0, 8)}</div>
                      {p.manualAdminGranted && (
                        <span className="text-[10px] text-amber-400">Admin Granted</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold capitalize text-white">
                      {p.planName} ({p.billingCycle})
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      ₹{(p.amountInr - (p.taxInr || 0)).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                      ₹{(p.taxInr || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-white">
                      ₹{p.amountInr.toLocaleString("en-IN")} {p.currency}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {statusBadge(p.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout Modal */}
      {selectedPlanForCheckout && (
        <CheckoutModal
          planId={selectedPlanForCheckout}
          billingCycle={billingCycle}
          isOpen={isCheckoutOpen}
          onClose={() => {
            setIsCheckoutOpen(false);
            setSelectedPlanForCheckout(null);
          }}
          onSuccess={async () => {
            await onRefreshSubscription();
          }}
        />
      )}
    </div>
  );
}
