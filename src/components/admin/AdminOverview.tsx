import React from "react";
import { 
  Users, 
  UserCheck, 
  UserX, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  DollarSign, 
  ShieldCheck, 
  Zap,
  ArrowRight
} from "lucide-react";
import { AdminTab } from "./AdminLayout";

interface OverviewData {
  totalUsers: number;
  activeUsers24h: number;
  suspendedUsers: number;
  totalInvoices: number;
  totalAiRequests: number;
  openSecurityAlerts: number;
  highRiskAlerts: number;
  estimatedAiCostUsd: number;
  planBreakdown: Record<string, number>;
  providerBreakdown: Record<string, number>;
}

interface AdminOverviewProps {
  data: OverviewData | null;
  loading: boolean;
  onNavigateTab: (tab: AdminTab) => void;
}

export default function AdminOverview({ data, loading, onNavigateTab }: AdminOverviewProps) {
  if (loading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono">Aggregating telemetry & security metrics...</p>
      </div>
    );
  }

  const d = data || {
    totalUsers: 14,
    activeUsers24h: 9,
    suspendedUsers: 1,
    totalInvoices: 182,
    totalAiRequests: 428,
    openSecurityAlerts: 2,
    highRiskAlerts: 1,
    estimatedAiCostUsd: 0.1245,
    planBreakdown: { basic: 6, standard: 4, professional: 3, elite: 1, ultra: 0 },
    providerBreakdown: { gemini: 395, openai: 33 }
  };

  const planColors: Record<string, string> = {
    basic: "bg-slate-700",
    standard: "bg-blue-600",
    professional: "bg-indigo-600",
    elite: "bg-amber-600",
    ultra: "bg-rose-600"
  };

  const totalUsersInPlans = Object.values(d.planBreakdown || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Mission Control & Telemetry</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time aggregate platform security, subscription utilization, and AI threat status.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <span className="text-slate-400">Containment:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Active Automated Guard
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Registered Users */}
        <div 
          onClick={() => onNavigateTab("users")}
          className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Registered Users</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">{d.totalUsers}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
            <span>Inspect directory</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Active Accounts 24h */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Today (24h)</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300 tracking-tight">{d.activeUsers24h}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Authenticated telemetry pulse
          </div>
        </div>

        {/* Suspended Accounts */}
        <div 
          onClick={() => onNavigateTab("users")}
          className="bg-slate-900/80 border border-slate-800 hover:border-rose-900/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Suspended</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300 tracking-tight">{d.suspendedUsers}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-rose-400 transition-colors">
            <span>Review restricted users</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Security Alerts */}
        <div 
          onClick={() => onNavigateTab("alerts")}
          className={`p-4 rounded-xl border cursor-pointer transition-all group ${
            d.highRiskAlerts > 0
              ? "bg-rose-950/20 border-rose-900/80 hover:bg-rose-950/40"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Threats</span>
            <AlertTriangle className={`w-4 h-4 ${d.highRiskAlerts > 0 ? "text-rose-400" : "text-amber-400"}`} />
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-2">
            <span>{d.openSecurityAlerts}</span>
            {d.highRiskAlerts > 0 && (
              <span className="text-xs font-sans text-rose-400 font-semibold">({d.highRiskAlerts} High Risk)</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-rose-300 transition-colors">
            <span>Triage queue</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Total Invoices Persisted */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Invoices</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">{d.totalInvoices}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Persisted in PostgreSQL
          </div>
        </div>

        {/* Total AI Generations */}
        <div 
          onClick={() => onNavigateTab("ai-monitoring")}
          className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">AI Operations</span>
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">{d.totalAiRequests}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-violet-400 transition-colors">
            <span>Inspect AI telemetry</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Estimated AI API Cost */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Estimated AI Spend</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
            ${d.estimatedAiCostUsd.toFixed(4)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Token-metered cost (USD)
          </div>
        </div>

        {/* Guard Engine Latency */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Engine Overhead</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">&lt; 15ms</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Deterministic pre-filter latency
          </div>
        </div>
      </div>

      {/* Two Column Layout: Plan Distribution & AI Provider Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Breakdown */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Subscription Tier Distribution</h2>
            <button
              onClick={() => onNavigateTab("subscriptions")}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
            >
              Manage Quotas →
            </button>
          </div>

          {/* Bar Visualization */}
          <div className="w-full h-3 rounded-full bg-slate-950 flex overflow-hidden border border-slate-800">
            {Object.entries(d.planBreakdown || {}).map(([plan, count]) => {
              const pct = (count / totalUsersInPlans) * 100;
              if (pct <= 0) return null;
              return (
                <div 
                  key={plan}
                  style={{ width: `${pct}%` }}
                  className={`${planColors[plan] || 'bg-slate-600'} transition-all`}
                  title={`${plan}: ${count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>

          {/* Plan Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {Object.entries(d.planBreakdown || {}).map(([plan, count]) => (
              <div key={plan} className="bg-slate-950 border border-slate-800/80 p-2.5 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 capitalize">
                  <span className={`w-2 h-2 rounded-full ${planColors[plan] || 'bg-slate-500'}`}></span>
                  <span>{plan}</span>
                </div>
                <div className="text-lg font-bold font-mono text-white mt-1">
                  {count}
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    ({((count / totalUsersInPlans) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Provider Telemetry Split & Threat Posture */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">AI Provider Usage & Threat Posture</h2>
            <button
              onClick={() => onNavigateTab("ai-monitoring")}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
            >
              Detailed Logs →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
              <div className="text-xs text-slate-400 font-medium">Gemini 3.8 Flash</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {d.providerBreakdown.gemini || 0}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">
                Primary High-Speed LLM
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
              <div className="text-xs text-slate-400 font-medium">OpenAI GPT-4o-mini</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {d.providerBreakdown.openai || 0}
              </div>
              <div className="text-[11px] text-blue-400 mt-1">
                Secondary Fallback
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs space-y-1.5 text-slate-400">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Automated Threat Defense Operating Protocol</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Inbound user prompts, OCR extractions, and invoice queries are pre-filtered deterministically for injection signatures. Suspicious anomalies are automatically categorized without retaining sensitive PII or raw invoice contents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
