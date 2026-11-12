import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Check
} from "lucide-react";
import { SubscriptionTierId, BillingCycle } from "../types";
import {
  BillingPlanVariant,
  fetchBillingCatalogue,
  initiateBillingCheckout,
  verifyBillingPayment,
  loadRazorpayCheckoutSdk,
  formatPaiseToInr,
  formatQuotaDisplay
} from "../lib/billing";

interface CheckoutPageProps {
  planCode: SubscriptionTierId;
  billingCycle: BillingCycle;
  userEmail?: string;
  userName?: string;
  onChangeCycle: (cycle: BillingCycle) => void;
  onBackToPricing: () => void;
  onPaymentVerified: () => void;
}

export default function CheckoutPage({
  planCode,
  billingCycle,
  userEmail,
  userName,
  onChangeCycle,
  onBackToPricing,
  onPaymentVerified
}: CheckoutPageProps) {
  const [plan, setPlan] = useState<BillingPlanVariant | null>(null);
  const [gatewayConfigured, setGatewayConfigured] = useState<boolean>(true);
  const [loadingCatalogue, setLoadingCatalogue] = useState<boolean>(true);
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [verifyingSignature, setVerifyingSignature] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadPlanDetails = async () => {
      setLoadingCatalogue(true);
      setErrorMessage(null);
      try {
        const catalogue = await fetchBillingCatalogue();
        if (!mounted) return;
        setGatewayConfigured(Boolean(catalogue.gatewayConfigured));
        const matched = (catalogue.plans || []).find(
          (p) => p.planCode === planCode && p.billingCycle === billingCycle
        );
        setPlan(matched || null);
      } catch (err: any) {
        if (!mounted) return;
        setErrorMessage(err.message || "Unable to load authoritative plan details.");
      } finally {
        if (mounted) setLoadingCatalogue(false);
      }
    };
    loadPlanDetails();
    return () => {
      mounted = false;
    };
  }, [planCode, billingCycle]);

  const handleLaunchRazorpayCheckout = async () => {
    if (!plan) return;
    setProcessingPayment(true);
    setErrorMessage(null);

    try {
      // 1. Create server-side checkout session (Subscription for Monthly/Annual, Order for Lifetime)
      // Client supplies ONLY planCode and billingCycle
      const checkoutSession = await initiateBillingCheckout({
        planCode: plan.planCode,
        billingCycle: plan.billingCycle
      });

      // 2. Load official Razorpay web checkout SDK
      const sdkLoaded = await loadRazorpayCheckoutSdk();
      if (!sdkLoaded || !(window as any).Razorpay) {
        throw new Error("Unable to load Razorpay Checkout SDK. Please check your network connection.");
      }

      const options: Record<string, any> = {
        key: checkoutSession.keyId,
        name: "UNIKORN360 — InvoicePro 360",
        description: `${checkoutSession.planName} Plan (${checkoutSession.billingCycle.toUpperCase()})`,
        currency: checkoutSession.currency,
        prefill: {
          name: userName || "",
          email: userEmail || ""
        },
        theme: {
          color: "#0B1426"
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
          }
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id?: string;
          razorpay_subscription_id?: string;
          razorpay_signature: string;
        }) => {
          setVerifyingSignature(true);
          setErrorMessage(null);
          try {
            await verifyBillingPayment({
              paymentRecordId: checkoutSession.paymentRecordId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              razorpay_subscription_id: response.razorpay_subscription_id || checkoutSession.subscriptionId
            });
            setPaymentSuccess(true);
            setVerifyingSignature(false);
            setProcessingPayment(false);
            setTimeout(() => {
              onPaymentVerified();
            }, 1500);
          } catch (verifyErr: any) {
            setErrorMessage(
              verifyErr.message || "Server-side payment signature verification failed."
            );
            setVerifyingSignature(false);
            setProcessingPayment(false);
          }
        }
      };

      if (checkoutSession.checkoutType === "subscription" && checkoutSession.subscriptionId) {
        options.subscription_id = checkoutSession.subscriptionId;
      } else if (checkoutSession.checkoutType === "order" && checkoutSession.orderId) {
        options.order_id = checkoutSession.orderId;
        options.amount = checkoutSession.totalAmountPaise;
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setErrorMessage(
          resp?.error?.description || "Payment was declined by your bank or payment provider."
        );
        setProcessingPayment(false);
      });
      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || "Could not start checkout session.");
      setProcessingPayment(false);
    }
  };

  if (loadingCatalogue) {
    return (
      <div className="bg-white border border-[#E4DFD5] rounded-xl p-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#0B1426]" />
        <p className="text-sm font-medium text-[#526176]">Loading authoritative order summary...</p>
      </div>
    );
  }

  if (paymentSuccess && plan) {
    return (
      <div className="bg-white border border-[#E4DFD5] rounded-xl p-10 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-[20px] font-bold text-[#0B1426]">
          Payment Verified & Entitlement Activated
        </h2>
        <p className="text-[15px] text-[#526176]">
          Your account is now active on the <strong className="text-[#0B1426]">{plan.planName}</strong> ({plan.billingCycle}) tier. Redirecting to your Billing Dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="checkout-page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DFD5] pb-5">
        <div>
          <button
            type="button"
            onClick={onBackToPricing}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#526176] hover:text-[#0B1426] mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Plan Comparison</span>
          </button>
          <h1 className="text-[28px] font-bold text-[#0B1426] tracking-tight">
            Order Summary & Secure Checkout
          </h1>
          <p className="text-[15px] text-[#526176]">
            Review your selected tier, billing cadence, and GST tax summary before proceeding to payment.
          </p>
        </div>

        {/* Cycle Switcher */}
        <div className="inline-flex items-center bg-white border border-[#E4DFD5] p-1 rounded-xl self-start">
          {(["monthly", "annual", "lifetime"] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => onChangeCycle(cycle)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors cursor-pointer ${
                billingCycle === cycle
                  ? "bg-[#0B1426] text-white border-b-2 border-[#C49A36]"
                  : "text-[#526176] hover:text-[#0B1426]"
              }`}
            >
              {cycle}
            </button>
          ))}
        </div>
      </div>

      {!plan ? (
        <div className="bg-white border border-[#E4DFD5] rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-6 h-6 text-amber-700 mx-auto" />
          <p className="text-base font-semibold text-[#0B1426]">Plan Variant Not Found</p>
          <p className="text-sm text-[#526176]">Please return to the pricing page and select an active plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Left 3 Columns: Plan & Entitlement Details */}
          <div className="lg:col-span-3 bg-white border border-[#E4DFD5] rounded-xl p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-[#E4DFD5] pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#526176]">
                  Selected Commercial Tier
                </span>
                <h2 className="text-[20px] font-bold text-[#0B1426] mt-0.5">
                  {plan.planName} — {plan.billingCycle.charAt(0).toUpperCase() + plan.billingCycle.slice(1)}
                </h2>
                <p className="text-sm text-[#526176] mt-1">{plan.description}</p>
              </div>
            </div>

            {/* Authoritative Quotas */}
            <div className="grid grid-cols-2 gap-4 bg-[#F6F5F1] border border-[#E4DFD5] rounded-xl p-4 text-sm">
              <div>
                <div className="text-[#526176]">Monthly Invoice Quota</div>
                <div className="font-bold text-[#0B1426] text-base tabular-nums mt-0.5">
                  {formatQuotaDisplay(plan.invoiceQuota)} / month
                </div>
              </div>
              <div>
                <div className="text-[#526176]">Monthly AI Quota</div>
                <div className="font-bold text-[#0B1426] text-base tabular-nums mt-0.5">
                  {formatQuotaDisplay(plan.aiQuota)} / month
                </div>
              </div>
              <div>
                <div className="text-[#526176]">Customer Directory</div>
                <div className="font-bold text-[#0B1426] text-base tabular-nums mt-0.5">
                  {formatQuotaDisplay(plan.customerQuota)} records
                </div>
              </div>
              <div>
                <div className="text-[#526176]">Team Workspace Seats</div>
                <div className="font-bold text-[#0B1426] text-base tabular-nums mt-0.5">
                  {plan.teamQuota} {plan.teamQuota === 1 ? "seat" : "seats"}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-[#0B1426]">Included Entitlements</h3>
              <ul className="space-y-2 text-sm text-[#263449]">
                {plan.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C49A36] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-[#F6F5F1] border border-[#E4DFD5] rounded-xl text-xs text-[#526176] space-y-1">
              <div className="font-semibold text-[#0B1426]">
                {plan.billingCycle === "lifetime"
                  ? "Lifetime Purchase & Fair-Use Policy"
                  : "Recurring Subscription & Quota Reset Policy"}
              </div>
              <p>
                {plan.billingCycle === "lifetime"
                  ? "Lifetime purchases require a single one-time payment and provide perpetual access to your tier. Monthly invoice and AI generation allowances reset on a monthly schedule."
                  : plan.billingCycle === "annual"
                  ? "Annual plans bill once every 12 months while your invoice and AI generation quotas reset every month. You may cancel renewal at any time from your Billing Dashboard."
                  : "Monthly plans renew each month and reset your invoice and AI generation quotas automatically."}
              </p>
            </div>
          </div>

          {/* Right 2 Columns: Authoritative Price & GST Calculation */}
          <div className="lg:col-span-2 bg-white border border-[#E4DFD5] rounded-xl p-6 space-y-5">
            <h2 className="text-[20px] font-bold text-[#0B1426] border-b border-[#E4DFD5] pb-3">
              Payment Summary (INR)
            </h2>

            {plan.pricePaise === null ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-sm text-amber-900 space-y-2">
                <div className="font-semibold">Price Configuration Required</div>
                <p>
                  This tier does not have a self-serve price configured in the database. Checkout is disabled until a price is set.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-[#263449]">
                <div className="flex items-center justify-between">
                  <span className="text-[#526176]">
                    Base Plan Price ({plan.billingCycle})
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatPaiseToInr(plan.pricePaise)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#526176]">CGST (9%)</span>
                  <span className="tabular-nums">{formatPaiseToInr(plan.cgstPaise)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#526176]">SGST (9%)</span>
                  <span className="tabular-nums">{formatPaiseToInr(plan.sgstPaise)}</span>
                </div>
                <div className="pt-3 border-t border-[#E4DFD5] flex items-center justify-between text-base font-bold text-[#0B1426]">
                  <span>Total Payable</span>
                  <span className="text-lg tabular-nums">{formatPaiseToInr(plan.totalAmountPaise)}</span>
                </div>
              </div>
            )}

            {!plan.checkoutEnabled && plan.configurationStatusMessage && (
              <div
                className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1.5"
                id="checkout-config-warning"
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Gateway Configuration Required</span>
                </div>
                <p className="text-[#263449] leading-relaxed">
                  {plan.configurationStatusMessage}
                </p>
              </div>
            )}

            {errorMessage && (
              <div
                className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 flex items-start gap-2"
                id="checkout-error-banner"
              >
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleLaunchRazorpayCheckout}
              disabled={
                processingPayment ||
                verifyingSignature ||
                !plan.checkoutEnabled ||
                plan.pricePaise === null ||
                plan.pricePaise <= 0
              }
              className="w-full py-3 px-4 rounded-xl bg-[#0B1426] hover:bg-[#162442] disabled:bg-[#E4DFD5] disabled:text-[#526176] disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              id="proceed-to-razorpay-btn"
            >
              {processingPayment || verifyingSignature ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {verifyingSignature ? "Verifying Payment Signature..." : "Opening Razorpay Checkout..."}
                  </span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-[#C49A36]" />
                  <span>
                    {plan.pricePaise !== null && plan.pricePaise > 0
                      ? `Pay ${formatPaiseToInr(plan.totalAmountPaise)} via Razorpay`
                      : "Checkout Unavailable"}
                  </span>
                </>
              )}
            </button>

            <div className="flex items-start gap-2 text-xs text-[#526176] pt-2 border-t border-[#E4DFD5]">
              <Lock className="w-4 h-4 text-[#0B1426] shrink-0 mt-0.5" />
              <span>
                Subscriptions and lifetime entitlements activate only after cryptographic signature verification or confirmed webhook delivery.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
