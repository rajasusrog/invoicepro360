import React, { useState, useEffect } from "react";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CreditCard,
  FileText,
  Sparkles,
  Users
} from "lucide-react";
import { SubscriptionTierId, BillingCycle } from "../types";
import {
  BillingPlanVariant,
  fetchBillingCatalogue,
  formatPaiseToInr,
  formatQuotaDisplay
} from "../lib/billing";

interface PricingPageProps {
  currentPlanCode?: SubscriptionTierId;
  currentBillingModel?: string;
  isAuthenticated: boolean;
  onSelectPlanForCheckout: (planCode: SubscriptionTierId, billingCycle: BillingCycle) => void;
  onBackToApp?: () => void;
}

const ORDERED_TIER_CODES: SubscriptionTierId[] = [
  "basic",
  "standard",
  "professional",
  "elite",
  "ultra"
];

export default function PricingPage({
  currentPlanCode = "basic",
  currentBillingModel = "free",
  isAuthenticated,
  onSelectPlanForCheckout,
  onBackToApp
}: PricingPageProps) {
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [plans, setPlans] = useState<BillingPlanVariant[]>([]);
  const [gatewayConfigured, setGatewayConfigured] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBillingCatalogue();
        if (!mounted) return;
        setPlans(data.plans || []);
        setGatewayConfigured(Boolean(data.gatewayConfigured));
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || "Unable to load subscription plans.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const cyclePlans = ORDERED_TIER_CODES.map((code) =>
    plans.find((p) => p.planCode === code && p.billingCycle === selectedCycle)
  ).filter(Boolean) as BillingPlanVariant[];

  return (
    <div className="space-y-8" id="pricing-page-container">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E4DFD5] pb-6">
        <div>
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#526176] hover:text-[#0B1426] mb-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Workspace</span>
            </button>
          )}
          <h1 className="text-[28px] font-bold text-[#0B1426] tracking-tight leading-tight">
            Plans & Commercial Pricing
          </h1>
          <p className="text-[15px] text-[#526176] mt-1">
            Choose Monthly recurring, Annual recurring (with monthly quota resets), or a one-time Lifetime tier purchase.
          </p>
        </div>

        {/* Billing Cycle Selector: Monthly | Annual | Lifetime */}
        <div
          className="inline-flex items-center bg-white border border-[#E4DFD5] p-1 rounded-xl self-start"
          role="tablist"
          aria-label="Billing Cycle Selection"
          id="billing-cycle-selector"
        >
          {(
            [
              { id: "monthly", label: "Monthly" },
              { id: "annual", label: "Annual (Save 20%)" },
              { id: "lifetime", label: "Lifetime Access" }
            ] as { id: BillingCycle; label: string }[]
          ).map((tab) => {
            const active = selectedCycle === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCycle(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-[#0B1426] text-white border-b-2 border-[#C49A36]"
                    : "text-[#526176] hover:text-[#0B1426]"
                }`}
                id={`cycle-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gateway Configuration Advisory if Secrets are Unset */}
      {!loading && !gatewayConfigured && (
        <div
          className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-3"
          id="pricing-gateway-notice"
        >
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">
              Payment Gateway Setup Pending
            </p>
            <p className="text-[#263449]">
              You can review all plan quotas and order summaries below. Live payment activation requires server-side Razorpay configuration (<code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">RAZORPAY_KEY_ID</code> and <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">RAZORPAY_KEY_SECRET</code>).
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-900 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#E4DFD5] rounded-xl p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#0B1426]" />
          <p className="text-sm font-medium text-[#526176]">Loading plan catalogue...</p>
        </div>
      ) : (
        <>
          {/* 5-Tier Plan Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-stretch" id="pricing-tiers-grid">
            {cyclePlans.map((plan) => {
              const isCurrentPlan =
                isAuthenticated &&
                currentPlanCode === plan.planCode &&
                (plan.planCode === "basic" ? currentBillingModel === "free" : currentBillingModel === plan.billingCycle);
              const isHighlighted = plan.planCode === "professional";
              const isPriceUnset = plan.pricePaise === null;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl p-6 flex flex-col justify-between transition-all ${
                    isHighlighted
                      ? "border-2 border-[#C49A36] shadow-sm"
                      : "border border-[#E4DFD5]"
                  }`}
                  id={`pricing-card-${plan.planCode}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-[20px] font-bold text-[#0B1426]">
                        {plan.planName}
                      </h2>
                      {isHighlighted && (
                        <span className="text-xs font-semibold text-[#0B1426] bg-[#F6F5F1] border border-[#C49A36] px-2.5 py-0.5 rounded-md">
                          Recommended
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[#526176] min-h-[42px] leading-relaxed">
                      {plan.description}
                    </p>

                    {/* Price Block */}
                    <div className="pt-2 pb-4 border-b border-[#E4DFD5]">
                      {isPriceUnset ? (
                        <div>
                          <div className="text-xl font-bold text-[#0B1426] tabular-nums">
                            Custom Pricing
                          </div>
                          <div className="text-xs text-[#526176] mt-1">
                            Price unset · Enterprise configuration required
                          </div>
                        </div>
                      ) : plan.pricePaise === 0 ? (
                        <div>
                          <div className="text-2xl font-bold text-[#0B1426] tabular-nums">
                            ₹0
                          </div>
                          <div className="text-xs text-[#526176] mt-1">
                            Free forever · Monthly quota reset
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-[#0B1426] tabular-nums">
                              {formatPaiseToInr(plan.pricePaise)}
                            </span>
                            <span className="text-xs text-[#526176] font-medium">
                              {plan.billingCycle === "monthly"
                                ? "/ month + GST"
                                : plan.billingCycle === "annual"
                                ? "/ year + GST"
                                : "one-time + GST"}
                            </span>
                          </div>
                          <div className="text-xs text-[#526176] mt-1 tabular-nums">
                            Total incl. 18% GST: {formatPaiseToInr(plan.totalAmountPaise)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Core Quotas Summary */}
                    <div className="space-y-2 text-sm text-[#263449] pb-3 border-b border-[#E4DFD5]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#526176]">Monthly Invoices</span>
                        <span className="font-semibold tabular-nums">
                          {formatQuotaDisplay(plan.invoiceQuota)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#526176]">Monthly AI Credits</span>
                        <span className="font-semibold tabular-nums">
                          {formatQuotaDisplay(plan.aiQuota)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#526176]">Customer Directory</span>
                        <span className="font-semibold tabular-nums">
                          {formatQuotaDisplay(plan.customerQuota)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#526176]">Team Seats</span>
                        <span className="font-semibold tabular-nums">
                          {plan.teamQuota} {plan.teamQuota === 1 ? "seat" : "seats"}
                        </span>
                      </div>
                    </div>

                    {/* Feature List */}
                    <ul className="space-y-2.5 text-sm text-[#263449]">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#C49A36] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action CTA */}
                  <div className="pt-6 mt-6 border-t border-[#E4DFD5]">
                    {isCurrentPlan ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl bg-[#F6F5F1] text-[#526176] border border-[#E4DFD5] text-sm font-semibold cursor-default"
                      >
                        Current Active Plan
                      </button>
                    ) : plan.planCode === "basic" ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl bg-[#F6F5F1] text-[#526176] border border-[#E4DFD5] text-sm font-semibold cursor-default"
                      >
                        Included Free Tier
                      </button>
                    ) : isPriceUnset ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 rounded-xl bg-[#F6F5F1] text-[#526176] border border-[#E4DFD5] text-sm font-semibold cursor-not-allowed"
                          id={`checkout-disabled-${plan.planCode}`}
                        >
                          Checkout Disabled (Price Unset)
                        </button>
                        <p className="text-xs text-[#526176] text-center">
                          {plan.configurationStatusMessage}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectPlanForCheckout(plan.planCode, plan.billingCycle)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#0B1426] hover:bg-[#162442] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        id={`select-plan-btn-${plan.planCode}`}
                      >
                        <span>
                          {isAuthenticated ? `Select ${plan.planName}` : `Sign in to Select`}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#C49A36]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comprehensive Quota & Entitlement Comparison Table */}
          <div className="bg-white border border-[#E4DFD5] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4DFD5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-[20px] font-bold text-[#0B1426]">
                  Tier Quota & Entitlement Matrix
                </h2>
                <p className="text-sm text-[#526176]">
                  Annual subscriptions bill once per year while invoice and AI allowances reset every month. Lifetime purchases provide perpetual access to your tier with monthly resetting fair-use allowances.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F6F5F1] border-b border-[#E4DFD5] text-[#0B1426] font-semibold">
                    <th className="py-3.5 px-6">Capability / Allowance</th>
                    <th className="py-3.5 px-4">Basic</th>
                    <th className="py-3.5 px-4">Standard</th>
                    <th className="py-3.5 px-4">Professional</th>
                    <th className="py-3.5 px-4">Elite</th>
                    <th className="py-3.5 px-4">Ultra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DFD5] text-[#263449]">
                  <tr>
                    <td className="py-3.5 px-6 font-medium">Monthly GST Invoices</td>
                    <td className="py-3.5 px-4 tabular-nums">10 / month</td>
                    <td className="py-3.5 px-4 tabular-nums">50 / month</td>
                    <td className="py-3.5 px-4 tabular-nums font-semibold">300 / month</td>
                    <td className="py-3.5 px-4 tabular-nums">1,000 / month</td>
                    <td className="py-3.5 px-4">Configurable Fair-Use</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-medium">Monthly AI Generations</td>
                    <td className="py-3.5 px-4 tabular-nums">5 / month</td>
                    <td className="py-3.5 px-4 tabular-nums">25 / month</td>
                    <td className="py-3.5 px-4 tabular-nums font-semibold">150 / month</td>
                    <td className="py-3.5 px-4 tabular-nums">500 / month</td>
                    <td className="py-3.5 px-4 tabular-nums">2,500 / month</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-medium">Customer & Vendor Directory</td>
                    <td className="py-3.5 px-4 tabular-nums">25 records</td>
                    <td className="py-3.5 px-4 tabular-nums">100 records</td>
                    <td className="py-3.5 px-4 tabular-nums">500 records</td>
                    <td className="py-3.5 px-4 tabular-nums">2,000 records</td>
                    <td className="py-3.5 px-4">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-medium">Workspace Team Seats</td>
                    <td className="py-3.5 px-4 tabular-nums">1 seat</td>
                    <td className="py-3.5 px-4 tabular-nums">1 seat</td>
                    <td className="py-3.5 px-4 tabular-nums">3 seats</td>
                    <td className="py-3.5 px-4 tabular-nums">10 seats</td>
                    <td className="py-3.5 px-4 tabular-nums">25+ seats</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-medium">Quota Reset Schedule</td>
                    <td className="py-3.5 px-4">Monthly</td>
                    <td className="py-3.5 px-4">Monthly</td>
                    <td className="py-3.5 px-4">Monthly</td>
                    <td className="py-3.5 px-4">Monthly</td>
                    <td className="py-3.5 px-4">Monthly</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
