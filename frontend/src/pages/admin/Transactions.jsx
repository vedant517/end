import React, { useState } from 'react';
import {
  Search, Bell, Filter, MoreHorizontal, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, IndianRupee, RefreshCw, Eye, RotateCcw,
  CheckCircle2, XCircle, Clock, AlertCircle, CreditCard
} from 'lucide-react';
import {
  useGetTransactionsQuery,
  useGetTransactionStatsQuery,
  useRefundTransactionMutation,
} from '../../features/transactions/transactionApi';
import toast from 'react-hot-toast';
import { formatINR } from '../../utils/currency';

const statusConfig = {
  captured:   { bg: '#f0fdf4', color: '#16a34a', icon: CheckCircle2, label: 'Success' },
  created:    { bg: '#fefce8', color: '#a16207', icon: Clock,         label: 'Pending' },
  failed:     { bg: '#fef2f2', color: '#dc2626', icon: XCircle,       label: 'Failed' },
  refunded:   { bg: '#f0f9ff', color: '#0369a1', icon: RotateCcw,     label: 'Refunded' },
  authorized: { bg: '#f0fdf4', color: '#15803d', icon: CheckCircle2, label: 'Authorized' },
};

function StatCard({ title, value, icon: Icon, color, sub, trend, trendUp, isFirst }) {
  const accent = isFirst ? '#ffffff' : '#85754E';
  return (
    <div className={`rounded-2xl border border-slate-100 p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between h-full ${isFirst ? 'bg-heritage' : 'bg-white'}`}>
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isFirst ? 'bg-white/20' : 'bg-slate-50 border border-slate-100'}`}
        >
          <Icon size={20} style={{ color: accent }} />
        </div>
        {trend && (
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 uppercase tracking-wide ${
              isFirst ? 'bg-white/20 text-white' : (trendUp ? 'bg-amber-50 text-[#85754E]' : 'bg-red-50 text-rose-600')
            }`}
          >
            {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {trend}
          </span>
        )}
      </div>
      <div>
        <div className={`text-2xl font-black tracking-tight leading-none mb-1 ${isFirst ? 'text-white' : 'text-heritage'}`}>{value}</div>
        <div className={`text-[12px] font-black uppercase tracking-widest ${isFirst ? 'text-white/70' : 'text-heritage/60'}`}>{title}</div>
        {sub && <div className={`text-[11px] font-bold mt-1 uppercase tracking-tight ${isFirst ? 'text-white/60' : 'text-slate-400'}`}>{sub}</div>}
      </div>
    </div>
  );
}

function TransactionDetailModal({ transaction, onClose, onRefund }) {
  if (!transaction) return null;
  const method = transaction.paymentMethod || transaction.order?.paymentMethod || 'Razorpay';
  const isCod = method.toLowerCase() === 'cod' || method.toLowerCase() === 'cash on delivery';
  const isSuccess = !isCod && (transaction.status === 'captured' || transaction.order?.paymentStatus === 'completed' || transaction.status === 'success');
  
  const sc = isSuccess ? statusConfig.captured : (isCod ? statusConfig.created : statusConfig[transaction.status] || statusConfig.created);
  const StatusIcon = sc.icon;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900 m-0">Transaction Details</h3>
          <button
            onClick={onClose}
            className="bg-transparent border-0 text-2xl cursor-pointer text-slate-400 leading-none hover:text-slate-600"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Status row */}
          <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl">
            <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold uppercase flex items-center gap-1.5"
              style={{ background: sc.bg, color: sc.color }}
            >
              <StatusIcon size={12} /> {sc.label}
            </span>
          </div>

          {[
            ['Transaction ID', transaction.transactionId],
            ['Razorpay Order', transaction.razorpayOrderId],
            ['Payment ID', transaction.razorpayPaymentId || '—'],
            ['Amount', formatINR(transaction.amount)],
            ['Currency', transaction.currency || 'INR'],
            ['Receipt', transaction.receipt || '—'],
            ['Date', new Date(transaction.createdAt).toLocaleString('en-IN')],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
              <span className="text-xs font-extrabold text-slate-800 font-mono">{value}</span>
            </div>
          ))}

          {transaction.order && (
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs font-bold text-slate-400 uppercase">Linked Order</span>
              <span className="text-xs font-extrabold text-[#85754E]">{transaction.order?.orderId || transaction.order}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-100 border-0 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
          {transaction.status === 'captured' && (
            <button
              onClick={() => onRefund(transaction._id)}
              className="flex-1 py-3 text-xs font-bold text-white bg-amber-400 border-0 rounded-xl cursor-pointer flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors"
            >
              <RotateCcw size={14} /> Initiate Refund
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Transactions() {
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const itemsPerPage = 10;

  const filters = [
    { label: 'All', value: null },
    { label: 'Success', value: 'captured' },
    { label: 'Pending', value: 'created' },
    { label: 'Failed', value: 'failed' },
    { label: 'Refunded', value: 'refunded' },
  ];

  const { data: txnResponse, isLoading } = useGetTransactionsQuery({ status: activeFilter, page: currentPage, limit: itemsPerPage });
  const { data: stats, isLoading: statsLoading } = useGetTransactionStatsQuery();
  const [refundTxn] = useRefundTransactionMutation();

  const transactions = txnResponse?.data || [];
  const totalPages = txnResponse?.pages || 1;

  const filtered = transactions.filter((t) =>
    (t.transactionId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.razorpayOrderId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.razorpayPaymentId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefund = async (id) => {
    if (!window.confirm('Are you sure you want to initiate a refund?')) return;
    try {
      await refundTxn({ id, reason: 'Admin initiated refund' }).unwrap();
      toast.success('Refund initiated successfully');
      setSelectedTxn(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Refund failed');
    }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex-1 min-w-0 flex flex-col gap-6 p-6">

        {/* ── Header ── */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-3 m-0">
              <div className="w-10 h-10 bg-heritage rounded-xl flex items-center justify-center">
                <CreditCard size={20} color="white" />
              </div>
              Transactions
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5 ml-[52px]">
              Razorpay Payment Gateway · Real-time Ledger
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID or Payment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs w-60 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <StatCard title="Total Transactions" value={statsLoading ? '...' : stats?.total || 0} icon={CreditCard} isFirst={true} />
          <StatCard title="Total Revenue" value={statsLoading ? '...' : formatINR(stats?.totalRevenue || 0)} icon={IndianRupee} trend="+12.5%" trendUp />
          <StatCard title="Successful" value={statsLoading ? '...' : stats?.captured || 0} icon={CheckCircle2} />
          <StatCard title="Pending" value={statsLoading ? '...' : stats?.pending || 0} icon={Clock} />
          <StatCard title="Failed / Refunded" value={statsLoading ? '...' : (stats?.failed || 0) + (stats?.refunded || 0)} icon={XCircle} />
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">

          {/* Filters bar */}
          <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center flex-wrap gap-3">
            <div className="flex gap-1 bg-[#FFF5E2] p-1 rounded-xl border border-amber-50 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f.label}
                  onClick={() => { setActiveFilter(f.value); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl border-0 cursor-pointer whitespace-nowrap transition-all ${
                    activeFilter === f.value
                      ? 'bg-white text-[#85754E] shadow-sm'
                      : 'bg-transparent text-slate-400 hover:text-[#85754E]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[300px]">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-4">
                <div
                  className="w-11 h-11 border-4 border-amber-100 border-t-heritage rounded-full"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                />
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Syncing Razorpay Ledger...</span>
              </div>
            ) : (
              <>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-slate-100">
                      {['#', 'Transaction ID', 'Razorpay Order', 'Amount', 'Method', 'Date', 'Status', 'Action'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3.5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ${
                            i === 0 || i >= 3 ? 'text-center' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-16">
                          <CreditCard size={40} className="text-slate-200 mx-auto mb-3" />
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No transactions found</p>
                          <p className="text-xs text-slate-400 mt-1">Transactions will appear once Razorpay payments are processed</p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((t, i) => {
                        const sc = statusConfig[t.status] || statusConfig.created;
                        const StatusIcon = sc.icon;
                        return (
                          <tr
                            key={t._id}
                            onClick={() => setSelectedTxn(t)}
                            className="border-b border-slate-50 cursor-pointer transition-colors hover:bg-gray-50"
                          >
                            <td className="px-3.5 py-3.5 text-center text-xs font-bold text-slate-400">
                              {(currentPage - 1) * itemsPerPage + i + 1}
                            </td>
                            <td className="px-3.5 py-3.5 text-xs font-extrabold text-slate-600 font-mono whitespace-nowrap">
                              {t.transactionId}
                            </td>
                            <td className="px-3.5 py-3.5 text-xs font-bold text-slate-500 font-mono whitespace-nowrap">
                              {t.razorpayOrderId?.slice(0, 20)}...
                            </td>
                            <td className="px-3.5 py-3.5 text-center text-sm font-black text-slate-900 whitespace-nowrap">
                              {formatINR(t.amount)}
                            </td>
                            <td className="px-3.5 py-3.5 text-center">
                              {(() => {
                                const method = t.paymentMethod || t.order?.paymentMethod || 'Razorpay';
                                const isCod = method.toLowerCase() === 'cod' || method.toLowerCase() === 'cash on delivery';
                                return (
                                  <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase whitespace-nowrap bg-slate-100 text-slate-600 border border-slate-200">
                                    {isCod ? 'COD' : 'Razorpay'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3.5 py-3.5 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-3.5 py-3.5 text-center">
                              {(() => {
                                const method = t.paymentMethod || t.order?.paymentMethod || 'Razorpay';
                                const isCod = method.toLowerCase() === 'cod' || method.toLowerCase() === 'cash on delivery';
                                const isSuccess = !isCod && (t.status === 'captured' || t.order?.paymentStatus === 'completed' || t.status === 'success');
                                return isSuccess ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full uppercase whitespace-nowrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                    <CheckCircle2 size={10} /> Success
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full uppercase whitespace-nowrap" style={{ background: '#fefce8', color: '#a16207' }}>
                                    <Clock size={10} /> Pending
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3.5 py-3.5 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedTxn(t); }}
                                className="p-1.5 bg-transparent border-0 cursor-pointer text-slate-300 rounded-md transition-all hover:text-heritage hover:bg-amber-50"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {txnResponse?.total > 0 && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-slate-50 flex-wrap gap-3">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                      Page {currentPage} of {totalPages} · {txnResponse?.total || 0} records
                    </span>
                    <div className="flex gap-1.5 items-center">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={`flex items-center gap-1 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-500 transition-opacity ${
                          currentPage === 1 ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-extrabold transition-colors ${
                            currentPage === i + 1
                              ? 'bg-heritage text-white border-0'
                              : 'bg-white border border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={`flex items-center gap-1 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-500 transition-opacity ${
                          currentPage === totalPages ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {selectedTxn && (
          <TransactionDetailModal
            transaction={selectedTxn}
            onClose={() => setSelectedTxn(null)}
            onRefund={handleRefund}
          />
        )}
      </div>
    </>
  );
}