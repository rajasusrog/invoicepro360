import React, { useState, useEffect } from "react";
import { 
  X, 
  Crown, 
  ShieldCheck, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Lock, 
  Info, 
  ExternalLink,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { SubscriptionTierId, BillingCycle } from "../types";
import { SUBSCRIPTION_PLANS, calculateCheckoutPricing, formatQuotaLabel } from "../utils/subscriptionPlans";
import { getSession } from "../lib/supabase";

interface CheckoutModalProps {
  planId: SubscriptionTierId;
  billingCycle: BillingCycle;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function CheckoutModal({
  planId,
  billingCycle,
  isOpen,
  onClose,
  onSuccess
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [gatewayConfigured, setGatewayConfigured] = useState<boolean | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);

  const plan = SUBSCRIPTION_PLANS[planId];
  const pricing = calculateCheckoutPricing(planId, billingCycle);

  // Fetch gateway configuration on modal open
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setCompletedSuccess(false);

    const checkConfig = async () => {
      try {
        const res = await fetch("/api/payment/config");
        if (res.ok) {
          const data = await res.json();
          setGatewayConfigured(Boolean(data.isConfigured));
          setKeyId(data.keyId);
        } else {
          setGatewayConfigured(false);
        }
      } catch {
        setGatewayConfigured(false);
      }
    };

    checkConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  // Dynamically load Razorpay SDK script if not already present
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleProceedToPayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Get authenticated user token
      const session = await getSession();
      if (!session?.access_token) {
        setErrorMessage("Your session has expired. Please sign in again.");
        setLoading(false);
        return;
      }

      // 2. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setErrorMessage("Unable to connect to Razorpay payment gateway script. Please check your internet connection.");
        setLoading(false);
        return;
      }

      // 3. Create server-side Razorpay order
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          planId,
          billingCycle
        })
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        if (orderData.code === "GATEWAY_NOT_CONFIGURED") {
          setGatewayConfigured(false);
        }
        setErrorMessage(orderData.error || "Failed to create payment order.");
        setLoading(false);
        return;
      }

      // 4. Launch Razorpay Checkout Popup
      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency || "INR",
        name: "InvoicePro 360",
        description: `${plan.name} Tier (${billingCycle === "annual" ? "Annual" : "Monthly"})`,
        order_id: orderData.orderId,
        prefill: {
          email: session.user.email || ""
        },
        theme: {
          color: "#4f46e5"
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // 5. Server-side verification (never activate merely on client redirect or popup closure!)
          setVerifyingPayment(true);
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setCompletedSuccess(true);
              setTimeout(() => {
                onSuccess();
                onClose();
              }, 2000);
            } else {
              setErrorMessage(verifyData.error || "Payment signature verification failed on server.");
            }
          } catch (err: any) {
            setErrorMessage(err.message || "Network error while verifying payment on server.");
          } finally {
            setVerifyingPayment(false);
            setLoading(false);
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", (resp: any) => {
        setErrorMessage(resp.error?.description || "Payment was declined by your bank or payment method.");
        setLoading(false);
      });
      rzpInstance.open();
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMessage(err.message || "An unexpected error occurred during checkout initialization.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111113] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Order Summary & Checkout</h3>
              <p className="text-[11px] text-slate-400">Review subscription details and proceed to secure checkout</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {completedSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Payment Verified & Subscription Activated!</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Your account has been upgraded to the <span className="font-bold text-white">{plan.name}</span> tier with updated monthly quotas.
              </p>
            </div>
          ) : (
            <>
              {/* Selected Plan Summary Card */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono uppercase text-indigo-400 font-bold tracking-wider">
                      Target Tier
                    </span>
                    <h4 className="text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>{plan.name} Subscription</span>
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-semibold bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-slate-300 capitalize">
                    {billingCycle} Billing
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                  <div>
                    Invoices: <span className="text-white font-bold">{formatQuotaLabel(plan.invoiceQuota)} / mo</span>
                  </div>
                  <div>
                    AI Generations: <span className="text-white font-bold">{formatQuotaLabel(plan.aiGenerationQuota)} / mo</span>
                  </div>
                  <div>
                    Customer Directory: <span className="text-white font-bold">{formatQuotaLabel(plan.customerQuota)}</span>
                  </div>
                  <div>
                    Team Seats: <span className="text-white font-bold">{plan.teamMemberQuota} seat(s)</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown Matrix with GST */}
              <div className="p-4 rounded-xl bg-[#0c0c0e] border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Base Plan Fee ({billingCycle === "annual" ? "12 Months" : "1 Month"}):</span>
                  <span className="font-mono text-white">
                    ₹{billingCycle === "annual" ? (plan.priceInr * 12).toLocaleString("en-IN") : plan.priceInr.toLocaleString("en-IN")}
                  </span>
                </div>

                {billingCycle === "annual" && pricing.discountAmountInr > 0 && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>Annual Commitment Discount (20%):</span>
                    <span className="font-mono">-₹{pricing.discountAmountInr.toLocaleString("en-IN")}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-400">
                  <span>Net Taxable Value:</span>
                  <span className="font-mono text-slate-200">₹{pricing.baseAmountInr.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>CGST (9%) + SGST (9%):</span>
                  <span className="font-mono text-slate-300">₹{pricing.taxAmountInr.toLocaleString("en-IN")}</span>
                </div>

                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Payable Amount (INR):</span>
                  <span className="font-mono text-lg text-emerald-400">₹{pricing.totalAmountInr.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Gateway Setup State Banner (Rule 10: Clearly labelled state if credentials missing) */}
              {gatewayConfigured === false && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Razorpay Gateway Credentials Pending Setup</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Live payment checkout requires server-side Razorpay credentials. To activate payments, configure:
                  </p>
                  <pre className="p-2 rounded bg-amber-950/60 border border-amber-800/40 text-[10px] font-mono text-amber-200 overflow-x-auto">
                    RAZORPAY_KEY_ID="rzp_test_..."{"\n"}
                    RAZORPAY_KEY_SECRET="your_secret_key"
                  </pre>
                  <p className="text-[10px] text-amber-300/70">
                    In compliance with financial integrity policies, simulated free activation is strictly disabled.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Security & Non-Recurring Advisory Note */}
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[11px] text-slate-400 flex items-start space-x-2">
                <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Fixed period billing. No automatic recurring deduction will occur without explicit gateway authorization. Quotas activate immediately upon verified bank confirmation.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!completedSuccess && (
          <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={loading || verifyingPayment}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleProceedToPayment}
              disabled={loading || verifyingPayment || gatewayConfigured === false}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading || verifyingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{verifyingPayment ? "Verifying Signature..." : "Preparing Gateway..."}</span>
                </>
              ) : (
                <>
                  <span>Pay ₹{pricing.totalAmountInr.toLocaleString("en-IN")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
