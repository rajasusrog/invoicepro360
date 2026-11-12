import React, { useState } from "react";
import { 
  Search, 
  Filter, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Clock, 
  Crown, 
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  FileText
} from "lucide-react";
import { formatQuotaLabel } from "../../utils/subscriptionPlans";

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  isSuspended: boolean;
  suspendedReason?: string;
  lastSeenAt: string;
  createdAt: string;
  authProvider: string;
  planId: string;
  planName: string;
  invoicesUsed: number;
  invoiceQuota: number;
  aiGenerationsUsed: number;
  aiGenerationQuota: number;
  role?: string;
}

interface AdminUserDirectoryProps {
  users: AdminUserRecord[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  planFilter: string;
  onPlanFilterChange: (plan: string) => void;
  onPageChange: (newPage: number) => void;
  onUpdateUserStatus: (userId: string, isSuspended: boolean, reason: string) => Promise<boolean>;
  onUpdateUserPlan: (userId: string, planId: string, justification: string) => Promise<boolean>;
}

export default function AdminUserDirectory({
  users,
  total,
  page,
  totalPages,
  loading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  planFilter,
  onPlanFilterChange,
  onPageChange,
  onUpdateUserStatus,
  onUpdateUserPlan
}: AdminUserDirectoryProps) {
  // Modal states for action justifications
  const [suspendModal, setSuspendModal] = useState<{
    user: AdminUserRecord;
    action: "suspend" | "restore";
    reason: string;
    submitting: boolean;
    error?: string;
  } | null>(null);

  const [planModal, setPlanModal] = useState<{
    user: AdminUserRecord;
    newPlanId: string;
    justification: string;
    submitting: boolean;
    error?: string;
  } | null>(null);

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
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

  const isRecentlyActive = (isoString?: string) => {
    if (!isoString) return false;
    const diffHours = (Date.now() - new Date(isoString).getTime()) / (1000 * 3600);
    return diffHours < 24;
  };

  const handleConfirmStatusChange = async () => {
    if (!suspendModal) return;
    if (suspendModal.action === "suspend" && !suspendModal.reason.trim()) {
      setSuspendModal({ ...suspendModal, error: "An audit justification is mandatory when suspending an account." });
      return;
    }

    setSuspendModal({ ...suspendModal, submitting: true, error: undefined });
    const success = await onUpdateUserStatus(
      suspendModal.user.id,
      suspendModal.action === "suspend",
      suspendModal.reason.trim()
    );

    if (success) {
      setSuspendModal(null);
    } else {
      setSuspendModal({
        ...suspendModal,
        submitting: false,
        error: "Failed to update account status. Verify permissions."
      });
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!planModal) return;
    if (!planModal.justification.trim()) {
      setPlanModal({ ...planModal, error: "An audit justification is required to modify subscription plans." });
      return;
    }

    setPlanModal({ ...planModal, submitting: true, error: undefined });
    const success = await onUpdateUserPlan(
      planModal.user.id,
      planModal.newPlanId,
      planModal.justification.trim()
    );

    if (success) {
      setPlanModal(null);
    } else {
      setPlanModal({
        ...planModal,
        submitting: false,
        error: "Failed to update user subscription plan."
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>User Directory & Privileged Management</span>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              {total} Accounts Registered
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search, inspect subscription utilization, and execute auditable privileged account modifications.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by email or name..."
              className="bg-slate-900 border border-slate-800 focus:border-rose-500 text-xs text-white pl-9 pr-3 py-2 rounded-lg w-64 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Accounts</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => onPlanFilterChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500 capitalize"
            >
              <option value="all">All Tiers</option>
              <option value="basic">Basic (₹0)</option>
              <option value="standard">Standard (₹499)</option>
              <option value="professional">Professional (₹1,499)</option>
              <option value="elite">Elite (₹4,999)</option>
              <option value="ultra">Ultra (Enterprise)</option>
            </select>
          </div>
        </div>

        {/* Pagination Info */}
        <div className="flex items-center space-x-3 text-slate-400">
          <span>Page {page} of {Math.max(1, totalPages)}</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1 rounded bg-slate-950 border border-slate-800 disabled:opacity-30 hover:border-slate-700 text-slate-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1 rounded bg-slate-950 border border-slate-800 disabled:opacity-30 hover:border-slate-700 text-slate-300"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">User / Identity</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Subscription Plan</th>
                <th className="py-3 px-4 font-semibold">Invoice Quota</th>
                <th className="py-3 px-4 font-semibold">AI Quota</th>
                <th className="py-3 px-4 font-semibold">Last Active</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    Loading account directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const recent = isRecentlyActive(u.lastSeenAt);
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 uppercase shrink-0">
                            {u.fullName?.charAt(0) || u.email?.charAt(0) || "U"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate flex items-center gap-1.5">
                              <span>{u.fullName || "InvoicePro User"}</span>
                              {u.role === "super_admin" && (
                                <span className="text-[10px] bg-rose-950 border border-rose-800 text-rose-300 px-1 py-0.2 rounded font-mono font-semibold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {u.isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        )}
                      </td>

                      {/* Subscription Plan */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-200 capitalize flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span>{u.planName || u.planId}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Auth: {u.authProvider || "google"}
                        </div>
                      </td>

                      {/* Invoices Used / Quota */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-200 font-medium">
                          {u.invoicesUsed} / {formatQuotaLabel(u.invoiceQuota)}
                        </div>
                        <div className="w-24 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${Math.min(100, u.invoiceQuota > 0 ? (u.invoicesUsed / u.invoiceQuota) * 100 : 0)}%` }}
                          />
                        </div>
                      </td>

                      {/* AI Generations Used / Quota */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-200 font-medium">
                          {u.aiGenerationsUsed} / {formatQuotaLabel(u.aiGenerationQuota)}
                        </div>
                        <div className="w-24 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
                          <div 
                            className="h-full bg-violet-500" 
                            style={{ width: `${Math.min(100, u.aiGenerationQuota > 0 ? (u.aiGenerationsUsed / u.aiGenerationQuota) * 100 : 0)}%` }}
                          />
                        </div>
                      </td>

                      {/* Last Seen / Active */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatDateTime(u.lastSeenAt)}</span>
                        </div>
                        <div className="text-[10px]">
                          {recent ? (
                            <span className="text-emerald-400">Active within 24h</span>
                          ) : (
                            <span className="text-slate-500">Dormant</span>
                          )}
                        </div>
                      </td>

                      {/* Privileged Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setPlanModal({
                              user: u,
                              newPlanId: u.planId || "basic",
                              justification: "",
                              submitting: false
                            })}
                            className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                          >
                            Plan
                          </button>

                          {u.isSuspended ? (
                            <button
                              onClick={() => setSuspendModal({
                                user: u,
                                action: "restore",
                                reason: "",
                                submitting: false
                              })}
                              className="px-2.5 py-1 text-xs text-emerald-300 hover:text-emerald-100 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 rounded transition-colors font-medium"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => setSuspendModal({
                                user: u,
                                action: "suspend",
                                reason: "",
                                submitting: false
                              })}
                              className="px-2.5 py-1 text-xs text-rose-300 hover:text-rose-100 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-900/80 rounded transition-colors font-medium"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend / Restore Modal with Mandatory Audit Justification */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className={`w-5 h-5 ${suspendModal.action === "suspend" ? "text-rose-400" : "text-emerald-400"}`} />
                <h3 className="text-sm font-bold text-white capitalize">
                  {suspendModal.action} User Account
                </h3>
              </div>
              <button 
                onClick={() => setSuspendModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                Target account: <span className="font-mono font-bold text-white">{suspendModal.user.email}</span>
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {suspendModal.action === "suspend"
                  ? "Suspending will revoke active session API access and block invoice generation, AI operations, and exports immediately. This action is recorded permanently in the Super Admin Audit Log."
                  : "Restoring will reinstate full platform privileges according to the user's subscription quotas."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Mandatory Audit Justification</span>
                <span className="text-[10px] text-rose-400">* Required</span>
              </label>
              <textarea
                value={suspendModal.reason}
                onChange={(e) => setSuspendModal({ ...suspendModal, reason: e.target.value })}
                placeholder="State security incident number, policy violation, or reason for this action..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
              />
            </div>

            {suspendModal.error && (
              <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{suspendModal.error}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSuspendModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={suspendModal.submitting}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  suspendModal.action === "suspend"
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {suspendModal.submitting ? "Committing..." : `Confirm ${suspendModal.action === "suspend" ? "Suspension" : "Restoration"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Override Modal with Mandatory Audit Justification */}
      {planModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Privileged Plan Override</h3>
              </div>
              <button 
                onClick={() => setPlanModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                Account: <span className="font-mono font-bold text-white">{planModal.user.email}</span>
              </p>
              <p className="text-slate-400 text-[11px]">
                Current tier: <span className="font-semibold text-white capitalize">{planModal.user.planName || planModal.user.planId}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Assign Subscription Tier</label>
              <select
                value={planModal.newPlanId}
                onChange={(e) => setPlanModal({ ...planModal, newPlanId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 capitalize"
              >
                <option value="basic">Basic (10 Invoices / 5 AI Gens · ₹0/mo)</option>
                <option value="standard">Standard (50 Invoices / 25 AI Gens · ₹499/mo)</option>
                <option value="professional">Professional (300 Invoices / 150 AI Gens · ₹1,499/mo)</option>
                <option value="elite">Elite (1,000 Invoices / 500 AI Gens · ₹4,999/mo)</option>
                <option value="ultra">Ultra Enterprise (Unlimited Invoices / High AI Quota)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Mandatory Audit Justification</span>
                <span className="text-[10px] text-rose-400">* Required</span>
              </label>
              <textarea
                value={planModal.justification}
                onChange={(e) => setPlanModal({ ...planModal, justification: e.target.value })}
                placeholder="Reason for tier override (e.g. enterprise invoice agreement, sales order #8812, test account)..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
              />
            </div>

            {planModal.error && (
              <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{planModal.error}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPlanModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPlanChange}
                disabled={planModal.submitting}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                {planModal.submitting ? "Applying..." : "Apply Plan Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
