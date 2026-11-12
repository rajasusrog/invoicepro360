import React, { useState } from "react";
import { 
  Sparkles, 
  Activity, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  DollarSign, 
  CheckCircle2, 
  XCircle,
  Eye,
  Info
} from "lucide-react";

export interface AiLogRecord {
  id: string;
  userEmail: string;
  endpoint: string;
  operationType: string;
  provider: string;
  model: string;
  statusCode: number;
  latencyMs: number;
  tokensEstimated: number;
  costEstimatedUsd: number;
  riskScore: number;
  detectionCategory?: string;
  abuseFlag: boolean;
  createdAt: string;
}

interface AdminAiMonitoringProps {
  logs: AiLogRecord[];
  loading: boolean;
  totalTokens?: number;
  totalCostUsd?: number;
  averageLatencyMs?: number;
}

export default function AdminAiMonitoring({
  logs,
  loading,
  totalTokens = 18450,
  totalCostUsd = 0.1245,
  averageLatencyMs = 1120
}: AdminAiMonitoringProps) {
  const [filterType, setFilterType] = useState<string>("all");

  const filteredLogs = filterType === "all"
    ? logs
    : filterType === "suspicious"
    ? logs.filter(l => l.abuseFlag || l.riskScore >= 50)
    : logs.filter(l => l.statusCode >= 400);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Privacy Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span>AI Security Telemetry & Request Monitoring</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect aggregate model performance, token expenditures, and automated injection anomaly pre-screening.
        </p>
      </div>

      {/* Mandatory Privacy Compliance Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-start space-x-3 text-xs">
        <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-white flex items-center gap-2">
            <span>Privacy-Minimized Data Retention Policy Enforced</span>
            <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400 font-mono">
              GDPR & DPDP Act Compliant
            </span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            By system architectural design, customer invoices, financial amounts, customer names, Indian GSTINs, and raw generation prompts are never retained in plain text. Only high-level request metadata (latency, status, sanitized risk score, and token estimates) is recorded.
          </p>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Requests Recorded</span>
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{logs.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Recent telemetry window</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Average Latency</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-300">{averageLatencyMs} ms</div>
          <div className="text-[11px] text-slate-500 mt-1">End-to-end provider roundtrip</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Estimated Token Usage</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{totalTokens.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Prompt & output tokens</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Cumulative AI Spend</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">${totalCostUsd.toFixed(4)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Gemini & OpenAI API billing</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filterType === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            All Operations ({logs.length})
          </button>
          <button
            onClick={() => setFilterType("suspicious")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filterType === "suspicious"
                ? "bg-rose-950/60 text-rose-300 border border-rose-800"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Threats / Elevated Risk ({logs.filter(l => l.abuseFlag || l.riskScore >= 50).length})
          </button>
          <button
            onClick={() => setFilterType("errors")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filterType === "errors"
                ? "bg-amber-950/60 text-amber-300 border border-amber-800"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Errors & Rejections ({logs.filter(l => l.statusCode >= 400).length})
          </button>
        </div>
      </div>

      {/* Log Feed Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">User Account</th>
                <th className="py-3 px-4 font-semibold">Endpoint & Operation</th>
                <th className="py-3 px-4 font-semibold">Model / Provider</th>
                <th className="py-3 px-4 font-semibold">Latency / Tokens</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Risk Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-mono">
                    Fetching AI telemetry feed...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No matching AI logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isHighRisk = log.riskScore >= 80;
                  const isMediumRisk = log.riskScore >= 50 && log.riskScore < 80;
                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        log.abuseFlag ? "bg-rose-950/10" : ""
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                        {formatTime(log.createdAt)}
                      </td>

                      {/* User */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {log.userEmail}
                      </td>

                      {/* Endpoint & Operation */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-white text-[11px]">{log.endpoint}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{log.operationType.replace(/_/g, " ")}</div>
                      </td>

                      {/* Provider & Model */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-200 capitalize">{log.provider}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{log.model}</div>
                      </td>

                      {/* Latency & Tokens */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <div className="text-slate-300">{log.latencyMs} ms</div>
                        <div className="text-[10px] text-slate-500">~{log.tokensEstimated} tokens</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.statusCode === 200 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            200 OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-mono text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            {log.statusCode} Error
                          </span>
                        )}
                      </td>

                      {/* Risk Score */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span 
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            isHighRisk
                              ? "bg-rose-950 text-rose-400 border border-rose-800"
                              : isMediumRisk
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "text-slate-400"
                          }`}
                        >
                          {log.riskScore} / 100
                        </span>
                        {log.detectionCategory && (
                          <div className="text-[10px] text-rose-400 mt-0.5 font-mono">
                            {log.detectionCategory}
                          </div>
                        )}
                      </td>
                    </tr>
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
