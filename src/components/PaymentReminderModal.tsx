import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Mail, 
  Send, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  ExternalLink, 
  Sparkles, 
  Settings2, 
  X, 
  ChevronRight, 
  History, 
  ShieldAlert,
  Loader2,
  Check
} from "lucide-react";
import { Invoice, CompanySettings, EmailReminderRule, EmailReminderLog } from "../types";
import { formatRupees, generateId } from "../utils/invoiceUtils";

interface PaymentReminderModalProps {
  invoice: Invoice;
  allInvoices?: Invoice[];
  onClose: () => void;
  companySettings?: CompanySettings;
  onReminderSent?: (log: EmailReminderLog) => void;
}

const RULES_STORAGE_KEY = "invoicepro_email_reminder_rules";
const LOGS_STORAGE_KEY = "invoicepro_email_reminder_logs";

export default function PaymentReminderModal({
  invoice,
  allInvoices = [],
  onClose,
  companySettings,
  onReminderSent
}: PaymentReminderModalProps) {
  const [activeTab, setActiveTab] = useState<"compose" | "schedule" | "history">("compose");

  // Calculate Overdue status
  const balanceDue = invoice.balanceDue !== undefined ? invoice.balanceDue : (invoice.status === 'paid' ? 0 : invoice.totalAmount);
  const isOverdue = Boolean(
    invoice.dueDate && 
    new Date(invoice.dueDate).getTime() < Date.now() && 
    balanceDue > 0
  ) || invoice.status === 'overdue' || invoice.paymentStatus === 'overdue';

  const daysOverdue = invoice.dueDate 
    ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Derive client default email
  const defaultClientEmail = `accounts@${invoice.customerName.toLowerCase().replace(/[^a-z0-9]/g, "") || "client"}.com`;

  // Form States
  const [recipientEmail, setRecipientEmail] = useState(defaultClientEmail);
  const [tone, setTone] = useState<"friendly" | "professional" | "urgent" | "firm">(
    isOverdue ? (daysOverdue > 7 ? "urgent" : "firm") : "friendly"
  );
  
  // Schedule settings
  const [enableAutomatedReminders, setEnableAutomatedReminders] = useState(true);
  const [remindBeforeDue, setRemindBeforeDue] = useState(true);
  const [remindOnDue, setRemindOnDue] = useState(true);
  const [remindOverdue3Days, setRemindOverdue3Days] = useState(true);
  const [remindOverdue7Days, setRemindOverdue7Days] = useState(true);
  const [recurringWeekly, setRecurringWeekly] = useState(true);

  // Email Content States
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  
  // UI feedback states
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<EmailReminderLog[]>([]);

  // Load existing rules and logs from localStorage
  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) {
          setLogs(parsed.filter((l: EmailReminderLog) => l.invoiceId === invoice.id || l.clientName === invoice.customerName));
        }
      }

      const savedRules = localStorage.getItem(RULES_STORAGE_KEY);
      if (savedRules) {
        const rules: EmailReminderRule[] = JSON.parse(savedRules);
        const matched = rules.find(r => r.invoiceId === invoice.id || r.clientName === invoice.customerName);
        if (matched) {
          setEnableAutomatedReminders(matched.enabled);
          setRecipientEmail(matched.clientEmail || defaultClientEmail);
          setTone(matched.tone);
          setRemindBeforeDue(Boolean(matched.schedule.beforeDueDays));
          setRemindOnDue(matched.schedule.onDueDate);
          setRemindOverdue3Days(matched.schedule.afterDueDays.includes(3));
          setRemindOverdue7Days(matched.schedule.afterDueDays.includes(7));
          setRecurringWeekly(Boolean(matched.schedule.recurringIntervalDays));
        }
      }
    } catch (e) {
      console.warn("Could not load reminder rules/logs:", e);
    }
  }, [invoice]);

  // Generate Email Content based on selected Tone
  useEffect(() => {
    const sender = companySettings?.name || invoice.supplierName || "Our Billing Team";
    const amountStr = formatRupees(balanceDue);
    const dueDateStr = invoice.dueDate || "Immediate";

    if (isOverdue) {
      if (tone === "urgent") {
        setEmailSubject(`URGENT: Overdue Payment Notice - Invoice #${invoice.invoiceNumber} (${amountStr})`);
        setEmailBody(
`Dear ${invoice.customerName} Accounts Team,

This is an urgent notice regarding overdue Invoice #${invoice.invoiceNumber} dated ${invoice.date}, which matured on ${dueDateStr} (${daysOverdue} days past due).

Outstanding Balance Due: ${amountStr}

Please arrange for immediate clearance today to prevent any disruption to your ongoing services and avoid statutory interest under MSMED regulations.

Payment Options:
• Bank Transfer: Account for ${sender} (IFSC: HDFC0000128, A/C: 50200012984920)
• UPI ID: billing@okaxis / Unikorn360

If payment has already been remitted, please reply with the transaction UTR number so we can update your ledger immediately.

Warm regards,
${sender} Accounts & Finance Team`
        );
      } else if (tone === "firm") {
        setEmailSubject(`Payment Overdue Notice: Invoice #${invoice.invoiceNumber} - ${invoice.customerName}`);
        setEmailBody(
`Dear ${invoice.customerName} Team,

We are writing to follow up on Invoice #${invoice.invoiceNumber} for ${formatRupees(invoice.totalAmount)}, which had a payment due date of ${dueDateStr}.

Our records show an outstanding balance of ${amountStr}.

We kindly request you to look into this and schedule the payment at your earliest convenience.

Invoice Summary:
- Invoice #: ${invoice.invoiceNumber}
- Invoice Date: ${invoice.date}
- Due Date: ${dueDateStr}
- Amount Outstanding: ${amountStr}

Please let us know if you require another copy of the invoice or have any questions.

Best regards,
${sender}`
        );
      } else {
        setEmailSubject(`Friendly Reminder: Overdue Invoice #${invoice.invoiceNumber}`);
        setEmailBody(
`Hi ${invoice.customerName} Team,

Hope you are doing well!

Just a gentle reminder that Invoice #${invoice.invoiceNumber} for ${amountStr} was due on ${dueDateStr}. We understand things get busy, so please let us know when we can expect settlement.

Thank you for your partnership!

Best regards,
${sender}`
        );
      }
    } else {
      // Upcoming or On Due Date
      if (tone === "friendly") {
        setEmailSubject(`Upcoming Payment Reminder: Invoice #${invoice.invoiceNumber} (${amountStr})`);
        setEmailBody(
`Dear ${invoice.customerName} Team,

This is a friendly reminder that Invoice #${invoice.invoiceNumber} for ${amountStr} is scheduled for payment on ${dueDateStr}.

Attached is the invoice copy for your reference and records.

Thank you for your business!

Sincerely,
${sender}`
        );
      } else {
        setEmailSubject(`Invoice #${invoice.invoiceNumber} Due Notice - ${sender}`);
        setEmailBody(
`Dear ${invoice.customerName} Accounts Team,

Please be advised that Invoice #${invoice.invoiceNumber} with an amount of ${amountStr} is due on ${dueDateStr}.

Kindly process the remittance according to your billing cycle.

Bank Details:
- Beneficiary: ${sender}
- Account No: 50200012984920
- IFSC: HDFC0000128

Thank you,
${sender}`
        );
      }
    }
  }, [tone, invoice, balanceDue, isOverdue, daysOverdue, companySettings]);

  // Handle Saving Automation Schedule Rule
  const handleSaveScheduleRule = () => {
    const afterDueDays: number[] = [];
    if (remindOverdue3Days) afterDueDays.push(3);
    if (remindOverdue7Days) afterDueDays.push(7);

    const newRule: EmailReminderRule = {
      id: "rule-" + generateId(),
      invoiceId: invoice.id,
      clientName: invoice.customerName,
      clientEmail: recipientEmail,
      enabled: enableAutomatedReminders,
      tone,
      schedule: {
        beforeDueDays: remindBeforeDue ? 3 : undefined,
        onDueDate: remindOnDue,
        afterDueDays,
        recurringIntervalDays: recurringWeekly ? 7 : undefined
      },
      createdAt: new Date().toISOString()
    };

    try {
      const savedRules = localStorage.getItem(RULES_STORAGE_KEY);
      let rules: EmailReminderRule[] = savedRules ? JSON.parse(savedRules) : [];
      // Remove previous rule for this invoice
      rules = rules.filter(r => r.invoiceId !== invoice.id);
      rules.push(newRule);
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
      alert(`Automated reminder schedule saved for ${invoice.customerName}!`);
    } catch (e) {
      console.error("Failed to save reminder rule:", e);
    }
  };

  // Handle Triggering / Sending Email Reminder
  const handleSendReminderNow = () => {
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);

      const logEntry: EmailReminderLog = {
        id: "log-" + generateId(),
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.customerName,
        clientEmail: recipientEmail,
        type: isOverdue ? (daysOverdue > 7 ? "overdue_urgent" : "overdue_first") : "upcoming_due",
        subject: emailSubject,
        sentAt: new Date().toISOString(),
        status: "delivered"
      };

      try {
        const savedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
        const allLogs: EmailReminderLog[] = savedLogs ? JSON.parse(savedLogs) : [];
        const updatedLogs = [logEntry, ...allLogs];
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
        setLogs(prev => [logEntry, ...prev]);
      } catch (e) {
        console.warn("Failed to persist reminder log:", e);
      }

      if (onReminderSent) {
        onReminderSent(logEntry);
      }

      setTimeout(() => setSendSuccess(false), 4000);
    }, 1200);
  };

  const handleCopyEmailText = () => {
    const fullText = `Subject: ${emailSubject}\n\nTo: ${recipientEmail}\n\n${emailBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="payment-reminder-modal-root">
      <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-xl ${isOverdue ? "bg-rose-500/20 text-rose-400" : "bg-indigo-500/20 text-indigo-400"}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-lg flex items-center space-x-2">
                  <span>Automated 'Payment Due' Reminders</span>
                  {isOverdue ? (
                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{daysOverdue > 0 ? `${daysOverdue} Days Overdue` : "Overdue"}</span>
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Due Soon
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Client: <b className="text-slate-200">{invoice.customerName}</b> • Invoice #{invoice.invoiceNumber} • Balance: <b className="text-emerald-400 font-mono">{formatRupees(balanceDue)}</b>
                </p>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {sendSuccess && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-bold text-emerald-400">Payment Reminder Email Dispatched!</p>
              <p className="text-[11px] text-emerald-300/80">
                Delivery simulated to <span className="font-mono underline">{recipientEmail}</span> and recorded in payment audit logs.
              </p>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-white/5 bg-black/40 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("compose")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "compose"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Compose & Send Now</span>
          </button>

          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "schedule"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Automated Triggers</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Reminder Logs ({logs.length})</span>
          </button>
        </div>

        {/* TAB 1: COMPOSE & SEND */}
        {activeTab === "compose" && (
          <div className="space-y-4">
            {/* Tone Selector & Recipient */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Recipient Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="billing@client.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Email Tone</label>
                <div className="grid grid-cols-4 gap-1">
                  {(["friendly", "professional", "urgent", "firm"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`py-2 text-[10px] font-bold capitalize rounded-lg border transition-all cursor-pointer ${
                        tone === t
                          ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                          : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject Line */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Email Body */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Message Content</label>
              <textarea
                rows={9}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyEmailText}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/5 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied to Clipboard!" : "Copy Text"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenMailClient}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/5 transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Open draft in Outlook / Gmail / Apple Mail"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Mail App</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isSending}
                onClick={handleSendReminderNow}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all flex items-center space-x-2 shadow-sm cursor-pointer hover:scale-[1.02] disabled:opacity-50"
                id="send-payment-reminder-btn"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transmitting Reminder...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Reminder Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: AUTOMATED SCHEDULE RULES */}
        {activeTab === "schedule" && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Settings2 className="w-4 h-4 text-indigo-400" />
                <span>Automated Workflow Triggers for {invoice.customerName}</span>
              </h4>
              <p className="text-xs text-slate-400">
                Configure rule-based triggers to automatically send payment reminder emails at critical invoice milestones.
              </p>
            </div>

            {/* Master Toggle */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">Enable Automated Reminders for this Client</p>
                <p className="text-[11px] text-slate-400">Sends background notifications whenever payment dates approach or pass</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutomatedReminders}
                  onChange={(e) => setEnableAutomatedReminders(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Trigger Milestones List */}
            <div className={`space-y-3 ${!enableAutomatedReminders ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-indigo-400">⏰</span>
                  <div>
                    <p className="text-xs font-bold text-white">3 Days Before Due Date</p>
                    <p className="text-[10px] text-slate-400">Friendly reminder with invoice copy and bank UPI details</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={remindBeforeDue}
                  onChange={(e) => setRemindBeforeDue(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-amber-400">📅</span>
                  <div>
                    <p className="text-xs font-bold text-white">On Due Date (Payment Due Today)</p>
                    <p className="text-[10px] text-slate-400">Alert client accounts department that remittance is due today</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={remindOnDue}
                  onChange={(e) => setRemindOnDue(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-orange-400">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-white">3 Days Overdue (First Overdue Follow-up)</p>
                    <p className="text-[10px] text-slate-400">Firm notice requesting transfer reference or payment date</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={remindOverdue3Days}
                  onChange={(e) => setRemindOverdue3Days(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-rose-400">🚨</span>
                  <div>
                    <p className="text-xs font-bold text-white">7 Days Overdue (Urgent Escalation Notice)</p>
                    <p className="text-[10px] text-slate-400">Escalates notice highlighting MSMED interest provisions</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={remindOverdue7Days}
                  onChange={(e) => setRemindOverdue7Days(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-purple-400">🔄</span>
                  <div>
                    <p className="text-xs font-bold text-white">Weekly Recurring Follow-up</p>
                    <p className="text-[10px] text-slate-400">Repeats follow-up every 7 days until ledger balance is marked paid</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={recurringWeekly}
                  onChange={(e) => setRecurringWeekly(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleSaveScheduleRule}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
              >
                Save Automation Settings
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: REMINDER HISTORY LOGS */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-300">Activity Log for {invoice.customerName}</p>
              <span className="text-[10px] text-slate-500">Tracked in client communication ledger</span>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-10 bg-white/5 rounded-xl border border-white/5 p-4 space-y-2">
                <Mail className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No previous email reminders recorded for this invoice yet.</p>
                <button
                  onClick={() => setActiveTab("compose")}
                  className="text-xs text-indigo-400 font-semibold hover:underline cursor-pointer"
                >
                  Send First Reminder Now →
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{log.status.toUpperCase()}</span>
                        </span>
                        <span className="font-semibold text-white truncate max-w-[240px]">{log.subject}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.sentAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Recipient: <b className="text-slate-300">{log.clientEmail}</b></span>
                      <span className="capitalize text-indigo-300">{log.type.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
