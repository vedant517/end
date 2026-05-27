import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetCustomersQuery,
  useGetCustomerStatsQuery,
} from "../../features/customers/customerApi";
import {
  Search, ChevronLeft, ChevronRight, MoreHorizontal, Bell, Zap,
  ChevronDown, SlidersHorizontal, ArrowLeftRight, Calendar, Filter,
  X, Hash, ShoppingBag, DollarSign, Phone, Mail, Star, Users, TrendingUp, UserCheck, BarChart2,
} from "lucide-react";
import { formatINR } from "../../utils/currency";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const G       = "#85754E";
const LIGHT_G = "#FFF5E2";

function resolveCustomer(raw) {
  const clean = (v) => (v && typeof v === "string" && v.trim() ? v.trim() : null);
  const id    = clean(raw?._id?.toString()) || clean(raw?.id?.toString()) || null;
  const email = clean(raw?.email);
  const phone = clean(raw?.phone);
  const name  = clean(raw?.name);
  const displayName = name || email || (id ? `Customer …${id.slice(-6)}` : "Unknown Customer");
  const avatarLetter = (name?.[0] || email?.[0] || "?").toUpperCase();
  return { id, email, phone, name, displayName, avatarLetter };
}

/* ── Stat Card ── */
function StatCard({ title, value, badge, badgeUp, sub, loading, icon, isFirst }) {
  const color = isFirst ? '#ffffff' : '#85754E';
  return (
    <div
      className={`rounded-2xl border border-slate-100 p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between h-full ${isFirst ? 'bg-heritage' : 'bg-white'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isFirst ? 'bg-white/20' : 'bg-slate-50 border border-slate-100'}`}
        >
          {icon}
        </div>
        {badge && (
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 uppercase tracking-wide ${
              isFirst ? 'bg-white/20 text-white' : (badgeUp ? 'bg-amber-50 text-[#85754E]' : 'bg-red-50 text-rose-600')
            }`}
          >
            {badgeUp ? '↑' : '↓'} {badge}
          </span>
        )}
      </div>
      <div>
        <div className={`text-2xl font-black tracking-tight leading-none mb-1 ${isFirst ? 'text-white' : 'text-heritage'}`}>
          {loading ? '...' : value}
        </div>
        <div className={`text-[12px] font-black uppercase tracking-widest ${isFirst ? 'text-white/70' : 'text-heritage/60'}`}>{title}</div>
        {sub && <div className={`text-[11px] font-bold mt-1 uppercase tracking-tight ${isFirst ? 'text-white/60' : 'text-slate-400'}`}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Weekly Growth Chart ── */
function CustomerWeeklyChart({ data, loading }) {
  if (loading) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-slate-200 border-t-[#85754E] rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }
  const chartData = data.length > 0
    ? data
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({ day, count: 0 }));

  const maxVal = Math.max(...chartData.map(d => d.count), 0);
  const yMax = maxVal === 0 ? 5 : Math.ceil(maxVal * 1.4);

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={G} stopOpacity={0.25} />
              <stop offset="95%" stopColor={G} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} dy={6} interval={0} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[0, yMax]} allowDecimals={false} width={30} />
          <Tooltip
            cursor={{ stroke: G, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div style={{ background: `linear-gradient(135deg, ${G}, #b09e6d)` }} className="text-white text-xs font-bold px-3.5 py-2 rounded-xl text-center shadow-lg">
                  <div className="text-[10px] opacity-85">{label}</div>
                  <div>{payload[0].value} customer{payload[0].value !== 1 ? "s" : ""}</div>
                </div>
              ) : null
            }
          />
          <Area type="monotone" dataKey="count" stroke={G} strokeWidth={2.5} fill="url(#cgGrad)" fillOpacity={1}
            dot={{ r: 4, fill: "#fff", stroke: G, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: G, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Customer Details Modal ── */
function CustomerDetailsModal({ customer, onClose, onViewOrders }) {
  if (!customer) return null;
  const { id, email, phone, name, displayName, avatarLetter } = resolveCustomer(customer);

  const InfoRow = ({ icon, label, value, mono, accent }) => (
    <div className="flex items-start gap-2.5 py-2 border-b border-slate-50">
      <div className="w-[26px] h-[26px] rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">{label}</div>
        {value ? (
          <div className={`text-xs font-bold break-all ${accent ? 'text-[#85754E]' : 'text-slate-900'} ${mono ? 'font-mono' : ''}`}>{value}</div>
        ) : (
          <div className="text-[11px] text-slate-300 italic">—</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[440px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[18px] font-extrabold text-white flex-shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${G}, #b09e6d)`, boxShadow: '0 4px 12px rgba(147,131,89,0.3)' }}>
              {avatarLetter}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 m-0">{displayName}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-[#85754E] border border-amber-100">
                  {customer.status || "Standard"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 cursor-pointer flex items-center justify-center hover:bg-slate-100">
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
              <div className="text-[22px] font-extrabold text-slate-800">{customer.orderCount ?? 0}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total Orders</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
              <div className="text-base font-extrabold text-slate-800">{formatINR(customer.totalSpend ?? 0)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total Spent</div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl px-2 py-1">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest px-1.5 pt-2 pb-0.5 m-0">Identity</p>
            <InfoRow icon={<Hash size={12} color={G} />}  label="User ID" value={id}    mono accent />
            <InfoRow icon={<Mail size={12} color={G} />}  label="Email"   value={email} />
            <InfoRow icon={<Phone size={12} color={G} />} label="Phone"   value={phone} />
          </div>

          {(customer.orderIds || []).filter(Boolean).length > 0 && (
            <div className="bg-slate-50 rounded-xl px-3.5 py-2">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 m-0">Order IDs</p>
              <div className="flex flex-col gap-1.5">
                {customer.orderIds.filter(Boolean).slice(0, 8).map((oid, i) => (
                  <div key={i} className="font-mono text-[11px] font-semibold text-[#85754E] bg-amber-50 px-2.5 py-1 rounded-md">
                    #{typeof oid === "string" ? oid : oid?._id || String(oid)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl bg-transparent text-xs cursor-pointer text-slate-500 font-semibold hover:bg-slate-50">
              Close
            </button>
            <button
              onClick={() => {
                if (onViewOrders && id) {
                  onViewOrders(id);
                } else {
                  alert(`View orders for: ${id}`);
                }
              }}
              className="flex-1 py-2.5 border-0 rounded-xl text-white text-xs font-bold cursor-pointer hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${G}, #b09e6d)`, boxShadow: '0 4px 12px rgba(147,131,89,0.3)' }}
            >
              View Orders
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function Customers() {
  const navigate = useNavigate();
  const [currentPage,      setCurrentPage]      = useState(1);
  const [searchQuery,      setSearchQuery]      = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showMoreActions,  setShowMoreActions]  = useState(false);
  const [weekOffset,       setWeekOffset]       = useState(0);
  const itemsPerPage = 5;

  const { data: stats, isLoading: statsLoading, error: statsError } = useGetCustomerStatsQuery();
  const { data, isLoading, isFetching, error: customersError } = useGetCustomersQuery({ page: currentPage, search: searchQuery });

  const totalCustomers = useMemo(() => {
    if (!stats) return 0;
    if (stats?.data?.totalCustomers != null) return stats.data.totalCustomers;
    if (stats?.totalCustomers != null) return stats.totalCustomers;
    if (stats?.total != null) return stats.total;
    if (Array.isArray(stats?.data)) return stats.data.length;
    return 0;
  }, [stats]);

  const newCustomers    = useMemo(() => { if (!stats) return 0; return stats?.data?.newCustomers ?? stats?.newCustomers ?? 0; }, [stats]);
  const repeatCustomers = useMemo(() => { if (!stats) return 0; return stats?.data?.repeatCustomers ?? stats?.repeatCustomers ?? 0; }, [stats]);

  const customers  = data?.data || [];
  const totalPages = data?.pagination?.pages || 1;
  const displayTotalCustomers = totalCustomers > 0 ? totalCustomers : (data?.pagination?.total ?? data?.total ?? customers.length ?? 0);

  const weeklyData = useMemo(() => {
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const now = new Date();
    const todayDay = now.getDay();
    const diffToMonday = (todayDay === 0 ? -6 : 1 - todayDay);
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() + diffToMonday + (weekOffset * 7));
    startOfThisWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfThisWeek);
    endOfWeek.setDate(startOfThisWeek.getDate() + 7);

    const serverWeekly = stats?.weeklyGrowth || stats?.data?.weeklyGrowth || null;
    if (Array.isArray(serverWeekly) && serverWeekly.length > 0 && weekOffset === 0) {
      serverWeekly.forEach(item => {
        const dayName = item.day || item._id;
        if (counts.hasOwnProperty(dayName)) counts[dayName] = item.count ?? 0;
      });
      return dayNames.map(day => ({ day, count: counts[day] }));
    }

    if (weekOffset === 0 && newCustomers > 0) {
      const shortDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const todayName = shortDay[now.getDay()];
      if (counts.hasOwnProperty(todayName)) counts[todayName] = newCustomers;
    }

    const shortDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const allCustomersForChart = customers.length > 0 ? customers : [];
    allCustomersForChart.forEach(c => {
      if (!c.createdAt) return;
      const d = new Date(c.createdAt);
      if (d >= startOfThisWeek && d < endOfWeek) {
        const dayName = shortDay[d.getDay()];
        if (counts.hasOwnProperty(dayName)) counts[dayName] += 1;
      }
    });

    const rawCustomers = stats?.data?.customers || stats?.customers || [];
    rawCustomers.forEach(c => {
      if (!c.createdAt) return;
      const d = new Date(c.createdAt);
      if (d >= startOfThisWeek && d < endOfWeek) {
        const dayName = shortDay[d.getDay()];
        if (counts.hasOwnProperty(dayName)) counts[dayName] += 1;
      }
    });

    return dayNames.map(day => ({ day, count: counts[day] }));
  }, [stats, customers, weekOffset, newCustomers]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === -1) return "Last Week";
    return `${Math.abs(weekOffset)} weeks ago`;
  }, [weekOffset]);

  const weekRangeLabel = useMemo(() => {
    const now = new Date();
    const todayDay = now.getDay();
    const diffToMonday = (todayDay === 0 ? -6 : 1 - todayDay);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday + (weekOffset * 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(startOfWeek)} – ${fmt(endOfWeek)}`;
  }, [weekOffset]);

  const totalForWeek = weeklyData.reduce((s, d) => s + d.count, 0);

  const getStatusStyle = (status) => {
    switch (status) {
      case "VIP":
      case "Active": return "bg-amber-50 text-[#85754E] border border-amber-100";
      default:       return "bg-slate-50 text-slate-500 border border-slate-200";
    }
  };

  if (statsError || customersError) {
    return (
      <div className="w-full min-h-[calc(100vh-60px)] bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <p className="text-red-500 mb-2">Error loading data</p>
          <p className="text-xs text-slate-500 mb-4">{statsError?.message || customersError?.message || "Please check your API connection"}</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2 text-white border-0 rounded-lg text-xs cursor-pointer hover:opacity-90" style={{ background: G }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-60px)] bg-slate-50 font-sans">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .cust-row:hover { background: #f8fafc !important; }`}</style>
      <div className="p-5">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2.5">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">Customer Management</h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 mb-0">Manage customer base and track shopping behavior.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 w-60 shadow-sm">
              <Search size={13} className="text-slate-400" />
              <input
                type="text" placeholder="Search by name, email or phone…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="border-0 outline-none w-full bg-transparent text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-slate-900">Overview</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard title="Total Customers" value={displayTotalCustomers} badge="↑ 12.5%" badgeUp sub="vs last month" loading={statsLoading && isLoading} icon={<Users size={16} color={G} />} isFirst={true} />
          <StatCard title="New Customers"   value={newCustomers}          badge="↑ 23%"   badgeUp sub="This month"    loading={statsLoading}           icon={<TrendingUp size={16} color={G} />} />
          <StatCard title="Repeat Customers" value={repeatCustomers}      badge="↑ 8.2%"  badgeUp sub="Returning rate" loading={statsLoading}          icon={<UserCheck size={16} color={G} />} />
          <StatCard title="Growth"           value="24%"                  badge="↑ 5%"    badgeUp sub="vs last month"  loading={false}                 icon={<BarChart2 size={16} color={G} />} />
        </div>

        {/* Weekly Growth Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <span className="text-sm font-bold text-slate-900">Customer Growth</span>
              <p className="text-[10px] text-slate-400 mt-0.5 mb-0">Weekly new customer activity · {weekRangeLabel}</p>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex border border-amber-100 rounded-lg overflow-hidden bg-[#FFF5E2]">
                <button onClick={() => setWeekOffset(w => w - 1)}
                  className="px-2.5 py-1 bg-transparent border-0 cursor-pointer text-slate-500 flex items-center border-r border-amber-100 hover:bg-white/50">
                  <ChevronLeft size={13} />
                </button>
                <span className="px-3 py-1 text-[11px] font-semibold text-[#85754E] flex items-center bg-white/40 whitespace-nowrap">{weekLabel}</span>
                <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0}
                  className="px-2.5 py-1 bg-transparent border-0 cursor-pointer text-slate-500 flex items-center border-l border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          <CustomerWeeklyChart data={weeklyData} loading={statsLoading} />

          {!statsLoading && (
            <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-slate-100 flex-wrap gap-2">
              <div className="flex gap-2.5 flex-wrap">
                {weeklyData.filter(d => d.count > 0).map(d => (
                  <div key={d.day} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: G }} />
                    <span className="text-[10px] text-slate-500 font-semibold">{d.day}: <strong>{d.count}</strong></span>
                  </div>
                ))}
                {weeklyData.every(d => d.count === 0) && <span className="text-[10px] text-slate-400">No new customers this week.</span>}
              </div>
              <div className="flex items-center gap-2">
                {newCustomers > 0 && totalForWeek === 0 && weekOffset === 0 && (
                  <div className="text-[10px] text-slate-400 italic">{newCustomers} new this month</div>
                )}
                <div className="text-[11px] font-bold text-[#85754E] bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                  {totalForWeek > 0 ? `${totalForWeek} this week` : newCustomers > 0 && weekOffset === 0 ? `${newCustomers} new customers` : "0 this week"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Customer Table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm font-bold text-slate-900">Customer List</span>
              <p className="text-[10px] text-slate-400 mt-0.5 mb-0">
                {isFetching ? "Refreshing…" : `${displayTotalCustomers} total · ${customers.length} shown`}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-10">
              <div className="w-8 h-8 border-[3px] border-slate-200 border-t-[#85754E] rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr className="bg-gray-50">
                      {["No", "Customer", "Phone", "Email", "Orders", "Spend", "Status", ""].map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-10 text-center text-slate-400">
                          <Users size={32} className="text-slate-200 block mx-auto mb-2" />
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      customers.map((customer, idx) => {
                        const { id, email, phone, avatarLetter, displayName } = resolveCustomer(customer);
                        return (
                          <tr
                            key={id || idx}
                            className="cust-row border-b border-slate-100 cursor-pointer transition-colors"
                            onClick={() => setSelectedCustomer(customer)}
                          >
                            <td className="px-3 py-3 text-slate-400 text-[11px] font-semibold">
                              {(currentPage - 1) * itemsPerPage + idx + 1}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2.5 min-w-[140px]">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                                  style={{ background: `linear-gradient(135deg, ${G}, #b09e6d)` }}
                                >
                                  {avatarLetter}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">{displayName}</div>
                                  <div className="font-mono text-[9px] font-semibold text-[#85754E] opacity-80">{id ? `…${id.slice(-8)}` : "—"}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {phone ? (
                                <div className="flex items-center gap-1">
                                  <Phone size={11} className="text-slate-400" />
                                  <span className="text-[11px] text-slate-500 font-semibold">{phone}</span>
                                </div>
                              ) : <span className="text-[11px] text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-500 text-[11px] max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap" title={email || ""}>
                              {email ? (
                                <div className="flex items-center gap-1">
                                  <Mail size={11} className="text-slate-400" /><span>{email}</span>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-500 font-bold">
                              <div className="flex items-center gap-1">
                                <ShoppingBag size={11} className="text-slate-400" />
                                {customer.orderCount ?? 0}
                              </div>
                            </td>
                            <td className="px-3 py-3 font-bold text-slate-900">{formatINR(customer.totalSpend ?? 0)}</td>
                            <td className="px-3 py-3">
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getStatusStyle(customer.status)}`}>
                                {customer.status || "Inactive"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <button onClick={e => { e.stopPropagation(); setSelectedCustomer(customer); }}
                                className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600">
                                <MoreHorizontal size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="flex items-center gap-1 bg-transparent border-0 text-xs font-semibold disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                    style={{ color: currentPage === 1 ? undefined : '#475569' }}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-[11px] font-bold cursor-pointer transition-colors"
                        style={{ background: currentPage === p ? G : 'transparent', color: currentPage === p ? '#fff' : '#475569' }}
                      >{p}</button>
                    ))}
                    {totalPages > 5 && (
                      <>
                        <span className="flex items-center px-1 text-xs text-slate-400">…</span>
                        <button onClick={() => setCurrentPage(totalPages)}
                          className="w-7 h-7 rounded-lg border border-slate-200 text-[11px] font-bold cursor-pointer"
                          style={{ background: currentPage === totalPages ? G : 'transparent', color: currentPage === totalPages ? '#fff' : '#475569' }}
                        >{totalPages}</button>
                      </>
                    )}
                  </div>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="flex items-center gap-1 bg-transparent border-0 text-xs font-semibold disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                    style={{ color: currentPage === totalPages ? undefined : '#475569' }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onViewOrders={(id) => navigate('/orders', { state: { search: id } })}
        />
      )}
    </div>
  );
}