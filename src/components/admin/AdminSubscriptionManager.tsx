import React, { useState, useEffect } from "react";
import { 
  Crown, 
  Check, 
  AlertCircle, 
  Users, 
  Sparkles, 
  FileText, 
  CreditCard, 
  Plus, 
  X, 
  CheckCircle2, 
  Filter,
  DollarSign,
  Lock,
  ArrowRight
} from "lucide-react";
import { SUBSCRIPTION_PLANS, formatQuotaLabel, formatInrPrice } from "../../utils/subscriptionPlans";
import { AdminUserRecord } from "./AdminUserDirectory";
import { getSession } from "../../lib/supabase";

interface AdminSubscriptionManagerProps {
  users: AdminUserRecord[];
  onUpdateUserPlan: (userId: string, planId: string, justification: string) => Promise<boolean>;
}

export default function AdminSubscriptionManager({
  users,
  onUpdateUserPlan
}: AdminSubscriptionManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"plans" | "payments">("plans");
  const [selectedPlanTab, setSelectedPlanTab] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Manual Activation Modal State
  const [manualModal, setManualModal] = useState<{
    isOpen: boolean;
    userId: string;
    planId: string;
    billingCycle: "monthly" | "annual";
    justification: string;
    submitting: boolean;
    error?: string;
    success?: string;
  }>({
    isOpen: false,
    userId: users[0]?.id || "",
    planId: "standard",
    billingCycle: "monthly",
    justification: "",
    submitting: false
  });

  const planTierKeys = ["basic", "standard", "professional", "elite", "ultra"] as const;

  const usersByPlan = users.reduce((acc, user) => {
    const key = (user.planId || "basic").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredUsers = selectedPlanTab === "all"
    ? users
    : users.filter(u => (u.planId || "basic").toLowerCase() === selectedPlanTab);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const session = await getSession();
      if (session?.access_token) {
        const res = await fetch(`/api/admin/payments?status=${paymentStatusFilter}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments || []);
        }
      }
    } catch (err) {
      console.error("Error fetching admin payments:", err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "payments") {
      fetchPayments();
    }
  }, [activeSubTab, paymentStatusFilter]);

  const handleManualActivate = async () => {
    if (!manualModal.justification.trim()) {
      setManualModal(m => ({ ...m, error: "An audit justification is mandatory to grant or override subscriptions." }));
      return;
    }

    setManualModal(m => ({ ...m, submitting: true, error: undefined }));

    try {
      const session = await getSession();
      const res = await fetch("/api/admin/manual-activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          userId: manualModal.userId,
          planId: manualModal.planId,
          billingCycle: manualModal.billingCycle,
          justification: manualModal.justification.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setManualModal(m => ({
          ...m,
          submitting: false,
          success: "Subscription successfully granted and recorded in audit log."
        }));
        setTimeout(() => {
          setManualModal({
            isOpen: false,
            userId: users[0]?.id || "",
            planId: "standard",
            billingCycle: "monthly",
            justification: "",
            submitting: false
          });
          if (activeSubTab === "payments") {
            fetchPayments();
          }
        }, 1500);
      } else {
        setManualModal(m => ({
          ...m,
          submitting: false,
          error: data.error || "Failed to grant manual subscription."
        }));
      }
    } catch (err: any) {
      setManualModal(m => ({
        ...m,
        submitting: false,
        error: err.message || "Network error while executing manual activation."
      }));
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      return new Date(isoString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>Subscription Plans & Billing Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit subscriber quotas, review gateway transactions, and execute auditable manual plan activations.
          </p>
        </div>

        <button
          onClick={() => setManualModal(m => ({ ...m, isOpen: true }))}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors shadow shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Plan Activation</span>
        </button>
      </div>

      {/* Sub-tab Switcher: Quotas & Subscriptions vs Payments Ledger */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveSubTab("plans")}
          className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center space-x-1.5 ${
            activeSubTab === "plans" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Subscriber Quotas & Distribution</span>
        </button>
        <button
          onClick={() => setActiveSubTab("payments")}
          className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center space-x-1.5 ${
            activeSubTab === "payments" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Orders & Ledger</span>
        </button>
      </div>

      {activeSubTab === "plans" && (
        <>
          {/* Plan Tier Matrix Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {planTierKeys.map((key) => {
              const plan = SUBSCRIPTION_PLANS[key];
              const subscriberCount = usersByPlan[key] || 0;
              return (
                <div 
                  key={key}
                  onClick={() => setSelectedPlanTab(key)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                    selectedPlanTab === key
                      ? "bg-slate-900 border-rose-500 shadow-md shadow-rose-950/30"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white capitalize">{plan.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {subscriberCount} users
                    </span>
                  </div>

                  <div className="text-lg font-bold font-mono text-white mt-2">
                    {plan.priceInr !== null ? `₹${plan.priceInr.toLocaleString("en-IN")}` : "Custom"}
                    <span className="text-[10px] text-slate-400 font-normal"> /mo</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Invoices:</span>
                      <span className="font-mono font-semibold text-slate-200">{formatQuotaLabel(plan.invoiceQuota)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">AI Gens:</span>
                      <span className="font-mono font-semibold text-slate-200">{formatQuotaLabel(plan.aiGenerationQuota)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Team:</span>
                      <span className="font-mono font-semibold text-slate-200">{plan.teamMemberQuota ?? 1} seat</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter Tabs for Subscriber Table */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedPlanTab("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  selectedPlanTab === "all"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All Subscribers ({users.length})
              </button>
              {planTierKeys.map(k => (
                <button
                  key={k}
                  onClick={() => setSelectedPlanTab(k)}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-medium capitalize ${
                    selectedPlanTab === k
                      ? "bg-rose-950/60 text-rose-300 border border-rose-800/80"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {k} ({usersByPlan[k] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Subscriber Usage Overview Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Current Tier</th>
                    <th className="py-3 px-4 font-semibold">Invoices Used / Cap</th>
                    <th className="py-3 px-4 font-semibold">AI Gens Used / Cap</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No subscribers found on this tier.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{u.fullName || "User"}</div>
                          <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 capitalize font-semibold text-slate-200">
                          {u.planName || u.planId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-200 font-medium">
                            {u.invoicesUsed} / {formatQuotaLabel(u.invoiceQuota)}
                          </div>
                          <div className="w-32 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${Math.min(100, u.invoiceQuota > 0 ? (u.invoicesUsed / u.invoiceQuota) * 100 : 0)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-200 font-medium">
                            {u.aiGenerationsUsed} / {formatQuotaLabel(u.aiGenerationQuota)}
                          </div>
                          <div className="w-32 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
                            <div 
                              className="h-full bg-violet-500" 
                              style={{ width: `${Math.min(100, u.aiGenerationQuota > 0 ? (u.aiGenerationsUsed / u.aiGenerationQuota) * 100 : 0)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {u.isSuspended ? (
                            <span className="text-rose-400 font-semibold">Suspended</span>
                          ) : (
                            <span className="text-emerald-400">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payments Ledger Tab */}
      {activeSubTab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Payment Status:</span>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid Only</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">
              {payments.length} Transaction(s)
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">User Account</th>
                    <th className="py-3 px-4 font-semibold">Order / Gateway ID</th>
                    <th className="py-3 px-4 font-semibold">Plan & Cycle</th>
                    <th className="py-3 px-4 font-semibold">Amount (INR)</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loadingPayments ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500 font-mono">
                        Querying payment orders ledger...
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        No payment transactions found in this filter.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {formatDate(p.paid_at || p.created_at)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                          {p.user_email || p.user_id?.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-300">
                          <div>{p.gateway_payment_id || p.gateway_order_id || p.id?.slice(0, 8)}</div>
                          <div className="text-[10px] text-slate-500">{p.gateway}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap capitalize font-medium text-white">
                          {p.plan_id} ({p.billing_cycle || "monthly"})
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-white">
                          ₹{Number(p.amount_inr || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {p.status === "paid" ? (
                            <span className="text-emerald-400 font-semibold">Paid</span>
                          ) : p.status === "failed" ? (
                            <span className="text-rose-400 font-semibold">Failed</span>
                          ) : p.status === "refunded" ? (
                            <span className="text-amber-400 font-semibold">Refunded</span>
                          ) : (
                            <span className="text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                          {p.manual_admin_granted ? (
                            <span className="text-amber-300">
                              Admin: {p.granted_by} ({p.justification})
                            </span>
                          ) : (
                            <span>Gateway verified capture</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Subscription Activation Modal */}
      {manualModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Manual Subscription Activation</h3>
              </div>
              <button 
                onClick={() => setManualModal(m => ({ ...m, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Super Admin manual grant requires an explicit audit justification. A verified payment record will be recorded in the payments ledger with your administrator signature.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Account</label>
                <select
                  value={manualModal.userId}
                  onChange={(e) => setManualModal({ ...manualModal, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.fullName || "User"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Plan Tier</label>
                  <select
                    value={manualModal.planId}
                    onChange={(e) => setManualModal({ ...manualModal, planId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none capitalize"
                  >
                    <option value="basic">Basic (₹0)</option>
                    <option value="standard">Standard (₹499)</option>
                    <option value="professional">Professional (₹1,499)</option>
                    <option value="elite">Elite (₹3,999)</option>
                    <option value="ultra">Ultra (Custom)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Billing Interval</label>
                  <select
                    value={manualModal.billingCycle}
                    onChange={(e) => setManualModal({ ...manualModal, billingCycle: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none capitalize"
                  >
                    <option value="monthly">Monthly (1 mo)</option>
                    <option value="annual">Annual (1 yr)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                  <span>Mandatory Audit Justification</span>
                  <span className="text-[10px] text-rose-400 font-mono">* Required</span>
                </label>
                <textarea
                  value={manualModal.justification}
                  onChange={(e) => setManualModal({ ...manualModal, justification: e.target.value })}
                  placeholder="Document why this plan is being manually activated (e.g. offline bank wire transfer, enterprise pilot agreement #1092)..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {manualModal.error && (
              <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{manualModal.error}</span>
              </div>
            )}

            {manualModal.success && (
              <div className="p-2.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{manualModal.success}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setManualModal(m => ({ ...m, isOpen: false }))}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualActivate}
                disabled={manualModal.submitting}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                {manualModal.submitting ? "Committing..." : "Activate & Record Audit Log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
