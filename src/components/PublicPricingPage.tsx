import React, { useState } from "react";
import { 
  SUBSCRIPTION_PLANS, 
  ORDERED_PLAN_IDS, 
  formatInrPrice, 
  formatQuotaLabel 
} from "../utils/subscriptionPlans";
import { 
  Check, 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  ArrowLeft, 
  ArrowRight, 
  FileCheck2, 
  HelpCircle, 
  Zap, 
  Lock, 
  DollarSign
} from "lucide-react";
import { SubscriptionTierId, BillingCycle } from "../types";

interface PublicPricingPageProps {
  onSignInWithPlan: (planId?: SubscriptionTierId) => void;
  onReturnToLogin: () => void;
}

export default function PublicPricingPage({
  onSignInWithPlan,
  onReturnToLogin
}: PublicPricingPageProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-300 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#111113]/90 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            onClick={onReturnToLogin}
            className="flex items-center space-x-2.5 cursor-pointer"
          >
            <div className="bg-indigo-600 text-white p-2 rounded-xl flex items-center justify-center font-bold">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-black text-white text-base tracking-tight">InvoicePro 360</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                Pricing & Quotas
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onReturnToLogin}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
            <button
              onClick={() => onSignInWithPlan()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise GST & AI Quota Plans</span>
          </div>

          <h1 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight leading-tight">
            Predictable billing designed for every Indian business
          </h1>

          <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
            From sole proprietors needing quick GST-compliant PDF invoicing to large multi-client accounting practices requiring high-speed OCR and Gemini AI drafting.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="pt-4 flex items-center justify-center space-x-3">
            <span className={`text-xs font-semibold ${billingCycle === "monthly" ? "text-white" : "text-slate-500"}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setBillingCycle(b => b === "monthly" ? "annual" : "monthly")}
              className="w-12 h-6 bg-[#1f1f23] rounded-full p-1 border border-white/10 relative transition-colors cursor-pointer"
              aria-label="Toggle billing interval"
            >
              <div 
                className={`w-4 h-4 rounded-full bg-indigo-500 transition-transform ${
                  billingCycle === "annual" ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-xs font-semibold flex items-center space-x-1.5 ${billingCycle === "annual" ? "text-white" : "text-slate-500"}`}>
              <span>Annual Billing</span>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                20% OFF
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5 items-stretch">
          {ORDERED_PLAN_IDS.map((planId) => {
            const plan = SUBSCRIPTION_PLANS[planId];
            const isPopular = planId === "professional";

            const displayPrice = billingCycle === "annual" && plan.priceInr > 0
              ? Math.round(plan.priceInr * 0.8)
              : plan.priceInr;

            return (
              <div
                key={planId}
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isPopular
                    ? "bg-[#141418] border-indigo-500/40 shadow-xl shadow-indigo-950/30 relative"
                    : "bg-[#111113] border-white/5 hover:border-white/10"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-mono text-[10px] uppercase font-bold px-3 py-0.5 rounded-full tracking-wider border border-indigo-400/30 shadow">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-lg">{plan.name}</span>
                    {planId === "basic" && (
                      <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">Starter</span>
                    )}
                  </div>

                  <div className="mt-4">
                    <span className="text-3xl font-black font-mono text-white">
                      {formatInrPrice(displayPrice, plan.isContactUs)}
                    </span>
                    {!plan.isContactUs && plan.priceInr > 0 && (
                      <span className="text-xs text-slate-500 font-normal"> /mo</span>
                    )}
                  </div>
                  {billingCycle === "annual" && plan.priceInr > 0 && (
                    <div className="text-[11px] text-emerald-400 font-mono mt-1">
                      Billed annually (₹{(displayPrice * 12).toLocaleString("en-IN")}/yr)
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mt-6 pt-5 border-t border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Monthly Invoices:</span>
                      <span className="font-mono font-bold text-white">{formatQuotaLabel(plan.invoiceQuota)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">AI Generations:</span>
                      <span className="font-mono font-bold text-white">{formatQuotaLabel(plan.aiGenerationQuota)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Directory:</span>
                      <span className="font-mono font-bold text-white">{formatQuotaLabel(plan.customerQuota)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Team Seats:</span>
                      <span className="font-mono font-bold text-white">{plan.teamMemberQuota} seat(s)</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                      Included Capabilities
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-400">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start space-x-2">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span className="leading-tight">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5">
                  {plan.isContactUs ? (
                    <a
                      href="mailto:sales@unikorn360.com?subject=InvoicePro%20360%20Ultra%20Enterprise%20Inquiry"
                      className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/10 flex items-center justify-center space-x-1.5"
                    >
                      <span>Contact Enterprise</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  ) : planId === "basic" ? (
                    <button
                      onClick={() => onSignInWithPlan("basic")}
                      className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors border border-white/10 flex items-center justify-center space-x-1.5"
                    >
                      <span>Get Started Free</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onSignInWithPlan(planId)}
                      className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                        isPopular
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                          : "bg-white hover:bg-slate-100 text-slate-900"
                      }`}
                    >
                      <span>Get {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold font-display text-white">Compare Plans In Detail</h2>
            <p className="text-xs text-slate-400">Everything you need to scale your tax bookkeeping and billing operations.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-3 px-4">Feature / Limit</th>
                  <th className="py-3 px-3 text-center">Basic (₹0)</th>
                  <th className="py-3 px-3 text-center">Standard (₹499)</th>
                  <th className="py-3 px-3 text-center bg-indigo-500/5 text-indigo-300">Professional (₹1,499)</th>
                  <th className="py-3 px-3 text-center">Elite (₹3,999)</th>
                  <th className="py-3 px-3 text-center">Ultra (Custom)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Monthly Invoices Quota</td>
                  <td className="py-3.5 px-3 text-center font-mono">10</td>
                  <td className="py-3.5 px-3 text-center font-mono">50</td>
                  <td className="py-3.5 px-3 text-center font-mono bg-indigo-500/5 font-bold text-white">300</td>
                  <td className="py-3.5 px-3 text-center font-mono">1,000</td>
                  <td className="py-3.5 px-3 text-center font-mono text-emerald-400 font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Monthly AI Generations</td>
                  <td className="py-3.5 px-3 text-center font-mono">5</td>
                  <td className="py-3.5 px-3 text-center font-mono">25</td>
                  <td className="py-3.5 px-3 text-center font-mono bg-indigo-500/5 font-bold text-white">150</td>
                  <td className="py-3.5 px-3 text-center font-mono">500</td>
                  <td className="py-3.5 px-3 text-center font-mono text-emerald-400 font-bold">2,500</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">OCR Invoice Scanning</td>
                  <td className="py-3.5 px-3 text-center text-slate-600">—</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400">✓</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400 bg-indigo-500/5 font-bold">✓</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400">✓</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">AI Ledger Copilot Chat</td>
                  <td className="py-3.5 px-3 text-center text-slate-600">—</td>
                  <td className="py-3.5 px-3 text-center text-slate-600">—</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400 bg-indigo-500/5 font-bold">✓</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400">✓</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Multi-LLM Failover (Gemini + OpenAI)</td>
                  <td className="py-3.5 px-3 text-center text-slate-600">—</td>
                  <td className="py-3.5 px-3 text-center text-slate-600">—</td>
                  <td className="py-3.5 px-3 text-center text-slate-600 bg-indigo-500/5">—</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-3.5 px-3 text-center text-emerald-400 font-bold">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQs Section */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold font-display text-white">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-400">Common questions about plans, quotas, GST compliance, and billing.</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#111113] border border-white/5 space-y-1">
              <h4 className="text-sm font-bold text-white">When are invoice quotas deducted?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                An invoice quota is only deducted after an invoice is successfully created and persisted to PostgreSQL. Validation errors or failed requests never consume your quota.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111113] border border-white/5 space-y-1">
              <h4 className="text-sm font-bold text-white">How does Indian GST calculation work?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                All subscriptions include 18% GST (CGST 9% + SGST 9% for intra-state or IGST 18% for inter-state transactions). Official GST tax invoices with HSN/SAC codes are generated automatically.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111113] border border-white/5 space-y-1">
              <h4 className="text-sm font-bold text-white">Will I be charged automatically on renewal?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                No. In strict compliance with recurring-charge authorization protocols, plans are billed for the selected period (1 month or 1 year) and will not automatically deduct from your account without explicit mandate setup.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <p>InvoicePro 360 • A Product of Unikorn360 AI Solutions • Encrypted with Supabase PostgreSQL RLS</p>
      </footer>
    </div>
  );
}
