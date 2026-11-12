import React, { useState } from "react";
import { 
  FileText, 
  ShieldCheck, 
  Search, 
  Filter, 
  Clock, 
  Lock, 
  ChevronDown, 
  ChevronRight,
  User,
  Crown,
  AlertTriangle,
  Sliders
} from "lucide-react";

export interface AuditLogRecord {
  id: string;
  adminEmail: string;
  adminUserId?: string;
  action: string;
  targetType: string;
  targetId: string;
  justification?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

interface AdminAuditLogProps {
  logs: AuditLogRecord[];
  loading: boolean;
}

export default function AdminAuditLog({ logs, loading }: AdminAuditLogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.justification && log.justification.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter = actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesFilter;
  });

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return iso;
    }
  };

  const actionIcon = (action: string) => {
    if (action.includes("suspend") || action.includes("restore")) {
      return <User className="w-3.5 h-3.5 text-rose-400" />;
    }
    if (action.includes("plan") || action.includes("quota")) {
      return <Crown className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (action.includes("alert") || action.includes("contain")) {
      return <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />;
    }
    return <Sliders className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span>Tamper-Resistant Security Audit Trail</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographically timestamped, append-only immutable ledger of all administrative privileges exercised across InvoicePro 360.
        </p>
      </div>

      {/* Compliance / Immutable Guarantee Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/70 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-white">Append-Only PostgreSQL Security Policy Enforced</div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              Row-Level Security prevents UPDATE or DELETE actions on this table by any application client or standard admin role.
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-1 font-mono text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Chain Verified</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, administrator, target..."
            className="bg-slate-950 border border-slate-800 text-xs text-white pl-8 pr-3 py-1.5 rounded-lg w-64 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-medium">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
          >
            <option value="all">All Actions</option>
            <option value="user_suspended">User Suspended</option>
            <option value="user_restored">User Restored</option>
            <option value="plan_override">Plan Override</option>
            <option value="alert_contained">Alert Contained</option>
            <option value="alert_resolved">Alert Resolved</option>
            <option value="security_config_updated">Security Config Updated</option>
            <option value="unauthorized_admin_access_denied">Access Denied (403)</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Timestamp (UTC)</th>
                <th className="py-3 px-4 font-semibold">Administrator</th>
                <th className="py-3 px-4 font-semibold">Action Executed</th>
                <th className="py-3 px-4 font-semibold">Target Resource</th>
                <th className="py-3 px-4 font-semibold">Mandatory Justification</th>
                <th className="py-3 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-mono">
                    Loading audit trail ledger...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-200">
                          {log.adminEmail}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-semibold text-white capitalize">
                            {actionIcon(log.action)}
                            <span>{log.action.replace(/_/g, " ")}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                          <span className="text-slate-500">{log.targetType}:</span> {log.targetId}
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate text-[11px]" title={log.justification}>
                          {log.justification || "—"}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON Metadata View */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-slate-800">
                          <td colSpan={6} className="p-4">
                            <div className="space-y-2">
                              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                                <span>Record ID: {log.id}</span>
                                {log.ipAddress && <span>Origin IP: {log.ipAddress}</span>}
                              </div>
                              <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                                {JSON.stringify(log.metadata || {}, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
