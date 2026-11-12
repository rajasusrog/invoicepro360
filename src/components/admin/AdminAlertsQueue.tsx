import React, { useState } from "react";
import { 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Ban, 
  RotateCcw, 
  Eye, 
  Filter,
  Info
} from "lucide-react";

export interface SecurityAlert {
  id: string;
  userId?: string;
  userEmail?: string;
  ruleId: string;
  riskScore: number;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  evidenceSummary: string;
  recommendedAction: string;
  status: "new" | "contained" | "resolved" | "false_positive";
  containmentAction?: string;
  containedAt?: string;
  createdAt: string;
}

interface AdminAlertsQueueProps {
  alerts: SecurityAlert[];
  loading: boolean;
  onUpdateAlertStatus: (
    alertId: string, 
    status: "new" | "contained" | "resolved" | "false_positive",
    containmentAction?: string,
    justification?: string
  ) => Promise<boolean>;
}

export default function AdminAlertsQueue({
  alerts,
  loading,
  onUpdateAlertStatus
}: AdminAlertsQueueProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [actionModal, setActionModal] = useState<{
    alert: SecurityAlert;
    targetStatus: "contained" | "resolved" | "false_positive";
    containmentAction?: string;
    justification: string;
    submitting: boolean;
  } | null>(null);

  const filteredAlerts = statusFilter === "all"
    ? alerts
    : alerts.filter(a => a.status === statusFilter);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return iso;
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <span className="text-[11px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded uppercase">Critical</span>;
      case "high":
        return <span className="text-[11px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded uppercase">High</span>;
      case "medium":
        return <span className="text-[11px] font-mono font-medium bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded uppercase">Medium</span>;
      default:
        return <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase">Low</span>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "contained":
        return <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Contained</span>;
      case "resolved":
        return <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Resolved</span>;
      case "false_positive":
        return <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500"></span>False Positive</span>;
      default:
        return <span className="text-xs text-rose-400 font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>New Alert</span>;
    }
  };

  const handleExecuteAction = async () => {
    if (!actionModal) return;
    setActionModal({ ...actionModal, submitting: true });

    const success = await onUpdateAlertStatus(
      actionModal.alert.id,
      actionModal.targetStatus,
      actionModal.containmentAction,
      actionModal.justification || "Administrative alert triage action executed"
    );

    if (success) {
      setActionModal(null);
    } else {
      setActionModal({ ...actionModal, submitting: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <span>Security & Abuse Triage Queue</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Automated threat detection queue for prompt injections, flood spikes, quota bypasses, and oversized payloads.
        </p>
      </div>

      {/* Human-in-the-Loop Safeguard Notice */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-start space-x-3 text-xs">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-slate-400 text-[11px] leading-relaxed">
          <span className="font-semibold text-slate-200">Ethical & Operational Abuse Protocol: </span>
          AI threat classifications represent algorithmic anomaly heuristics, not proof of criminal intent. High-confidence containment applies transient rate-limiting and temporary API throttling to preserve service uptime, and requires human super-admin triage before any permanent sanction.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter("new")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === "new"
                ? "bg-rose-950/60 text-rose-300 border border-rose-800"
                : "text-slate-400 hover:text-white"
            }`}
          >
            New Threats ({alerts.filter(a => a.status === "new").length})
          </button>
          <button
            onClick={() => setStatusFilter("contained")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === "contained"
                ? "bg-amber-950/60 text-amber-300 border border-amber-800"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Contained ({alerts.filter(a => a.status === "contained").length})
          </button>
          <button
            onClick={() => setStatusFilter("resolved")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === "resolved"
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Resolved ({alerts.filter(a => a.status === "resolved").length})
          </button>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Incident / Time</th>
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-4 font-semibold">Detection Rule</th>
                <th className="py-3 px-4 font-semibold">Account</th>
                <th className="py-3 px-4 font-semibold">Evidence Summary</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-mono">
                    Querying automated threat queue...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No alerts in this status filter.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* ID & Time */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-white">{alert.id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{formatTime(alert.createdAt)}</div>
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {severityBadge(alert.severity)}
                    </td>

                    {/* Detection Rule */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200 font-mono text-[11px]">{alert.ruleId}</div>
                      <div className="text-[10px] text-slate-500">Risk Score: <span className="font-bold text-rose-400">{alert.riskScore}/100</span></div>
                    </td>

                    {/* Account */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {alert.userEmail || "Anonymous / Unauthenticated"}
                    </td>

                    {/* Evidence */}
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300 text-[11px]" title={alert.evidenceSummary}>
                      {alert.evidenceSummary}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {statusBadge(alert.status)}
                    </td>

                    {/* Triage Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {alert.status === "new" && (
                          <button
                            onClick={() => setActionModal({
                              alert,
                              targetStatus: "contained",
                              containmentAction: "throttled",
                              justification: "",
                              submitting: false
                            })}
                            className="px-2.5 py-1 text-xs bg-amber-950/80 text-amber-300 border border-amber-800 hover:bg-amber-900/80 rounded transition-colors font-medium"
                          >
                            Contain
                          </button>
                        )}

                        {alert.status !== "resolved" && (
                          <button
                            onClick={() => setActionModal({
                              alert,
                              targetStatus: "resolved",
                              justification: "",
                              submitting: false
                            })}
                            className="px-2.5 py-1 text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/80 rounded transition-colors font-medium"
                          >
                            Resolve
                          </button>
                        )}

                        {alert.status !== "false_positive" && (
                          <button
                            onClick={() => setActionModal({
                              alert,
                              targetStatus: "false_positive",
                              justification: "",
                              submitting: false
                            })}
                            className="px-2.5 py-1 text-xs bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 rounded transition-colors"
                          >
                            False Positive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white capitalize flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Confirm Alert Action: {actionModal.targetStatus.replace(/_/g, " ")}</span>
            </h3>

            <div className="text-xs text-slate-300 space-y-1">
              <p>Alert ID: <span className="font-mono text-white font-bold">{actionModal.alert.id}</span></p>
              <p>Rule: <span className="font-mono text-amber-300">{actionModal.alert.ruleId}</span></p>
              <p className="text-[11px] text-slate-400">{actionModal.alert.evidenceSummary}</p>
            </div>

            {actionModal.targetStatus === "contained" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Containment Enforcement</label>
                <select
                  value={actionModal.containmentAction}
                  onChange={(e) => setActionModal({ ...actionModal, containmentAction: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="throttled">Apply Rate Limiting / 60s Throttling</option>
                  <option value="temporarily_suspended">Temporary 24h Account Restriction</option>
                  <option value="flagged">Flag for Enhanced Deep Telemetry Inspection</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Auditable Reason / Notes</label>
              <textarea
                value={actionModal.justification}
                onChange={(e) => setActionModal({ ...actionModal, justification: e.target.value })}
                placeholder="Document rationale for containment, resolution, or false positive designation..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionModal.submitting}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                {actionModal.submitting ? "Processing..." : "Commit Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
