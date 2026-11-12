import React, { useState } from "react";
import { 
  Sliders, 
  ShieldCheck, 
  AlertTriangle, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  Lock,
  Zap,
  Info
} from "lucide-react";

export interface SecurityConfigData {
  autoContainmentEnabled: boolean;
  highRiskThreshold: number;
  mediumRiskThreshold: number;
  rateLimitRequestsPerMinute: number;
  aiAbuseDetectionEnabled: boolean;
  retentionDaysAuditLogs: number;
  retentionDaysAiTelemetry: number;
  updatedAt?: string;
  updatedBy?: string;
}

interface AdminSecurityConfigProps {
  config: SecurityConfigData;
  loading: boolean;
  onSaveConfig: (updated: SecurityConfigData, justification: string) => Promise<boolean>;
}

export default function AdminSecurityConfig({
  config,
  loading,
  onSaveConfig
}: AdminSecurityConfigProps) {
  const [formData, setFormData] = useState<SecurityConfigData>(config);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) {
      setErrorMsg("A justification is required to modify security configuration parameters.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    const success = await onSaveConfig(formData, justification.trim());
    setSubmitting(false);

    if (success) {
      setSaveSuccess(true);
      setJustification("");
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      setErrorMsg("Failed to save security configuration. Check Super Admin privileges.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-rose-400" />
          <span>Security Engine & Containment Rules</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Tune algorithmic threat sensitivity, automated rate-throttling behavior, and retention timelines.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Automated Containment Section */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Automated Containment Engine</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically throttles accounts that trigger high-confidence prompt injections or request floods.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoContainmentEnabled}
                onChange={(e) => setFormData({ ...formData, autoContainmentEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                <span>AI Abuse Classifier Engine</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates ambiguous prompts with fast secondary AI inference schema.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.aiAbuseDetectionEnabled}
                onChange={(e) => setFormData({ ...formData, aiAbuseDetectionEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>
        </div>

        {/* Risk Thresholds Section */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Algorithmic Risk Scoring Thresholds</span>
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">High Risk Containment Threshold</span>
                <span className="font-mono text-rose-400 font-bold">{formData.highRiskThreshold} / 100</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={formData.highRiskThreshold}
                onChange={(e) => setFormData({ ...formData, highRiskThreshold: parseInt(e.target.value, 10) })}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Events scoring above this trigger immediate rate throttling or temporary restriction.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Medium Risk Triage Threshold</span>
                <span className="font-mono text-amber-400 font-bold">{formData.mediumRiskThreshold} / 100</span>
              </div>
              <input
                type="range"
                min="30"
                max="75"
                value={formData.mediumRiskThreshold}
                onChange={(e) => setFormData({ ...formData, mediumRiskThreshold: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Events scoring above this enter the triage queue without automatic disruption.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">API Request Flood Limit (per User)</span>
                <span className="font-mono text-blue-400 font-bold">{formData.rateLimitRequestsPerMinute} req/min</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                value={formData.rateLimitRequestsPerMinute}
                onChange={(e) => setFormData({ ...formData, rateLimitRequestsPerMinute: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Defends against rapid-burst automated bots or scripts attempting quota evasion.
              </p>
            </div>
          </div>
        </div>

        {/* Data Retention Policies */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Compliance Retention Policies</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Audit Trail Retention (Days)</label>
              <input
                type="number"
                min="30"
                max="3650"
                value={formData.retentionDaysAuditLogs}
                onChange={(e) => setFormData({ ...formData, retentionDaysAuditLogs: parseInt(e.target.value, 10) || 365 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Complies with financial regulatory mandates.</p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">AI Telemetry Retention (Days)</label>
              <input
                type="number"
                min="7"
                max="365"
                value={formData.retentionDaysAiTelemetry}
                onChange={(e) => setFormData({ ...formData, retentionDaysAiTelemetry: parseInt(e.target.value, 10) || 90 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Prunes metadata beyond this operational horizon.</p>
            </div>
          </div>
        </div>

        {/* Mandatory Justification & Submit */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-white flex items-center justify-between">
            <span>Mandatory Change Rationale for Audit Trail</span>
            <span className="text-[10px] text-rose-400 font-mono">* Required by Super Admin Constitution</span>
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Document reason for threshold or rule change (e.g. elevated brute force attack wave, sensitivity tuning)..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />

          {errorMsg && (
            <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          {saveSuccess && (
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Security rules updated and committed to audit log.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Last revised by: <span className="font-mono text-slate-400">{config.updatedBy || "system"}</span>
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? "Committing Changes..." : "Commit Security Rules"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
