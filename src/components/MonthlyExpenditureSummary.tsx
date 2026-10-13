import React, { useState, useMemo } from "react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  ComposedChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine
} from "recharts";
import { Invoice } from "../types";
import { formatRupees, categoryStyleMap } from "../utils/invoiceUtils";
import { 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Layers, 
  Zap, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Wallet
} from "lucide-react";

interface MonthlyExpenditureSummaryProps {
  invoices: Invoice[];
}

export default function MonthlyExpenditureSummary({ invoices }: MonthlyExpenditureSummaryProps) {
  const [timeRange, setTimeRange] = useState<6 | 12 | "all">(6);
  const [chartMode, setChartMode] = useState<"trend" | "categories" | "burnRate">("trend");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // 1. Process Monthly Expenditure based on invoice date and totalAmount fields
  const { 
    monthlyData, 
    totalPeriodExpenditure, 
    avgMonthlyExpenditure, 
    peakMonth, 
    lowestMonth, 
    momChangePercent,
    topCategories
  } = useMemo(() => {
    const now = new Date();
    const count = timeRange === "all" ? 18 : timeRange;

    // Build ordered month slots
    const monthSlots: { 
      key: string; 
      label: string; 
      fullName: string;
      year: number;
      monthIndex: number;
      totalExpenditure: number; 
      invoiceCount: number; 
      categories: Record<string, number>;
      largestCategory: { name: string; amount: number };
    }[] = [];

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const fullName = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      monthSlots.push({
        key,
        label,
        fullName,
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        totalExpenditure: 0,
        invoiceCount: 0,
        categories: {},
        largestCategory: { name: "General", amount: 0 }
      });
    }

    const categoryGrandTotals: Record<string, { total: number; count: number }> = {};

    // Filter and accumulate expenditures
    invoices.forEach(inv => {
      if (!inv.date) return;
      const invDate = new Date(inv.date);
      if (isNaN(invDate.getTime())) return;

      const isExpenseOrPurchase = 
        inv.category === "Expense" || 
        inv.category === "Purchase" || 
        inv.category === "Debit Note" ||
        Boolean(inv.expenseCategory && inv.expenseCategory !== "Sales");

      // We consider expense/purchase invoices as primary expenditures.
      // If none are tagged expense/purchase, we treat all bills as operational spend
      const isExpenditure = isExpenseOrPurchase;
      const spendAmount = inv.totalAmount || 0;
      if (spendAmount <= 0) return;

      const catName = inv.expenseCategory || (inv.category === "Purchase" ? "Raw Materials" : inv.category || "Other");
      
      // Track category totals
      if (!categoryGrandTotals[catName]) {
        categoryGrandTotals[catName] = { total: 0, count: 0 };
      }
      categoryGrandTotals[catName].total += spendAmount;
      categoryGrandTotals[catName].count += 1;

      // Match month
      const key = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, "0")}`;
      const slot = monthSlots.find(s => s.key === key);
      if (slot) {
        slot.totalExpenditure += spendAmount;
        slot.invoiceCount += 1;
        slot.categories[catName] = (slot.categories[catName] || 0) + spendAmount;

        if (slot.categories[catName] > slot.largestCategory.amount) {
          slot.largestCategory = { name: catName, amount: slot.categories[catName] };
        }
      }
    });

    const activeMonths = monthSlots.filter(m => m.totalExpenditure > 0 || timeRange !== "all");
    const totalExp = monthSlots.reduce((sum, m) => sum + m.totalExpenditure, 0);
    const nonZeroMonths = monthSlots.filter(m => m.totalExpenditure > 0).length || 1;
    const avgExp = Math.round(totalExp / Math.max(1, monthSlots.length));

    // Peak and lowest
    let peak = monthSlots[0] || { label: "N/A", totalExpenditure: 0 };
    let lowest = monthSlots[0] || { label: "N/A", totalExpenditure: Infinity };

    monthSlots.forEach(m => {
      if (m.totalExpenditure > peak.totalExpenditure) peak = m;
      if (m.totalExpenditure > 0 && m.totalExpenditure < lowest.totalExpenditure) lowest = m;
    });

    // Month-over-Month Change between last 2 months
    const currentMonthSpend = monthSlots[monthSlots.length - 1]?.totalExpenditure || 0;
    const previousMonthSpend = monthSlots[monthSlots.length - 2]?.totalExpenditure || 0;
    let momChange = 0;
    if (previousMonthSpend > 0) {
      momChange = Math.round(((currentMonthSpend - previousMonthSpend) / previousMonthSpend) * 100);
    }

    // Top Categories sorted
    const topCats = Object.entries(categoryGrandTotals)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    // Format chart rows with category breakdowns
    const formattedRows = monthSlots.map((slot, idx) => {
      const prevSlot = monthSlots[idx - 1];
      const mom = prevSlot && prevSlot.totalExpenditure > 0
        ? Math.round(((slot.totalExpenditure - prevSlot.totalExpenditure) / prevSlot.totalExpenditure) * 100)
        : 0;

      return {
        month: slot.label,
        fullName: slot.fullName,
        expenditure: slot.totalExpenditure,
        average: avgExp,
        count: slot.invoiceCount,
        momChange: mom,
        largestCategory: slot.largestCategory.name,
        // Categories
        Software: slot.categories["Software"] || 0,
        Utilities: slot.categories["Utilities"] || 0,
        Travel: slot.categories["Travel"] || 0,
        Hardware: slot.categories["Hardware"] || 0,
        Marketing: slot.categories["Marketing"] || 0,
        Rent: slot.categories["Rent"] || 0,
        Consulting: slot.categories["Consulting"] || 0,
        "Raw Materials": slot.categories["Raw Materials"] || 0,
        "Office Supplies": slot.categories["Office Supplies"] || 0,
        Other: (slot.totalExpenditure - (
          (slot.categories["Software"] || 0) +
          (slot.categories["Utilities"] || 0) +
          (slot.categories["Travel"] || 0) +
          (slot.categories["Hardware"] || 0) +
          (slot.categories["Marketing"] || 0) +
          (slot.categories["Rent"] || 0) +
          (slot.categories["Consulting"] || 0) +
          (slot.categories["Raw Materials"] || 0) +
          (slot.categories["Office Supplies"] || 0)
        )) || 0
      };
    });

    return {
      monthlyData: formattedRows,
      totalPeriodExpenditure: totalExp,
      avgMonthlyExpenditure: avgExp,
      peakMonth: peak,
      lowestMonth: lowest.totalExpenditure === Infinity ? { label: "N/A", totalExpenditure: 0 } : lowest,
      momChangePercent: momChange,
      topCategories: topCats
    };
  }, [invoices, timeRange]);

  return (
    <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 space-y-6 animate-fade-in-up" id="monthly-expenditure-summary-hub">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg flex items-center space-x-2">
                <span>Monthly Expenditure Summary</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                  {formatRupees(totalPeriodExpenditure)} Total Spend
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Detailed trend analysis of operational spend, procurement costs, and recurring vendor expenditures
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Chart Mode + Time Range */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Mode Switcher */}
          <div className="bg-[#1c1c1e] p-1 border border-white/5 rounded-xl flex items-center space-x-1">
            <button
              onClick={() => setChartMode("trend")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                chartMode === "trend"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Trend Area</span>
            </button>

            <button
              onClick={() => setChartMode("categories")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                chartMode === "categories"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Category Stack</span>
            </button>

            <button
              onClick={() => setChartMode("burnRate")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                chartMode === "burnRate"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>MoM Burn Rate</span>
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="bg-[#1c1c1e] p-1 border border-white/5 rounded-xl flex items-center space-x-1">
            <button
              onClick={() => setTimeRange(6)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === 6 ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              6M
            </button>
            <button
              onClick={() => setTimeRange(12)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === 12 ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              12M
            </button>
            <button
              onClick={() => setTimeRange("all")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === "all" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Period Spend */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Period Expenditure
          </span>
          <h4 className="text-xl font-bold font-mono text-rose-400">
            {formatRupees(totalPeriodExpenditure)}
          </h4>
          <span className="text-[10px] text-slate-500 block">
            Across {monthlyData.reduce((s, m) => s + m.count, 0)} spend invoices
          </span>
        </div>

        {/* Average Monthly Burn */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Avg Monthly Burn
          </span>
          <h4 className="text-xl font-bold font-mono text-white">
            {formatRupees(avgMonthlyExpenditure)}
          </h4>
          <span className="text-[10px] text-slate-500 block">
            Baseline operating run-rate
          </span>
        </div>

        {/* Peak Spending Month */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Peak Spend Month
          </span>
          <h4 className="text-xl font-bold font-mono text-amber-400">
            {peakMonth.label || "N/A"}
          </h4>
          <span className="text-[10px] text-amber-400/80 font-mono block">
            {formatRupees(peakMonth.totalExpenditure)} spent
          </span>
        </div>

        {/* Month-over-Month Momentum */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            MoM Spend Velocity
          </span>
          <div className="flex items-center space-x-1">
            {momChangePercent > 0 ? (
              <span className="text-xl font-bold font-mono text-rose-400 flex items-center">
                <ArrowUpRight className="w-5 h-5 mr-0.5" />
                +{momChangePercent}%
              </span>
            ) : momChangePercent < 0 ? (
              <span className="text-xl font-bold font-mono text-emerald-400 flex items-center">
                <ArrowDownRight className="w-5 h-5 mr-0.5" />
                {momChangePercent}%
              </span>
            ) : (
              <span className="text-xl font-bold font-mono text-slate-300">
                0.0%
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block">
            {momChangePercent > 0 ? "Increased expenditure" : momChangePercent < 0 ? "Reduced cash outflow" : "Stable spend rate"}
          </span>
        </div>
      </div>

      {/* Main Recharts Area / Composed / Bar Visualization */}
      <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-rose-400" />
            <span>
              {chartMode === "trend" ? "Monthly Total Expenditure Curve & Moving Average" :
               chartMode === "categories" ? "Monthly Spend Breakdown by Cost Category" :
               "Month-over-Month Burn Rate Discrepancy & Variance"}
            </span>
          </span>

          <span className="text-[11px] text-slate-500 font-mono">
            Amounts in INR (₹) • Computed from Invoice Date & Total Fields
          </span>
        </div>

        <div className="h-72 w-full" id="expenditure-recharts-container">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "trend" ? (
              <AreaChart data={monthlyData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="expenditureAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.06} vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `₹${val >= 100000 ? `${(val/100000).toFixed(1)}L` : val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#18181b] border border-white/10 p-3 rounded-xl shadow-xl space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-white text-xs border-b border-white/10 pb-1 flex justify-between">
                            <span>{data.fullName}</span>
                            <span className="text-slate-400 font-mono">{data.count} Bills</span>
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center text-rose-400 font-bold">
                              <span>Total Expenditure:</span>
                              <span className="font-mono">{formatRupees(data.expenditure)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400 text-[11px]">
                              <span>Period Average:</span>
                              <span className="font-mono">{formatRupees(data.average)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400 text-[11px]">
                              <span>Top Cost Driver:</span>
                              <span className="font-semibold text-slate-200">{data.largestCategory}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine 
                  y={avgMonthlyExpenditure} 
                  stroke="#a855f7" 
                  strokeDasharray="4 4" 
                  label={{ value: "Monthly Avg", fill: "#c084fc", fontSize: 10, position: "top" }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="expenditure" 
                  name="Expenditure" 
                  stroke="#f43f5e" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#expenditureAreaGradient)" 
                />
              </AreaChart>
            ) : chartMode === "categories" ? (
              <BarChart data={monthlyData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₹${val >= 100000 ? `${(val/100000).toFixed(1)}L` : val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                />
                <Tooltip 
                  formatter={(val, name) => [formatRupees(Number(val)), name]}
                  contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}
                  itemStyle={{ fontSize: "11px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="Software" stackId="spend" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Utilities" stackId="spend" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Travel" stackId="spend" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Rent" stackId="spend" fill="#14b8a6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Raw Materials" stackId="spend" fill="#f97316" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Marketing" stackId="spend" fill="#ec4899" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Hardware" stackId="spend" fill="#a855f7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Other" stackId="spend" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <ComposedChart data={monthlyData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₹${val >= 100000 ? `${(val/100000).toFixed(1)}L` : val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                />
                <Tooltip 
                  formatter={(val, name) => [name === "MoM %" ? `${val}%` : formatRupees(Number(val)), name]}
                  contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <Bar dataKey="expenditure" name="Expenditure" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Line type="monotone" dataKey="average" name="Average Baseline" stroke="#818cf8" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Spend Distribution Cards */}
      {topCategories.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span>Spend Breakdown by Category ({topCategories.length})</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              Aggregated across all period expenditures
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {topCategories.map(cat => {
              const style = categoryStyleMap[cat.name] || categoryStyleMap["Other"] || {
                bg: "bg-slate-500/10",
                text: "text-slate-300",
                border: "border-slate-500/20",
                icon: "🏷️"
              };
              const percentage = totalPeriodExpenditure > 0 ? Math.round((cat.total / totalPeriodExpenditure) * 100) : 0;

              return (
                <div 
                  key={cat.name} 
                  className={`p-3 rounded-xl border ${style.bg} ${style.border} space-y-1.5 transition-all hover:scale-[1.02]`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-base">{style.icon}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.text} bg-black/30 font-mono`}>
                      {percentage}%
                    </span>
                  </div>
                  <div>
                    <p className={`font-semibold text-xs truncate ${style.text}`}>{cat.name}</p>
                    <p className="font-mono text-xs font-bold text-white pt-0.5">{formatRupees(cat.total)}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{cat.count} records</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
