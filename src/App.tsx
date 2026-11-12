import React, { useState, useEffect, useMemo } from "react";
import {
  Invoice,
  ChatMessage,
  CompanySettings,
  UserSubscription,
  SubscriptionTierId,
  BillingCycle
} from "./types";
import DashboardOverview from "./components/DashboardOverview";
import InvoiceList from "./components/InvoiceList";
import InvoiceCreator from "./components/InvoiceCreator";
import InvoiceViewer from "./components/InvoiceViewer";
import InvoiceChat from "./components/InvoiceChat";
import CompanySettingsComponent from "./components/CompanySettings";
import RecordPaymentModal from "./components/RecordPaymentModal";
import PricingPage from "./components/PricingPage";
import CheckoutPage from "./components/CheckoutPage";
import BillingDashboard from "./components/BillingDashboard";
import QuotaExceededModal from "./components/QuotaExceededModal";
import SuperAdminApp from "./components/admin/SuperAdminApp";
import {
  BarChart3,
  FileSpreadsheet,
  PlusCircle,
  Bot,
  Users,
  LogOut,
  ShieldCheck,
  Loader2,
  User,
  Settings,
  AlertCircle,
  CreditCard,
  Tag,
  Menu,
  X,
  Search,
  FileText,
  ArrowUpRight
} from "lucide-react";
import {
  supabase,
  SupabaseUser,
  signInWithGoogle,
  signOut,
  getSession,
  fetchUserProfile,
  saveUserProfile,
  fetchUserInvoices,
  createInvoiceInDb,
  batchCreateInvoicesInDb,
  updateInvoiceInDb,
  deleteInvoiceFromDb,
  isSupabaseConfigured,
  fetchUserSubscription
} from "./lib/supabase";
import { formatQuotaLabel } from "./utils/subscriptionPlans";
import { flagRecurringInvoicesAsDue } from "./utils/recurringUtils";
import { SAMPLE_INVOICES } from "./utils/sampleData";

const SQUARE_BRAND_LOGO = "/assets/aistudio/ChatGPT_Image_Oct_29__2026__07_20_38_PM_11dd3e23.png";

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export type WorkspaceTab =
  | "dashboard"
  | "ledger"
  | "ai-creator"
  | "customers"
  | "copilot"
  | "pricing"
  | "checkout"
  | "plans"
  | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [recordingPaymentInvoice, setRecordingPaymentInvoice] = useState<Invoice | null>(null);

  // Commercial Checkout Selection State
  const [checkoutSelection, setCheckoutSelection] = useState<{
    planCode: SubscriptionTierId;
    billingCycle: BillingCycle;
  }>({
    planCode: "professional",
    billingCycle: "monthly"
  });

  // Customer Directory Search & Filter State
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerRoleFilter, setCustomerRoleFilter] = useState<"all" | "Customer" | "Vendor">("all");

  // User Subscription & Quota State
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [quotaModal, setQuotaModal] = useState<{
    isOpen: boolean;
    type: "ai" | "invoice";
    used?: number;
    limit?: number;
    resetDate?: string;
    planId?: string;
  } | null>(null);

  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");

  // Company Profile Settings State
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "UNIKORN360 Business Intelligence",
    address: "VK Complex, P.J.N. Road, Vaniyambadi, Tamil Nadu 635751",
    gstin: "33AABCU1234A1Z8",
    logoType: "url",
    logoIcon: "Sparkles",
    logoColor: "indigo",
    logoUrl: SQUARE_BRAND_LOGO,
    logoInitials: "U360"
  });

  // Chat memory persistence
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: "Hello! I am the **InvoicePro 360 Assistant**.\n\nAsk me anything about your invoices, GST tax breakdowns, vendor balances, or monthly expenditure.\n\nExamples:\n- *'Show invoices above ₹50,000'*\n- *'Find duplicate invoices'*\n- *'Who is our top vendor?'*",
      createdAt: new Date().toISOString()
    }
  ]);

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  const [dbError, setDbError] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Verify administrator access on the server
  useEffect(() => {
    if (currentUser) {
      getSession()
        .then((session) => {
          const token = session?.access_token || (currentUser.id === "local-dev-user" ? "local-dev-token" : null);
          if (token) {
            fetch("/api/admin/verify", {
              headers: { Authorization: `Bearer ${token}` }
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                setIsVerifiedAdmin(Boolean(data?.isAdmin));
              })
              .catch(() => setIsVerifiedAdmin(false));
          } else {
            setIsVerifiedAdmin(false);
          }
        })
        .catch(() => setIsVerifiedAdmin(false));
    } else {
      setIsVerifiedAdmin(false);
    }
  }, [currentUser]);

  const refreshSubscription = async () => {
    try {
      const sub = await fetchUserSubscription();
      if (sub) {
        setUserSubscription(sub);
      }
    } catch (e) {
      console.warn("Failed to refresh subscription:", e);
    }
  };

  const loadUserData = async (user: SupabaseUser) => {
    setDbError(null);
    try {
      const profile = await fetchUserProfile(user.id);
      if (profile && profile.companySettings) {
        setCompanySettings(profile.companySettings);
      }

      const userInvoices = await fetchUserInvoices(user.id);
      if (userInvoices.length > 0) {
        const flagged = flagRecurringInvoicesAsDue(userInvoices);
        setInvoices(flagged.updatedInvoices);
      } else if (!isSupabaseConfigured) {
        try {
          const cached = localStorage.getItem("unikorn_invoicepro_records");
          if (cached) {
            setInvoices(JSON.parse(cached));
          } else {
            setInvoices(SAMPLE_INVOICES);
          }
        } catch {
          setInvoices(SAMPLE_INVOICES);
        }
      } else {
        setInvoices([]);
      }

      await refreshSubscription();
    } catch (error: any) {
      console.error("Error loading user data:", error);
      setDbError("Unable to load your invoice records right now. Please try again.");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const session = await getSession();
        if (!isMounted) return;

        if (session && session.user) {
          setCurrentUser(session.user);
          await loadUserData(session.user);
          const intendedPlan = sessionStorage.getItem("intended_plan_checkout");
          const intendedCycle = sessionStorage.getItem("intended_cycle_checkout") as BillingCycle | null;
          if (intendedPlan) {
            sessionStorage.removeItem("intended_plan_checkout");
            sessionStorage.removeItem("intended_cycle_checkout");
            setCheckoutSelection({
              planCode: intendedPlan as SubscriptionTierId,
              billingCycle: intendedCycle || "monthly"
            });
            setActiveTab("checkout");
          }
        } else {
          // Check if local preview session was active
          const localPreview = sessionStorage.getItem("unikorn_preview_session");
          if (!isSupabaseConfigured && localPreview === "active") {
            const demoUser = {
              id: "local-dev-user",
              email: "raj.asusrog@gmail.com",
              user_metadata: { full_name: "S. Rajkumar" }
            } as unknown as SupabaseUser;
            setCurrentUser(demoUser);
            await loadUserData(demoUser);
          } else {
            setCurrentUser(null);
            setInvoices([]);
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
        if (isMounted) {
          setCurrentUser(null);
          setInvoices([]);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && session?.user)) {
        if (session?.user) {
          setCurrentUser(session.user);
          await loadUserData(session.user);
          const intendedPlan = sessionStorage.getItem("intended_plan_checkout");
          const intendedCycle = sessionStorage.getItem("intended_cycle_checkout") as BillingCycle | null;
          if (intendedPlan) {
            sessionStorage.removeItem("intended_plan_checkout");
            sessionStorage.removeItem("intended_cycle_checkout");
            setCheckoutSelection({
              planCode: intendedPlan as SubscriptionTierId,
              billingCycle: intendedCycle || "monthly"
            });
            setActiveTab("checkout");
          }
        }
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("unikorn_preview_session");
        setCurrentUser(null);
        setInvoices([]);
        setSelectedInvoice(null);
      }
      setAuthLoading(false);
      setAuthSubmitting(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const persistLocalInvoicesIfNeeded = (list: Invoice[]) => {
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem("unikorn_invoicepro_records", JSON.stringify(list));
      } catch {
        // ignore storage quota errors
      }
    }
  };

  const handleSaveCompanySettings = async (updatedSettings: CompanySettings) => {
    if (currentUser && isSupabaseConfigured) {
      try {
        await saveUserProfile(currentUser, updatedSettings);
      } catch (err) {
        console.error("Error saving company settings:", err);
        setDbError("Could not save company settings. Please try again.");
        return;
      }
    }
    setCompanySettings(updatedSettings);
    showToast("Saved company settings.");
  };

  const handleGoogleLogin = async () => {
    setAuthSubmitting(true);
    setAuthError(null);

    if (!isSupabaseConfigured) {
      // Activate local preview workspace when external auth variables are not set
      sessionStorage.setItem("unikorn_preview_session", "active");
      const demoUser = {
        id: "local-dev-user",
        email: "raj.asusrog@gmail.com",
        user_metadata: { full_name: "S. Rajkumar" }
      } as unknown as SupabaseUser;
      setCurrentUser(demoUser);
      await loadUserData(demoUser);
      const intendedPlan = sessionStorage.getItem("intended_plan_checkout");
      const intendedCycle = sessionStorage.getItem("intended_cycle_checkout") as BillingCycle | null;
      if (intendedPlan) {
        sessionStorage.removeItem("intended_plan_checkout");
        sessionStorage.removeItem("intended_cycle_checkout");
        setCheckoutSelection({
          planCode: intendedPlan as SubscriptionTierId,
          billingCycle: intendedCycle || "monthly"
        });
        setActiveTab("checkout");
      }
      setAuthSubmitting(false);
      return;
    }

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setAuthError("Unable to sign in with Google right now. Please try again.");
        setAuthSubmitting(false);
      }
    } catch {
      setAuthError("Unable to connect to Google sign-in. Please check your connection and try again.");
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Sign Out",
      message: "Are you sure you want to sign out of InvoicePro 360?",
      confirmText: "Sign Out",
      onConfirm: async () => {
        setAuthLoading(true);
        try {
          sessionStorage.removeItem("unikorn_preview_session");
          await signOut();
          setCurrentUser(null);
          setInvoices([]);
          setSelectedInvoice(null);
        } catch (err) {
          console.error("Sign out error:", err);
        } finally {
          setAuthLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleInvoiceCreated = async (newInvoice: Invoice) => {
    if (!currentUser) return;

    try {
      const created = await createInvoiceInDb(newInvoice, currentUser.id);
      const updated = [created, ...invoices.filter((i) => i.id !== created.id)];
      setInvoices(updated);
      persistLocalInvoicesIfNeeded(updated);
      setSelectedInvoice(created);
      setActiveTab("ledger");
      showToast("Saved invoice.");
      refreshSubscription();
    } catch (err: any) {
      if (err.code === "INVOICE_QUOTA_EXCEEDED") {
        setQuotaModal({
          isOpen: true,
          type: "invoice",
          used: err.used,
          limit: err.limit,
          resetDate: err.resetDate,
          planId: err.planId || userSubscription?.planId || "basic"
        });
        refreshSubscription();
        return;
      }
      setDbError(err?.message || "Could not save the invoice. Your input has been preserved.");
    }
  };

  const handleBatchInvoicesCreated = async (newInvoices: Invoice[]) => {
    if (!currentUser || newInvoices.length === 0) return;

    try {
      const savedInvoices = await batchCreateInvoicesInDb(newInvoices, currentUser.id);
      const updated = [
        ...savedInvoices,
        ...invoices.filter((i) => !savedInvoices.some((s) => s.id === i.id))
      ];
      setInvoices(updated);
      persistLocalInvoicesIfNeeded(updated);
      if (savedInvoices.length > 0) {
        setSelectedInvoice(savedInvoices[0]);
      }
      setActiveTab("ledger");
      showToast(`Uploaded ${savedInvoices.length} invoice(s).`);
      refreshSubscription();
    } catch (err: any) {
      if (err.code === "INVOICE_QUOTA_EXCEEDED") {
        setQuotaModal({
          isOpen: true,
          type: "invoice",
          used: err.used,
          limit: err.limit,
          resetDate: err.resetDate,
          planId: err.planId || userSubscription?.planId || "basic"
        });
        refreshSubscription();
        return;
      }
      setDbError(err?.message || "Could not import batch invoices. Please verify your quota and try again.");
    }
  };

  const handleUpdateInvoice = async (updatedInvoice: Invoice) => {
    if (!currentUser) return;

    try {
      const saved = await updateInvoiceInDb(updatedInvoice, currentUser.id);
      const updated = invoices.map((inv) => (inv.id === saved.id ? saved : inv));
      setInvoices(updated);
      persistLocalInvoicesIfNeeded(updated);
      setSelectedInvoice(saved);
      showToast("Saved changes.");
    } catch (err: any) {
      setDbError(err?.message || "Could not save changes to this invoice.");
    }
  };

  const handleBatchInvoicesUpdated = async (updatedInvoices: Invoice[]) => {
    if (!currentUser || updatedInvoices.length === 0) return;

    try {
      const updatePromises = updatedInvoices.map((inv) => updateInvoiceInDb(inv, currentUser.id));
      const results = await Promise.all(updatePromises);
      const resultsMap = new Map(results.map((r) => [r.id, r]));
      const updated = invoices.map((inv) => resultsMap.get(inv.id) || inv);
      setInvoices(updated);
      persistLocalInvoicesIfNeeded(updated);
      if (selectedInvoice && resultsMap.has(selectedInvoice.id)) {
        setSelectedInvoice(resultsMap.get(selectedInvoice.id)!);
      }
      showToast("Saved batch updates.");
    } catch (err: any) {
      setDbError(err?.message || "Could not update selected invoices.");
    }
  };

  const handleDeleteInvoice = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Invoice Record",
      message: "Are you sure you want to permanently delete this invoice record?",
      confirmText: "Delete Invoice",
      onConfirm: async () => {
        if (currentUser) {
          try {
            await deleteInvoiceFromDb(id, currentUser.id);
            const updated = invoices.filter((inv) => inv.id !== id);
            setInvoices(updated);
            persistLocalInvoicesIfNeeded(updated);
            if (selectedInvoice?.id === id) {
              setSelectedInvoice(null);
            }
            showToast("Deleted invoice record.");
          } catch (err: any) {
            setDbError(err?.message || "Could not delete invoice record.");
          }
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleApplyChatFilter = (query: string) => {
    setLedgerSearchQuery(query);
    setActiveTab("ledger");
  };

  const handleSelectPlanForCheckout = (planCode: SubscriptionTierId, billingCycle: BillingCycle) => {
    if (!currentUser) {
      sessionStorage.setItem("intended_plan_checkout", planCode);
      sessionStorage.setItem("intended_cycle_checkout", billingCycle);
      window.history.pushState({}, "", "/");
      setCurrentPath("/");
      handleGoogleLogin();
      return;
    }
    setCheckoutSelection({ planCode, billingCycle });
    if (currentPath !== "/") {
      window.history.pushState({}, "", "/");
      setCurrentPath("/");
    }
    setActiveTab("checkout");
  };

  // Aggregated Customer & Vendor Directory from invoices
  const customerDirectory = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        gstin: string;
        address: string;
        role: "Customer" | "Vendor";
        invoiceCount: number;
        totalBilled: number;
        balanceDue: number;
        lastInvoiceDate: string;
      }
    >();

    for (const inv of invoices) {
      const isSales = inv.category === "Sales" || !inv.category;
      const partyName = isSales ? inv.customerName : inv.supplierName;
      const partyGstin = (isSales ? inv.customerGstin : inv.supplierGstin) || "Unregistered";
      const partyAddress = (isSales ? inv.customerAddress : inv.supplierAddress) || "—";
      const role: "Customer" | "Vendor" = isSales ? "Customer" : "Vendor";
      const key = `${role}:${partyName.toLowerCase().trim()}`;

      const existing = map.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalBilled += Number(inv.totalAmount) || 0;
        existing.balanceDue += Number(inv.balanceDue ?? (inv.status === "paid" ? 0 : inv.totalAmount)) || 0;
        if (inv.date > existing.lastInvoiceDate) {
          existing.lastInvoiceDate = inv.date;
        }
      } else {
        map.set(key, {
          name: partyName,
          gstin: partyGstin,
          address: partyAddress,
          role,
          invoiceCount: 1,
          totalBilled: Number(inv.totalAmount) || 0,
          balanceDue: Number(inv.balanceDue ?? (inv.status === "paid" ? 0 : inv.totalAmount)) || 0,
          lastInvoiceDate: inv.date
        });
      }
    }

    return Array.from(map.values()).filter((item) => {
      if (customerRoleFilter !== "all" && item.role !== customerRoleFilter) return false;
      if (!customerSearch.trim()) return true;
      const q = customerSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.gstin.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q)
      );
    });
  }, [invoices, customerSearch, customerRoleFilter]);

  // Public /pricing route
  if (currentPath === "/pricing" || currentPath.startsWith("/pricing")) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#263449]">
        <header className="bg-[#0B1426] text-white border-b border-[#C49A36]/30 px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={SQUARE_BRAND_LOGO}
                alt="UNIKORN360"
                className="w-9 h-9 rounded-lg object-contain bg-white p-0.5"
              />
              <span className="text-lg font-bold tracking-tight text-white">
                InvoicePro 360
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
              }}
              className="px-4 py-2 rounded-xl bg-[#C49A36] text-[#0B1426] text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
            >
              {currentUser ? "Return to Workspace" : "Sign In"}
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PricingPage
            currentPlanCode={userSubscription?.planId || "basic"}
            currentBillingModel={userSubscription?.billingModel || "free"}
            isAuthenticated={Boolean(currentUser)}
            onSelectPlanForCheckout={handleSelectPlanForCheckout}
            onBackToApp={() => {
              window.history.pushState({}, "", "/");
              setCurrentPath("/");
            }}
          />
        </main>
      </div>
    );
  }

  // Dedicated Super Admin Route (/super-admin)
  if (currentPath.startsWith("/super-admin")) {
    return (
      <SuperAdminApp
        onReturnToUserApp={() => {
          window.history.pushState({}, "", "/");
          setCurrentPath("/");
        }}
        onSignOut={handleLogout}
      />
    );
  }

  // Standardized UNIKORN360 Loading Screen
  if (authLoading) {
    return (
      <div
        className="min-h-screen bg-[#F6F5F1] text-[#263449] flex flex-col items-center justify-center p-6"
        id="app-auth-loading"
      >
        <div className="bg-white border border-[#E4DFD5] rounded-xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm">
          <img
            src={SQUARE_BRAND_LOGO}
            alt="UNIKORN360 Business Intelligence"
            className="w-16 h-16 mx-auto object-contain rounded-lg"
          />
          <Loader2 className="w-6 h-6 animate-spin text-[#0B1426] mx-auto" />
          <p className="text-sm font-medium text-[#526176]">
            Loading your InvoicePro 360 workspace...
          </p>
        </div>
      </div>
    );
  }

  // Standardized UNIKORN360 Sign-In Screen (Warm White #F6F5F1 background, centred White #FFFFFF card)
  if (!currentUser) {
    return (
      <div
        className="min-h-screen bg-[#F6F5F1] text-[#263449] flex flex-col justify-between p-6"
        id="app-login-screen"
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border border-[#E4DFD5] rounded-xl p-8 sm:p-10 max-w-md w-full shadow-sm text-center space-y-6">
            {/* Supplied Square UNIKORN360 Logo */}
            <div className="flex justify-center">
              <img
                src={SQUARE_BRAND_LOGO}
                alt="UNIKORN360 Business Intelligence"
                className="w-28 h-28 object-contain"
              />
            </div>

            {/* Product Name & One-Sentence Description */}
            <div className="space-y-2">
              <h1 className="text-[28px] font-bold text-[#0B1426] tracking-tight">
                InvoicePro 360
              </h1>
              <p className="text-[15px] text-[#526176] leading-relaxed">
                Create, scan, validate, and manage GST-compliant business invoices with automated tax intelligence.
              </p>
            </div>

            {authError && (
              <div
                className="bg-red-50 border border-red-300 text-red-900 text-sm p-3.5 rounded-xl flex items-start gap-2.5 text-left"
                id="auth-error-banner"
              >
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authSubmitting}
                className="w-full bg-[#0B1426] hover:bg-[#162442] disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center text-[15px] transition-colors cursor-pointer min-h-[44px]"
                id="login-google-btn"
              >
                {authSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#C49A36]" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, "", "/pricing");
                  setCurrentPath("/pricing");
                }}
                className="w-full bg-white hover:bg-[#F6F5F1] text-[#263449] font-semibold py-2.5 px-4 rounded-xl border border-[#E4DFD5] text-sm transition-colors cursor-pointer min-h-[42px]"
                id="view-public-pricing-btn"
              >
                View Plans & Pricing
              </button>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-[#526176] py-4">
          UNIKORN360 Business Intelligence · InvoicePro 360
        </footer>
      </div>
    );
  }

  const userAvatar =
    currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture;
  const userFullName =
    currentUser.user_metadata?.full_name ||
    currentUser.user_metadata?.name ||
    currentUser.email?.split("@")[0] ||
    "Account";

  const navItems: {
    id: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "ledger", label: "Invoice List", icon: FileSpreadsheet },
    { id: "ai-creator", label: "Invoice Editor", icon: PlusCircle },
    { id: "customers", label: "Customer List", icon: Users },
    { id: "copilot", label: "AI Assistant", icon: Bot },
    { id: "pricing", label: "Plans & Pricing", icon: Tag },
    { id: "plans", label: "Billing & Subscription", icon: CreditCard },
    { id: "settings", label: "Company Settings", icon: Settings }
  ];

  const pageMeta: Record<WorkspaceTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: "Executive Overview",
      subtitle: "Real-time GST billing summary, collection status, and monthly expenditure."
    },
    ledger: {
      title: "Invoices Ledger",
      subtitle: "Search, filter, validate, and export your sales and purchase invoices."
    },
    "ai-creator": {
      title: "Create & Scan Invoice",
      subtitle: "Draft a GST-compliant invoice manually, from plain text, or by scanning a document."
    },
    customers: {
      title: "Customer & Vendor List",
      subtitle: "Directory of active clients and suppliers with GSTIN and balance tracking."
    },
    copilot: {
      title: "AI Ledger Assistant",
      subtitle: "Query invoice totals, vendor histories, and tax summaries in plain language."
    },
    pricing: {
      title: "Plans & Pricing",
      subtitle: "Compare Monthly, Annual, and Lifetime commercial tiers."
    },
    checkout: {
      title: "Checkout",
      subtitle: "Verify your plan selection and complete secure payment."
    },
    plans: {
      title: "Billing & Subscription",
      subtitle: "Manage your active plan, monthly resetting quotas, and payment receipts."
    },
    settings: {
      title: "Company Settings",
      subtitle: "Configure your business name, GSTIN, address, and invoice branding."
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#263449] flex" id="app-wrapper">
      {/* Desktop Navy Left Sidebar (#0B1426) */}
      <aside
        className="unikorn-sidebar hidden lg:flex lg:flex-col lg:w-64 bg-[#0B1426] text-white shrink-0 border-r border-[#0B1426] select-none sticky top-0 h-screen"
        id="app-sidebar"
      >
        {/* Compact Brand Mark + Readable Product Name */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <img
            src={SQUARE_BRAND_LOGO}
            alt="UNIKORN360"
            className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-bold text-base text-white tracking-tight truncate">
              InvoicePro 360
            </div>
            <div className="text-[11px] text-[#C49A36] font-medium truncate">
              UNIKORN360 BI
            </div>
          </div>
        </div>

        {/* Primary Action Button in Sidebar */}
        <div className="p-4 border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("ai-creator")}
            className="w-full py-2.5 px-4 rounded-xl bg-[#C49A36] hover:bg-[#d1a740] text-[#0B1426] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[42px]"
            id="sidebar-create-invoice-btn"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>

        {/* Navigation Links with Gold Active Indicator (#C49A36) */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" id="tab-nav-wrapper">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === "pricing" && activeTab === "checkout");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer min-h-[40px] ${
                  isActive
                    ? "bg-white/10 text-white font-semibold border-l-4 border-[#C49A36]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
                id={`tab-${item.id}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#C49A36]" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Quota Summary Widget */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div
            onClick={() => setActiveTab("plans")}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer space-y-2"
            id="tier-limits-widget"
            title="Manage subscription & quotas"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#C49A36] uppercase tracking-wider">
                {userSubscription?.planName || "Basic"} Plan
              </span>
              <span className="text-[11px] text-white/80 underline">Upgrade</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span>Invoices</span>
                <span className="font-semibold text-white">
                  {userSubscription?.invoicesUsed ?? invoices.length} / {formatQuotaLabel(userSubscription?.invoiceQuota ?? 10)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>AI Credits</span>
                <span className="font-semibold text-white">
                  {userSubscription?.aiGenerationsUsed ?? 0} / {formatQuotaLabel(userSubscription?.aiGenerationQuota ?? 5)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0B1426] text-white h-full flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src={SQUARE_BRAND_LOGO}
                  alt="UNIKORN360"
                  className="w-8 h-8 rounded-lg object-contain bg-white p-0.5"
                />
                <span className="font-bold text-base text-white">InvoicePro 360</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-white/10">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("ai-creator");
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C49A36] text-[#0B1426] font-bold text-sm flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Invoice</span>
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? "bg-white/10 text-white font-semibold border-l-4 border-[#C49A36]"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#C49A36]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area (Top Bar + Warm White #F6F5F1 Viewport) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Bar */}
        <header
          className="bg-white border-b border-[#E4DFD5] sticky top-0 z-30 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4"
          id="app-header"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#E4DFD5] text-[#0B1426] hover:bg-[#F6F5F1] cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 lg:hidden">
              <img
                src={SQUARE_BRAND_LOGO}
                alt="UNIKORN360"
                className="w-7 h-7 rounded-md object-contain"
              />
              <span className="font-bold text-base text-[#0B1426] truncate">
                InvoicePro 360
              </span>
            </div>
            <div className="hidden lg:block">
              <span className="text-sm font-semibold text-[#526176]">
                {companySettings.name}
              </span>
              <span className="mx-2 text-[#E4DFD5]">·</span>
              <span className="text-xs font-mono text-[#526176]">
                GSTIN: {companySettings.gstin}
              </span>
            </div>
          </div>

          {/* Right Zone: Primary Action (Visible on Mobile/Desktop) + Account Controls */}
          <div className="flex items-center gap-3" id="auth-header-controls">
            <button
              type="button"
              onClick={() => setActiveTab("ai-creator")}
              className="px-4 py-2 rounded-xl bg-[#0B1426] hover:bg-[#162442] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer min-h-[40px]"
              id="topbar-create-invoice-btn"
            >
              <PlusCircle className="w-4 h-4 text-[#C49A36]" />
              <span>Create Invoice</span>
            </button>

            {isVerifiedAdmin && (
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, "", "/super-admin");
                  setCurrentPath("/super-admin");
                }}
                className="px-3 py-2 rounded-xl bg-[#F6F5F1] hover:bg-[#E4DFD5]/60 text-[#0B1426] border border-[#C49A36] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                title="Open Super Admin Console"
                id="super-admin-nav-button"
              >
                <ShieldCheck className="w-4 h-4 text-[#C49A36]" />
                <span className="hidden sm:inline">Super Admin</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 pl-2 border-l border-[#E4DFD5]">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userFullName}
                  className="w-8 h-8 rounded-full border border-[#E4DFD5] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#0B1426] text-white flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4 text-[#C49A36]" />
                </div>
              )}
              <span className="hidden md:inline text-sm font-semibold text-[#0B1426] max-w-[140px] truncate">
                {userFullName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-[#526176] hover:text-red-700 hover:bg-[#F6F5F1] transition-colors cursor-pointer"
                title="Sign Out"
                id="sign-out-button"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 unikorn-theme-scope">
          {/* Consistent Page Title & Primary Action Row */}
          {activeTab !== "pricing" && activeTab !== "checkout" && activeTab !== "plans" && (
            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DFD5] pb-4"
              id="tab-controls-row"
            >
              <div>
                <h1 className="text-[28px] font-bold text-[#0B1426] tracking-tight leading-tight">
                  {pageMeta[activeTab].title}
                </h1>
                <p className="text-[15px] text-[#526176] mt-0.5">
                  {pageMeta[activeTab].subtitle}
                </p>
              </div>
              {activeTab !== "ai-creator" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("ai-creator")}
                  className="px-4 py-2.5 rounded-xl bg-[#0B1426] hover:bg-[#162442] text-white text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto transition-colors cursor-pointer min-h-[42px]"
                >
                  <PlusCircle className="w-4 h-4 text-[#C49A36]" />
                  <span>Create Invoice</span>
                </button>
              )}
            </div>
          )}

          {/* Operation Success Toast */}
          {statusToast && (
            <div
              className="bg-emerald-50 border border-emerald-300 text-emerald-950 text-sm px-4 py-3 rounded-xl flex items-center justify-between"
              role="status"
            >
              <span className="font-semibold">{statusToast}</span>
              <button
                type="button"
                onClick={() => setStatusToast(null)}
                className="text-xs font-semibold underline ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error Banner */}
          {dbError && (
            <div
              className="bg-red-50 border border-red-300 text-red-900 text-sm p-4 rounded-xl flex items-center justify-between"
              id="app-db-error-banner"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
                <span className="font-medium">{dbError}</span>
              </div>
              <button
                type="button"
                onClick={() => setDbError(null)}
                className="text-red-800 hover:underline text-xs font-semibold px-2 py-1 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Active Workspace View */}
          <div className="animate-fade-in-up" key={activeTab} id="active-tab-panel">
            {activeTab === "dashboard" && (
              <DashboardOverview
                invoices={invoices}
                onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                onRecordPayment={(inv) => setRecordingPaymentInvoice(inv)}
                companySettings={companySettings}
                subscription={userSubscription}
                onUpgradeClick={() => setActiveTab("pricing")}
              />
            )}

            {activeTab === "ledger" && (
              <InvoiceList
                invoices={invoices}
                onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                onDeleteInvoice={handleDeleteInvoice}
                onOpenCreateModal={() => setActiveTab("ai-creator")}
                searchFilter={ledgerSearchQuery}
                onRecordPayment={(inv) => setRecordingPaymentInvoice(inv)}
                onBatchInvoicesCreated={handleBatchInvoicesCreated}
                onUpdateInvoice={handleUpdateInvoice}
                onBatchInvoicesUpdated={handleBatchInvoicesUpdated}
              />
            )}

            {activeTab === "ai-creator" && (
              <InvoiceCreator
                onInvoiceCreated={handleInvoiceCreated}
                onBatchInvoicesCreated={handleBatchInvoicesCreated}
                onClose={() => setActiveTab("ledger")}
                companySettings={companySettings}
                onQuotaExceeded={(info) => setQuotaModal({ isOpen: true, ...info })}
              />
            )}

            {activeTab === "customers" && (
              <div className="space-y-5" id="customer-directory-view">
                {/* Search and Filter Controls Above List */}
                <div className="bg-white border border-[#E4DFD5] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#526176] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search customers or vendors by name, GSTIN, or city..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E4DFD5] text-sm text-[#263449] placeholder-[#526176] focus:outline-none"
                    />
                  </div>
                  <div className="inline-flex items-center bg-[#F6F5F1] border border-[#E4DFD5] p-1 rounded-xl self-start">
                    {(["all", "Customer", "Vendor"] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setCustomerRoleFilter(role)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          customerRoleFilter === role
                            ? "bg-[#0B1426] text-white"
                            : "text-[#526176] hover:text-[#0B1426]"
                        }`}
                      >
                        {role === "all" ? "All Parties" : `${role}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customers & Vendors Table */}
                <div className="bg-white border border-[#E4DFD5] rounded-xl overflow-hidden">
                  {customerDirectory.length === 0 ? (
                    <div className="p-10 text-center space-y-3">
                      <Users className="w-7 h-7 text-[#526176] mx-auto" />
                      <div className="text-base font-semibold text-[#0B1426]">
                        No Matching Customer or Vendor Records
                      </div>
                      <p className="text-sm text-[#526176]">
                        Create your first GST invoice to automatically populate your customer and vendor directory.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("ai-creator")}
                        className="px-4 py-2 rounded-xl bg-[#0B1426] text-white text-sm font-semibold cursor-pointer"
                      >
                        Create Invoice
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-[#F6F5F1] border-b border-[#E4DFD5] text-[#0B1426] font-semibold">
                            <th className="py-3.5 px-6">Party Name</th>
                            <th className="py-3.5 px-4">Type</th>
                            <th className="py-3.5 px-4">GSTIN</th>
                            <th className="py-3.5 px-4 text-right">Invoices</th>
                            <th className="py-3.5 px-4 text-right">Total Billed</th>
                            <th className="py-3.5 px-4 text-right">Balance Due</th>
                            <th className="py-3.5 px-6 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4DFD5] text-[#263449]">
                          {customerDirectory.map((party, idx) => (
                            <tr key={idx} className="hover:bg-[#F6F5F1]/60 transition-colors">
                              <td className="py-3.5 px-6">
                                <div className="font-semibold text-[#0B1426]">{party.name}</div>
                                <div className="text-xs text-[#526176] truncate max-w-xs">
                                  {party.address}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-xs font-semibold text-[#526176]">
                                {party.role}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-[#263449]">
                                {party.gstin}
                              </td>
                              <td className="py-3.5 px-4 text-right tabular-nums">
                                {party.invoiceCount}
                              </td>
                              <td className="py-3.5 px-4 text-right font-semibold text-[#0B1426] tabular-nums">
                                ₹{party.totalBilled.toLocaleString("en-IN")}
                              </td>
                              <td className="py-3.5 px-4 text-right font-semibold tabular-nums">
                                <span className={party.balanceDue > 0 ? "text-amber-800" : "text-emerald-700"}>
                                  ₹{party.balanceDue.toLocaleString("en-IN")}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLedgerSearchQuery(party.name);
                                    setActiveTab("ledger");
                                  }}
                                  className="text-xs font-semibold text-[#0B1426] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>View Invoices</span>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-[#C49A36]" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "copilot" && (
              <InvoiceChat
                invoices={invoices}
                onApplyFilter={handleApplyChatFilter}
                messages={chatMessages}
                setMessages={setChatMessages}
              />
            )}

            {activeTab === "pricing" && (
              <PricingPage
                currentPlanCode={userSubscription?.planId || "basic"}
                currentBillingModel={userSubscription?.billingModel || "free"}
                isAuthenticated={Boolean(currentUser)}
                onSelectPlanForCheckout={handleSelectPlanForCheckout}
              />
            )}

            {activeTab === "checkout" && (
              <CheckoutPage
                planCode={checkoutSelection.planCode}
                billingCycle={checkoutSelection.billingCycle}
                userEmail={currentUser.email}
                userName={userFullName}
                onChangeCycle={(cycle) =>
                  setCheckoutSelection((prev) => ({ ...prev, billingCycle: cycle }))
                }
                onBackToPricing={() => setActiveTab("pricing")}
                onPaymentVerified={async () => {
                  await refreshSubscription();
                  setActiveTab("plans");
                }}
              />
            )}

            {activeTab === "plans" && (
              <BillingDashboard
                subscription={userSubscription}
                onRefreshSubscription={refreshSubscription}
                onNavigateToPricing={() => setActiveTab("pricing")}
                onSelectPlanForCheckout={handleSelectPlanForCheckout}
              />
            )}

            {activeTab === "settings" && (
              <CompanySettingsComponent
                settings={companySettings}
                onSave={handleSaveCompanySettings}
              />
            )}
          </div>
        </main>

        {/* Quiet Standardized Footer */}
        <footer
          className="bg-white border-t border-[#E4DFD5] text-[#526176] py-4 px-6 text-xs mt-12"
          id="app-footer"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0B1426]">InvoicePro 360</span>
              <span>·</span>
              <span>UNIKORN360 Business Intelligence</span>
            </div>
            <div>GST Compliance & Commercial Billing Workspace</div>
          </div>
        </footer>
      </div>

      {/* Quota Exceeded Modal */}
      {quotaModal && (
        <QuotaExceededModal
          isOpen={quotaModal.isOpen}
          type={quotaModal.type}
          used={quotaModal.used}
          limit={quotaModal.limit}
          resetDate={quotaModal.resetDate}
          planId={quotaModal.planId}
          onClose={() => setQuotaModal(null)}
          onViewPlans={() => {
            setQuotaModal(null);
            setActiveTab("pricing");
          }}
        />
      )}

      {/* Invoice Preview / Print / Export Modal */}
      {selectedInvoice && (
        <InvoiceViewer
          invoice={selectedInvoice}
          allInvoices={invoices}
          onClose={() => setSelectedInvoice(null)}
          onUpdateInvoice={handleUpdateInvoice}
          companySettings={companySettings}
          onDeleteInvoice={handleDeleteInvoice}
          onRecordPayment={(inv) => setRecordingPaymentInvoice(inv)}
        />
      )}

      {/* Record Customer Invoice Payment Modal */}
      {recordingPaymentInvoice && (
        <RecordPaymentModal
          invoice={recordingPaymentInvoice}
          onClose={() => setRecordingPaymentInvoice(null)}
          onSavePayment={(updatedInvoice) => {
            handleUpdateInvoice(updatedInvoice);
            setRecordingPaymentInvoice(null);
          }}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]"
          id="confirm-modal-overlay"
        >
          <div
            className="bg-white border border-[#E4DFD5] rounded-xl p-6 max-w-sm w-full space-y-5 shadow-xl"
            id="confirm-modal-box"
          >
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#0B1426]">{confirmDialog.title}</h3>
              <p className="text-sm text-[#526176] leading-relaxed">{confirmDialog.message}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E4DFD5]">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl border border-[#E4DFD5] text-sm font-semibold text-[#526176] hover:text-[#0B1426] cursor-pointer"
                id="confirm-modal-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-semibold cursor-pointer"
                id="confirm-modal-action"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
