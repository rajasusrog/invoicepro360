import React, { useState } from "react";
import { UserSubscription, SubscriptionTierId } from "../types";
import { 
  SUBSCRIPTION_PLANS, 
  ORDERED_PLAN_IDS, 
  formatInrPrice, 
  formatQuotaLabel 
} from "../utils/subscriptionPlans";
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Crown, 
  HelpCircle, 
  Mail, 
  Zap, 
  CheckCircle2, 
  Users, 
  FileText,
  Info,
  Clock,
  Layers
} from "lucide-react";

interface PlansAndPricingProps {
  subscription: UserSubscription | null;
  onSelectPlan?: (planId: SubscriptionTierId) => void;
}

export default function PlansAndPricing({ subscription, onSelectPlan }: PlansAndPricingProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<SubscriptionTierId | null>(null);

  const activePlanId: SubscriptionTierId = subscription?.planId || "basic";

  const handlePlanAction = (planId: SubscriptionTierId) => {
    setSelectedPlanForModal(planId);
    if (onSelectPlan) {
      onSelectPlan(planId);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up" id="plans-and-pricing-page">
      {/* Header Banner */}
      <div className="text-center space-y-3 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center space-x-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Flexible Enterprise Quotas</span>
        </div>

        <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight">
          Transparent plans built for every billing scale
        </h2>

        <p className="text-sm text-slate-400 font-medium leading-relaxed">
          Select the optimal plan for your GST compliance, AI invoice drafting, OCR extractions, and team seats. 
          <span className="block text-slate-500 text-xs mt-1">
            * All figures are in INR (₹). Subscription prices are configurable initial settings.
          </span>
        </p>

        {/* Monthly vs Annual Toggle */}
        <div className="pt-3 flex items-center justify-center space-x-3">
          <span className={`text-xs font-semibold ${billingCycle === "monthly" ? "text-white" : "text-slate-500"}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingCycle(b => b === "monthly" ? "annual" : "monthly")}
            className="w-12 h-6 bg-[#1f1f23] rounded-full p-1 border border-white/10 relative transition-colors cursor-pointer"
            id="billing-cycle-toggle"
            aria-label="Toggle billing cycle"
          >
            <div 
              className={`w-4 h-4 rounded-full bg-indigo-500 transition-transform ${
                billingCycle === "annual" ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-xs font-semibold flex items-center space-x-1.5 ${billingCycle === "annual" ? "text-white" : "text-slate-500"}`}>
            <span>Annual Billing</span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5 items-stretch" id="pricing-cards-grid">
        {ORDERED_PLAN_IDS.map((planId) => {
          const plan = SUBSCRIPTION_PLANS[planId];
          const isCurrent = activePlanId === planId;
          const isPopular = planId === "professional";

          // Calculate annual discounted price if applicable
          const displayPrice = billingCycle === "annual" && plan.priceInr > 0
            ? Math.round(plan.priceInr * 0.8)
            : plan.priceInr;

          return (
            <div
              key={planId}
              className={`bg-[#111113] rounded-2xl flex flex-col justify-between transition-all duration-200 relative ${
                isPopular
                  ? "border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                  : isCurrent
                  ? "border border-indigo-500/50 shadow-md"
                  : "border border-white/5 hover:border-white/15"
              } p-5`}
              id={`plan-card-${planId}`}
            >
              {/* Badges */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {isPopular && (
                  <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md">
                    Most Popular
                  </span>
                )}
                {isCurrent && (
                  <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md">
                    Current Plan
                  </span>
                )}
              </div>

              {/* Top Details */}
              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="font-display font-black text-white text-lg">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-400 min-h-[32px] mt-1 leading-snug">
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div className="pt-2 border-t border-white/5">
                  {plan.isContactUs ? (
                    <div className="space-y-0.5">
                      <span className="font-display font-black text-white text-2xl tracking-tight block">
                        Contact us
                      </span>
                      <span className="text-[11px] text-purple-400 font-semibold block">
                        Custom tailored pricing
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline space-x-1">
                        <span className="font-display font-black text-white text-2xl sm:text-3xl tracking-tight font-mono">
                          {formatInrPrice(displayPrice)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">/ month</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {displayPrice === 0 ? "Free forever" : (billingCycle === "annual" ? "Billed annually (Configurable)" : "Configurable initial rate")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quota Highlights Table */}
                <div className="bg-[#17171a] rounded-xl p-3 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Invoices / mo</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatQuotaLabel(plan.invoiceQuota)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>AI Generations</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatQuotaLabel(plan.aiGenerationQuota)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Clients / Vendors</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatQuotaLabel(plan.customerQuota)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Team Seats</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {plan.teamMemberQuota}
                    </span>
                  </div>
                </div>

                {/* Feature Checklist */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    What's Included:
                  </span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bottom Action Button */}
              <div className="pt-6">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 px-3 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-default"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Current Active Plan</span>
                  </button>
                ) : plan.isContactUs ? (
                  <button
                    onClick={() => handlePlanAction(planId)}
                    className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg shadow-purple-600/20"
                    id={`btn-contact-${planId}`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Contact us</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlanAction(planId)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      isPopular
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                    }`}
                    id={`btn-upgrade-${planId}`}
                  >
                    <span>Upgrade (Coming Soon)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Informative Security & Guarantee Notice */}
      <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0 border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-display font-bold text-white text-sm">
              Server-Enforced Quota Protection & Row Level Security
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              All invoice generations and AI quotas are atomically validated inside Cloudflare Pages Functions and Supabase PostgreSQL RPCs.
              Failed requests and validation errors do not consume your quotas.
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="text-[11px] text-slate-500 font-medium block">
            Pricing queries or custom enterprise setup?
          </span>
          <a
            href="mailto:support@invoicepro360.com?subject=Enterprise%20Subscription%20Inquiry"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center space-x-1 mt-0.5"
          >
            <span>Talk to Solutions Engineer</span>
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Plan Details / Contact Modal */}
      {selectedPlanForModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17171a] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-indigo-400" />
                <h3 className="font-display font-bold text-white text-base">
                  {SUBSCRIPTION_PLANS[selectedPlanForModal].name} Plan
                </h3>
              </div>
              <button
                onClick={() => setSelectedPlanForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                You selected the <b>{SUBSCRIPTION_PLANS[selectedPlanForModal].name}</b> tier with{" "}
                <b>{formatQuotaLabel(SUBSCRIPTION_PLANS[selectedPlanForModal].invoiceQuota)} invoices</b> and{" "}
                <b>{formatQuotaLabel(SUBSCRIPTION_PLANS[selectedPlanForModal].aiGenerationQuota)} AI generations</b> per month.
              </p>

              <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 p-3.5 rounded-xl space-y-1.5">
                <div className="flex items-center space-x-2 font-bold text-indigo-200">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Production Payment Integration Note</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  In accordance with financial compliance rules, paid subscriptions require verified payment gateway processing before plan elevation. Self-serve Razorpay / Stripe checkout activation will be enabled once merchant onboarding is completed.
                </p>
              </div>

              <p className="text-slate-400">
                To test higher limits or request an immediate trial upgrade for your company account, please contact our support team.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedPlanForModal(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <a
                href={`mailto:billing@invoicepro360.com?subject=Upgrade%20to%20${SUBSCRIPTION_PLANS[selectedPlanForModal].name}&body=Please%20upgrade%20my%20account%20to%20the%20${SUBSCRIPTION_PLANS[selectedPlanForModal].name}%20plan.`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact Billing</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
