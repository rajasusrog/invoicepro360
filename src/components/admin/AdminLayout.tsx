import React from "react";
import { 
  ShieldAlert, 
  Users, 
  Crown, 
  Activity, 
  AlertTriangle, 
  FileText, 
  Sliders, 
  ExternalLink, 
  LogOut, 
  Lock,
  RefreshCw
} from "lucide-react";

export type AdminTab = 
  | "overview" 
  | "users" 
  | "subscriptions" 
  | "ai-monitoring" 
  | "alerts" 
  | "audit-logs" 
  | "security-config";

interface AdminLayoutProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  adminEmail?: string;
  adminRole?: string;
  onRefreshAll?: () => void;
  onExitAdmin: () => void;
  onSignOut: () => void;
  openAlertCount?: number;
  children: React.ReactNode;
}

const UNIKORN_COMPACT_LOGO = "/assets/aistudio/ChatGPT_Image_Oct_29__2026__07_20_38_PM_11dd3e23.png";

const navItems: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: boolean }[] = [
  { id: "overview", label: "Security & Ops Overview", icon: Activity },
  { id: "users", label: "User Directory & Access", icon: Users },
  { id: "subscriptions", label: "Subscriptions & Quotas", icon: Crown },
  { id: "ai-monitoring", label: "AI Activity & Telemetry", icon: Activity },
  { id: "alerts", label: "Abuse & Threat Alerts", icon: AlertTriangle, badge: true },
  { id: "audit-logs", label: "Tamper-Proof Audit Trail", icon: FileText },
  { id: "security-config", label: "Containment & Engine Rules", icon: Sliders }
];

export default function AdminLayout({
  currentTab,
  onSelectTab,
  adminEmail,
  onRefreshAll,
  onExitAdmin,
  onSignOut,
  openAlertCount = 0,
  children
}: AdminLayoutProps) {
  const activeTabInfo = navItems.find(n => n.id === currentTab);

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#263449] flex font-sans">
      {/* Desktop Navy Left Sidebar (#0B1426) */}
      <aside className="w-64 bg-[#0B1426] text-white flex flex-col shrink-0 border-r border-[#1E2B45]">
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/10">
          <img
            src={UNIKORN_COMPACT_LOGO}
            alt="UNIKORN360"
            className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-bold text-white text-sm tracking-tight truncate">InvoicePro 360</div>
            <div className="text-[10px] font-semibold text-[#C49A36] uppercase tracking-wider truncate">
              Super Admin Console
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Privileged Controls
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-l-2 ${
                  isActive
                    ? "bg-white/10 text-white border-[#C49A36]"
                    : "text-slate-300 hover:text-white hover:bg-white/5 border-transparent"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#C49A36]" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && openAlertCount > 0 && (
                  <span className="font-mono text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold">
                    {openAlertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-[11px] space-y-1 text-slate-300">
            <div className="flex items-center space-x-1.5 text-[#C49A36] font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Trust Governance</span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              All privileged requests are logged immutably. Plan overrides and suspensions require audit justifications.
            </p>
          </div>

          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center space-x-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Terminate Admin Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E4DFD5] px-4 lg:px-8 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#0B1426] flex items-center justify-center text-[#C49A36]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#0B1426] leading-tight">
                {activeTabInfo?.label || "Super Admin Console"}
              </h1>
              <div className="text-xs text-[#526176] flex items-center space-x-2">
                <span className="font-mono text-[#263449] font-medium">{adminEmail || "admin@unikorn360.com"}</span>
                <span>·</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <span>Allowlist Verified</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {onRefreshAll && (
              <button
                onClick={onRefreshAll}
                title="Refresh Telemetry Data"
                className="p-2 text-[#526176] hover:text-[#0B1426] bg-[#F6F5F1] hover:bg-[#E4DFD5]/60 rounded-lg transition-colors border border-[#E4DFD5] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onExitAdmin}
              className="flex items-center space-x-1.5 text-xs font-semibold text-white bg-[#0B1426] hover:bg-[#162442] px-3.5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <span>Return to InvoicePro 360</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#C49A36]" />
            </button>
          </div>
        </header>

        {/* Warm White Content Area with UNIKORN360 Theme Scope */}
        <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8 space-y-6 unikorn-theme-scope">
          {children}
        </main>
      </div>
    </div>
  );
}
