import React, { useState, useEffect } from "react";
import { 
  Bookmark, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Search, 
  Filter, 
  Check, 
  Layers, 
  Clock, 
  Building2, 
  FileText, 
  Tag, 
  ArrowRight, 
  RotateCcw,
  Zap,
  CheckCircle2,
  Calendar,
  DollarSign,
  Copy,
  Info,
  X
} from "lucide-react";
import { InvoiceTemplate, InvoiceItem, CompanySettings, ExpenseCategory, Invoice } from "../types";
import { 
  defaultVendorTemplates, 
  categoryStyleMap, 
  defaultExpenseCategories, 
  formatRupees, 
  generateId, 
  calculateInvoiceTotals,
  createInvoiceFromTemplate,
  convertTemplateToPrompt
} from "../utils/invoiceUtils";

interface TemplateManagerProps {
  onSelectTemplateForPrompt?: (prompt: string) => void;
  onInvoiceCreated: (invoice: Invoice) => void;
  companySettings?: CompanySettings;
}

const STORAGE_KEY = "invoicepro_saved_vendor_templates";

export default function TemplateManager({ 
  onSelectTemplateForPrompt, 
  onInvoiceCreated,
  companySettings 
}: TemplateManagerProps) {
  // Load templates from localStorage or fallback to defaultVendorTemplates
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not load templates from storage:", e);
    }
    return defaultVendorTemplates;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form states for creating/editing template
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formVendorName, setFormVendorName] = useState("");
  const [formVendorGstin, setFormVendorGstin] = useState("");
  const [formVendorAddress, setFormVendorAddress] = useState("");
  const [formCategory, setFormCategory] = useState<InvoiceTemplate["category"]>("Expense");
  const [formExpenseCategory, setFormExpenseCategory] = useState<string>("Software");
  const [formFrequency, setFormFrequency] = useState<InvoiceTemplate["recurringFrequency"]>("Monthly");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<Omit<InvoiceItem, 'id' | 'total'>[]>([
    { description: "", quantity: 1, price: 1000, taxRate: 18, hsn: "" }
  ]);

  // Save to localStorage when templates change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      console.error("Failed to save templates to localStorage:", e);
    }
  }, [templates]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormDesc("");
    setFormVendorName("");
    setFormVendorGstin("");
    setFormVendorAddress("");
    setFormCategory("Expense");
    setFormExpenseCategory("Software");
    setFormFrequency("Monthly");
    setFormTags(["Software", "Recurring"]);
    setFormTagInput("");
    setFormNotes("");
    setFormItems([{ description: "Standard Monthly Service Package", quantity: 1, price: 5000, taxRate: 18, hsn: "9983" }]);
    setIsFormOpen(true);
  };

  const openEditModal = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDesc(template.description || "");
    setFormVendorName(template.vendorName);
    setFormVendorGstin(template.vendorGstin || "");
    setFormVendorAddress(template.vendorAddress || "");
    setFormCategory(template.category);
    setFormExpenseCategory(template.expenseCategory || "Other");
    setFormFrequency(template.recurringFrequency || "Monthly");
    setFormTags(template.tags || []);
    setFormTagInput("");
    setFormNotes(template.notes || "");
    setFormItems(template.defaultItems.length > 0 ? template.defaultItems : [{ description: "Service Item", quantity: 1, price: 1000, taxRate: 18 }]);
    setIsFormOpen(true);
  };

  const handleSaveTemplateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formVendorName.trim()) {
      showNotification("Please provide both Template Name and Vendor Name.");
      return;
    }

    const validItems = formItems.filter(item => item.description.trim() !== "");
    if (validItems.length === 0) {
      showNotification("Please add at least one line item with a description.");
      return;
    }

    if (editingTemplate) {
      // Update existing
      const updated = templates.map(t => {
        if (t.id === editingTemplate.id) {
          return {
            ...t,
            name: formName.trim(),
            description: formDesc.trim() || undefined,
            vendorName: formVendorName.trim(),
            vendorGstin: formVendorGstin.trim() || undefined,
            vendorAddress: formVendorAddress.trim() || undefined,
            category: formCategory,
            expenseCategory: formExpenseCategory,
            recurringFrequency: formFrequency,
            tags: formTags,
            notes: formNotes.trim() || undefined,
            defaultItems: validItems
          };
        }
        return t;
      });
      setTemplates(updated);
      showNotification(`Template "${formName}" updated successfully!`);
    } else {
      // Create new
      const newTemplate: InvoiceTemplate = {
        id: "tmpl-" + generateId(),
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        vendorName: formVendorName.trim(),
        vendorGstin: formVendorGstin.trim() || undefined,
        vendorAddress: formVendorAddress.trim() || undefined,
        category: formCategory,
        expenseCategory: formExpenseCategory,
        recurringFrequency: formFrequency,
        tags: formTags.length > 0 ? formTags : [formExpenseCategory, "Template"],
        notes: formNotes.trim() || undefined,
        defaultItems: validItems,
        createdAt: new Date().toISOString(),
        isPreset: false
      };
      setTemplates([newTemplate, ...templates]);
      showNotification(`New template "${formName}" saved!`);
    }

    setIsFormOpen(false);
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    showNotification(`Template "${name}" deleted.`);
  };

  const handleResetToPresets = () => {
    setTemplates(defaultVendorTemplates);
    showNotification("Templates reset to standard vendor presets.");
  };

  const handleAddFormItem = () => {
    setFormItems([...formItems, { description: "", quantity: 1, price: 1000, taxRate: 18, hsn: "" }]);
  };

  const handleRemoveFormItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof Omit<InvoiceItem, 'id' | 'total'>, value: any) => {
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      [field]: field === 'quantity' || field === 'price' || field === 'taxRate' ? Number(value) : value
    };
    setFormItems(updated);
  };

  const handleAddTag = () => {
    if (formTagInput.trim() && !formTags.includes(formTagInput.trim())) {
      setFormTags([...formTags, formTagInput.trim()]);
      setFormTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(formTags.filter(t => t !== tagToRemove));
  };

  // Instant 1-click generation from template
  const handleQuickCreateInvoice = (template: InvoiceTemplate) => {
    const invoice = createInvoiceFromTemplate(template, undefined, undefined, companySettings);
    onInvoiceCreated(invoice);
    showNotification(`Created invoice #${invoice.invoiceNumber} from template "${template.name}"!`);
  };

  // Load into Prompt Creator
  const handleLoadIntoPrompt = (template: InvoiceTemplate) => {
    if (onSelectTemplateForPrompt) {
      const prompt = convertTemplateToPrompt(template);
      onSelectTemplateForPrompt(prompt);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(tmpl => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      tmpl.name.toLowerCase().includes(searchLower) ||
      tmpl.vendorName.toLowerCase().includes(searchLower) ||
      (tmpl.vendorGstin && tmpl.vendorGstin.toLowerCase().includes(searchLower)) ||
      (tmpl.expenseCategory && tmpl.expenseCategory.toLowerCase().includes(searchLower)) ||
      (tmpl.tags && tmpl.tags.some(t => t.toLowerCase().includes(searchLower)));

    const matchesCategory = selectedCategory === "all" || tmpl.expenseCategory === selectedCategory || tmpl.category === selectedCategory;
    const matchesFrequency = selectedFrequency === "all" || tmpl.recurringFrequency === selectedFrequency;

    return matchesSearch && matchesCategory && matchesFrequency;
  });

  return (
    <div className="space-y-6 animate-fade-in-up" id="template-manager-root">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center space-x-2 animate-fade-in-up shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{notification}</span>
        </div>
      )}

      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Bookmark className="w-5 h-5 text-indigo-400" />
            <h4 className="font-display font-bold text-white text-base">Recurring Vendor Templates</h4>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {templates.length} Saved
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Save and load standardized vendor invoices, tax brackets, and recurring line items for fast 1-click reconciliation.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer hover:scale-[1.02]"
            id="create-template-btn"
          >
            <Plus className="w-4 h-4" />
            <span>New Vendor Template</span>
          </button>
          
          <button
            onClick={handleResetToPresets}
            className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-white/5 transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Reset to default vendor presets"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Presets</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search vendor, category, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all" className="bg-[#111113]">All Categories</option>
            {defaultExpenseCategories.map(cat => (
              <option key={cat} value={cat} className="bg-[#111113]">{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedFrequency}
            onChange={(e) => setSelectedFrequency(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all" className="bg-[#111113]">All Frequencies</option>
            <option value="Monthly" className="bg-[#111113]">Monthly</option>
            <option value="Quarterly" className="bg-[#111113]">Quarterly</option>
            <option value="Weekly" className="bg-[#111113]">Weekly</option>
            <option value="Annual" className="bg-[#111113]">Annual</option>
            <option value="One-Time" className="bg-[#111113]">One-Time</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-white/5 border border-white/5 rounded-2xl p-6 space-y-3">
          <Bookmark className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No matching vendor templates found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search criteria or create a custom vendor layout using the button above.
          </p>
          <button
            onClick={openCreateModal}
            className="bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs px-4 py-2 rounded-xl transition-all inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Template Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="templates-cards-list">
          {filteredTemplates.map(tmpl => {
            const catStyle = categoryStyleMap[tmpl.expenseCategory || 'Other'] || categoryStyleMap['Other'];
            const totals = calculateInvoiceTotals(tmpl.defaultItems, tmpl.vendorGstin, tmpl.customerGstin);

            return (
              <div 
                key={tmpl.id} 
                className="bg-white/5 hover:bg-white/[0.07] border border-white/5 hover:border-indigo-500/40 rounded-2xl p-5 space-y-4 transition-all group flex flex-col justify-between"
              >
                {/* Top Details */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                          <span>{catStyle.icon}</span>
                          <span>{tmpl.expenseCategory || tmpl.category}</span>
                        </span>
                        
                        {tmpl.recurringFrequency && (
                          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                            <Clock className="w-2.5 h-2.5 mr-1 text-slate-400" />
                            {tmpl.recurringFrequency}
                          </span>
                        )}

                        {tmpl.isPreset && (
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Preset
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">
                        {tmpl.name}
                      </h5>
                    </div>

                    {/* Edit / Delete actions */}
                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(tmpl)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit template"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      
                      {!tmpl.isPreset && (
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vendor Info */}
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium text-slate-200">{tmpl.vendorName}</span>
                      </span>
                      {tmpl.vendorGstin && (
                        <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                          {tmpl.vendorGstin}
                        </span>
                      )}
                    </div>
                    {tmpl.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                        "{tmpl.description}"
                      </p>
                    )}
                  </div>

                  {/* Items Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Default Items ({tmpl.defaultItems.length}):</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        Est. {formatRupees(totals.totalAmount)}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {tmpl.defaultItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] bg-white/5 px-2.5 py-1 rounded-lg">
                          <span className="text-slate-300 truncate max-w-[200px]">
                            {item.quantity}x {item.description}
                          </span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            {formatRupees(item.quantity * item.price)} ({item.taxRate}% GST)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  {tmpl.tags && tmpl.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tmpl.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleLoadIntoPrompt(tmpl)}
                    className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-medium border border-white/5 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    title="Populate natural language prompt in AI Creator"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Load to AI Prompt</span>
                  </button>

                  <button
                    onClick={() => handleQuickCreateInvoice(tmpl)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer hover:scale-[1.02]"
                    title="Instantly generate and add invoice to records"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>1-Click Create</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form for Creating / Editing Template */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2">
                <Bookmark className="w-5 h-5 text-indigo-400" />
                <h3 className="font-display font-bold text-white text-lg">
                  {editingTemplate ? "Edit Vendor Template" : "Create Reusable Vendor Template"}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplateForm} className="space-y-5">
              {/* Basic Template Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Template Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AWS Monthly Cloud Hosting"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Recurring Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Monthly" className="bg-[#111113]">Monthly</option>
                    <option value="Quarterly" className="bg-[#111113]">Quarterly</option>
                    <option value="Weekly" className="bg-[#111113]">Weekly</option>
                    <option value="Annual" className="bg-[#111113]">Annual</option>
                    <option value="One-Time" className="bg-[#111113]">One-Time</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Description / Schedule Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly cloud compute and managed database infrastructure"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Vendor Details */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
                <h6 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Vendor & Supplier Information</span>
                </h6>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">Vendor / Supplier Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amazon Web Services India Pvt Ltd"
                      value={formVendorName}
                      onChange={(e) => setFormVendorName(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">Vendor GSTIN (15 Digits)</label>
                    <input
                      type="text"
                      placeholder="e.g. 27AABCA1234A1Z1"
                      value={formVendorGstin}
                      onChange={(e) => setFormVendorGstin(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Vendor Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Cyber City, Tower B, Mumbai, MH 400051"
                    value={formVendorAddress}
                    onChange={(e) => setFormVendorAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Categorization & Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Transaction Type</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Expense" className="bg-[#111113]">Expense</option>
                    <option value="Purchase" className="bg-[#111113]">Purchase</option>
                    <option value="Sales" className="bg-[#111113]">Sales</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">AI Expense Category</label>
                  <select
                    value={formExpenseCategory}
                    onChange={(e) => setFormExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {defaultExpenseCategories.map(cat => (
                      <option key={cat} value={cat} className="bg-[#111113]">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Smart Tags</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a tag and press Enter or Add..."
                    value={formTagInput}
                    onChange={(e) => setFormTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formTags.map(tag => (
                    <span key={tag} className="inline-flex items-center text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-lg space-x-1">
                      <span>#{tag}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTag(tag)}
                        className="text-indigo-400 hover:text-white ml-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <h6 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Default Line Items</span>
                  </h6>
                  <button
                    type="button"
                    onClick={handleAddFormItem}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-black/30 p-3 rounded-xl border border-white/5 items-center">
                      <div className="col-span-12 sm:col-span-5 space-y-1">
                        <label className="text-[10px] text-slate-400">Description *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. AWS EC2 Cloud Node"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-2 space-y-1">
                        <label className="text-[10px] text-slate-400">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <label className="text-[10px] text-slate-400">Unit Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-2 space-y-1">
                        <label className="text-[10px] text-slate-400">GST %</label>
                        <select
                          value={item.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>

                      <div className="col-span-2 sm:col-span-1 flex justify-end pt-4">
                        <button
                          type="button"
                          disabled={formItems.length <= 1}
                          onClick={() => handleRemoveFormItem(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Standard Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Due within 10 days of invoice date."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
                >
                  {editingTemplate ? "Save Changes" : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
