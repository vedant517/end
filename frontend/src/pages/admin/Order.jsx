import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MoreHorizontal,
  Search,
  ChevronDown,
  SlidersHorizontal,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Bell,
  Zap,
  Plus,
  TrendingUp,
  TrendingDown,
  Package,
  X,
  MapPin,
  CreditCard,
  ShoppingCart,
  Receipt,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  Barcode,
  Download
} from 'lucide-react';
import {
  useGetOrdersQuery,
  useGetOrderStatsQuery,
  useUpdateOrderStatusMutation,
  useCreateOrderMutation,
} from '../../features/orders/orderApi';
import { formatINR } from '../../utils/currency';
import { resolveImageUrl, getPlaceholderImage } from '../../utils/imageUrl';
import { printOrderAddressReceipt, printOrderBarcode } from '../../utils/printDocuments';


const statusStyle = {
  Delivered: { bg: 'bg-slate-50 text-slate-600 border border-slate-200' },
  Pending:   { bg: 'bg-slate-50 text-slate-600 border border-slate-200' },
  Shipped:   { bg: 'bg-slate-50 text-slate-600 border border-slate-200' },
  Cancelled: { bg: 'bg-slate-50 text-slate-600 border border-slate-200' },
};

const paymentDotColor = {
  Paid:   'bg-[#85754E]',
  Unpaid: 'bg-orange-500',
};

/* ── Stat Card ── */
function StatCard({ title, value, badge, badgeUp, sub, onClick, loading, isFirst, icon: Icon }) {
  const color = isFirst ? '#ffffff' : '#85754E';
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-100 p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between h-full cursor-pointer ${isFirst ? 'bg-heritage' : 'bg-white'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isFirst ? 'bg-white/20' : 'bg-slate-50 border border-slate-100'}`}
        >
          {Icon && <Icon size={20} style={{ color }} />}
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

/* ── Info Row helper ── */
function InfoRow({ label, value, valueColor }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">{label}</span>
      <span className={`text-[13px] font-semibold ${valueColor || 'text-slate-800'}`}>{value || 'N/A'}</span>
    </div>
  );
}

const resolveCustomerName = (order) => {
  const shipping = order?.shippingAddress || {};
  const nameParts = [
    shipping.fullName,
    shipping.name,
    shipping.customerName,
    `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim(),
    order?.customerName,
    order?.user?.name,
    order?.name,
  ].filter(Boolean);
  return nameParts[0] || '';
};

const resolveCustomerPhone = (order) => {
  const shipping = order?.shippingAddress || {};
  const phoneParts = [
    shipping.phone,
    shipping.phoneNumber,
    shipping.mobile,
    shipping.contactNumber,
    shipping.customerPhone,
    order?.customerPhone,
    order?.customerPhoneNumber,
    order?.user?.phone,
    order?.user?.phonenum,
    order?.phone,
    order?.phoneNumber,
  ].filter(Boolean);
  return phoneParts[0] || '';
};

/* ── Status Update Modal ── */
function StatusUpdateModal({ order, onClose, onUpdate, isUpdating }) {
  const [selectedStatus, setSelectedStatus] = useState(order?.status || 'Pending');
  const statuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
  if (!order) return null;

  const itemsTotal   = Number(order.itemsPrice)   || 0;
  const shippingCost = Number(order.shippingPrice) || 0;
  const taxAmount    = Number(order.taxPrice)      || 0;
  const grandTotal   = Number(order.totalPrice || order.price) || 0;
  const storedDiscount = Number(order.discountPrice || order.discount || 0) || 0;

  const derivedMrpTotal = (order.orderItems || []).reduce((sum, item) => {
    const sv = item.selectedVariant;
    const mrp = Number(sv?.mrp) || Number(item.product?.mrp) || Number(item.price) || 0;
    const qty = Number(item.qty || item.quantity || 1);
    return sum + mrp * qty;
  }, 0) || itemsTotal;

  const derivedSellingTotal = (order.orderItems || []).reduce((sum, item) => {
    const sv = item.selectedVariant;
    const price = Number(sv?.price) || Number(item.product?.price) || Number(item.price) || 0;
    const qty = Number(item.qty || item.quantity || 1);
    return sum + price * qty;
  }, 0) || itemsTotal;

  // Use the larger of derived MRP total or itemsTotal (since old orders had itemsTotal as selling price)
  const finalMrpTotal = Math.max(itemsTotal, derivedMrpTotal);
  
  // Calculate discount by comparing MRP total vs Selling total (or from grand total if needed)
  const derivedDiscount = storedDiscount > 0
    ? storedDiscount
    : Math.max(0, finalMrpTotal - (grandTotal - taxAmount - shippingCost));

  const statusColors = {
    Delivered: 'bg-amber-100 text-[#85754E]',
    Pending:   'bg-amber-50 text-[#85754E]',
    Shipped:   'bg-amber-50 text-[#85754E]',
    Cancelled: 'bg-rose-50 text-rose-600',
  };
  const sc = statusColors[order.status] || 'bg-slate-100 text-slate-600';

  return (
    <div
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-[6px] flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl w-full max-w-[560px] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                <Package size={16} className="text-[#85754E]" />
              </div>
              <h3 className="text-base font-black text-slate-900 m-0">Order Details</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Order ID:</span>
              <span className="text-xs font-extrabold text-[#85754E] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                #{order.orderId || order.id}
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-[0.06em] ${sc}`}>
                {order.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center cursor-pointer shrink-0 ml-3"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Order Meta */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InfoRow label="Customer" value={order.shippingAddress?.fullName || `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim() || order.shippingAddress?.name || (typeof order.userId === 'object' ? order.userId?.name : null) || (typeof order.user === 'object' ? order.user?.name : null) || order.userId || order.user} />
            <InfoRow label="Order Date" value={order.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A')} />
            <InfoRow label="Payment Status" value={order.payment || 'Unpaid'} valueColor={order.payment === 'Paid' ? 'text-[#85754E]' : 'text-orange-500'} />
            <InfoRow label="Payment Method" value={order.paymentMethod || 'COD'} />
          </div>

          {/* Shipping Address */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-2.5">
              <MapPin size={13} className="text-[#85754E]" />
              <span className="text-[10px] font-extrabold text-[#85754E] uppercase tracking-[0.1em]">Shipping Address</span>
            </div>
            <div className="flex flex-col gap-1">
              {[
                ['Name', order.shippingAddress?.fullName || `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim() || order.shippingAddress?.name || (typeof order.userId === 'object' ? order.userId?.name : null) || (typeof order.user === 'object' ? order.user?.name : null) || 'Customer'],
                ['Phone', order.shippingAddress?.phone || order.shippingAddress?.phoneNumber || (typeof order.userId === 'object' ? order.userId?.phonenum || order.userId?.phone : null) || (typeof order.user === 'object' ? order.user?.phonenum || order.user?.phone : null) || order.phone || order.phoneNumber || 'N/A'],
                ['Address', order.shippingAddress?.address],
                ['City', order.shippingAddress?.city],
                ['Postal Code', order.shippingAddress?.postalCode || order.shippingAddress?.zipCode],
                ['Country', order.shippingAddress?.country],
              ].map(([label, val]) => (
                <div key={label} className="flex gap-1.5 text-xs">
                  <span className="text-slate-400 font-semibold min-w-[80px]">{label}:</span>
                  <span className="text-slate-700 font-semibold">{val || 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>
          {order.status === 'Cancelled' && order.cancellationReason && (
            <div className="bg-rose-50 rounded-2xl p-4 mb-4 border border-rose-100 text-rose-700">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] mb-2">Cancellation Reason</div>
              <div className="text-[13px] font-semibold">{order.cancellationReason}</div>
            </div>
          )}

          {/* Purchased Items */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-3">
              <ShoppingCart size={13} className="text-[#85754E]" />
              <span className="text-[10px] font-extrabold text-[#85754E] uppercase tracking-[0.1em]">
                Purchased Items ({order.orderItems?.length || 0})
              </span>
            </div>
            <div className="flex flex-col gap-2.5 max-h-[180px] overflow-y-auto">
              {order.orderItems?.length > 0 ? order.orderItems.map((item, idx) => {
                const qty = Number(item.qty || item.quantity || 1);
                // Use selectedVariant (from backend enrichment) for accurate selling price
                const sv = item.selectedVariant;
                const finalPrice = Number(sv?.price) || Number(item.product?.price) || Number(item.price) || 0;
                
                return (
                  <div key={idx} className={`flex items-center gap-3 ${idx < order.orderItems.length - 1 ? 'pb-2.5 border-b border-slate-200' : ''}`}>
                    <div className="w-11 h-11 shrink-0 rounded-xl overflow-hidden bg-slate-200 border border-slate-200">
                      {(item.image || item.images) ? (
                        <img 
                          src={resolveImageUrl(item.image || item.images, item.name)} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.target.src = getPlaceholderImage(item.name);
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 m-0 mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</p>
                      {(item.fabric || item.color) ? (
                        <p className="text-[10px] text-[#85754E] m-0 mb-0.5 font-semibold">
                          {[item.color, item.fabric].filter(Boolean).join(' · ')}
                        </p>
                      ) : item.variant ? (
                        <p className="text-[10px] text-[#85754E] m-0 mb-0.5 font-semibold">{item.variant}</p>
                      ) : null}
                      <p className="text-[11px] text-slate-500 m-0 font-medium">Qty: {qty} × {formatINR(finalPrice)}</p>
                    </div>
                    <span className="text-[13px] font-extrabold text-slate-900 shrink-0">{formatINR(qty * finalPrice)}</span>
                  </div>
                );
              }) : (
                <p className="text-xs text-slate-400 text-center py-3">No items found</p>
              )}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-amber-50 rounded-2xl p-4 mb-5 border border-amber-100">
            <div className="flex items-center gap-1.5 mb-3">
              <Receipt size={13} className="text-heritage" />
              <span className="text-[10px] font-extrabold text-heritage uppercase tracking-[0.1em]">Price Breakdown</span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Items Total (MRP)', value: finalMrpTotal },
                { label: 'Discount', value: derivedDiscount, isDiscount: true },
                { label: 'Shipping Cost', value: Number(order.shippingPrice) || 0 },
                { label: 'Tax (GST)', value: taxAmount },
              ].map(({ label, value, isDiscount }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">{label}</span>
                  <span className={`text-[13px] font-bold ${value > 0 ? (isDiscount ? 'text-green-600' : 'text-slate-800') : 'text-slate-400'}`}>
                    {value > 0 ? (isDiscount ? `- ${formatINR(value)}` : formatINR(value)) : <span className="text-[11px]">—</span>}
                  </span>
                </div>
              ))}
              <div className="border-t border-amber-200 mt-1 pt-2.5 flex justify-between items-center">
                <span className="text-[13px] font-extrabold text-slate-800">Total Amount</span>
                <span className="text-base font-black text-heritage">{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Status Update */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em] block mb-2">
              Update Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              disabled={isUpdating}
              className="w-full px-3.5 py-2.5 bg-white border-[1.5px] border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {order.status === 'Cancelled' && order.cancellationReason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
              <label className="text-[10px] font-extrabold text-red-400 uppercase tracking-[0.1em] block mb-1">
                Cancellation Reason
              </label>
              <p className="text-xs text-red-700 font-medium m-0">{order.cancellationReason}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-3 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => printOrderAddressReceipt(order)}
              className="py-2.5 bg-white border border-amber-200 rounded-xl text-[11px] font-extrabold text-[#85754E] cursor-pointer hover:bg-amber-50 transition-all flex items-center justify-center gap-1.5"
            >
              <Printer size={13} /> Address Receipt
            </button>
            <button
              onClick={() => printOrderBarcode(order)}
              className="py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-600 cursor-pointer hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
            >
              <Barcode size={14} /> Order Barcode
            </button>
          </div>
          <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="flex-1 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onUpdate(order, selectedStatus)}
            disabled={isUpdating || selectedStatus === order.status}
            className={`flex-[2] py-2.5 rounded-xl text-xs font-extrabold text-white border-none flex items-center justify-center gap-2 transition-all
              ${isUpdating ? 'bg-amber-400 cursor-not-allowed' : selectedStatus === order.status ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#85754E] cursor-pointer hover:bg-[#7a6d4a] shadow-lg shadow-amber-900/30'}`}
          >
            {isUpdating ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                Updating...
              </>
            ) : 'Update Status'}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN ORDER MANAGEMENT PAGE
══════════════════════════════════════════════ */
export default function OrderManagement() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('All order');
  const [searchQuery, setSearchQuery] = useState(location.state?.search || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});

  const tabs = ['All order', 'Completed', 'Pending', 'Canceled'];
  const itemsPerPage = 6;

  const statusFilter =
    activeTab === 'Completed' ? 'Delivered' :
      activeTab === 'Pending' ? 'Pending' :
        activeTab === 'Canceled' ? 'Cancelled' : null;

  const { data: ordersResponse, isLoading: ordersLoading, error: ordersError, refetch } = useGetOrdersQuery(statusFilter);
  const { data: statsData, isLoading: statsLoading } = useGetOrderStatsQuery();
  const [updateStatus, { isLoading: isUpdating }] = useUpdateOrderStatusMutation();
  const [createOrder] = useCreateOrderMutation();

  const handleManualOrder = async () => {
    try {
      await createOrder({
        orderItems: [{
          name: 'Manual Order Product', qty: 1,
          image: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
          price: 99.99, product: '65f1234567890abcdef00001',
        }],
        itemsPrice: 99.99, totalPrice: 99.99, isPaid: true, status: 'Pending',
      }).unwrap();
      toast.success('Manual order created for testing');
    } catch {
      toast.error('Failed to create order');
    }
  };


  function getProductEmoji(productName) {
    const map = { headphone: '🎧', shirt: '👕', wallet: '👛', pillow: '🛏', dumbbell: '🏋', coffee: '☕', cap: '🧢', webcam: '📷', bulb: '💡', saree: '🥻', dress: '👗' };
    const lower = productName?.toLowerCase() || '';
    for (const [key, emoji] of Object.entries(map)) if (lower.includes(key)) return emoji;
    return '📦';
  }

  const orders = useMemo(() =>
    ordersResponse?.data?.map((order) => {
      const firstItem = order.orderItems?.[0] || {};
      const rawId = order._id;
      const displayId = order.orderId || order._id;
      const resolvedStatus = statusOverrides[rawId] || order.status || (order.isDelivered ? 'Delivered' : 'Pending');
      return {
        _id: rawId,
        id: displayId,
        orderId: order.orderId,
        product: firstItem.name || 'Product Asset',
        variant: firstItem.variant || '',
        fabric: firstItem.fabric || '',
        color: firstItem.color || '',
        image: firstItem.image,
        images: firstItem.images,
        emoji: getProductEmoji(firstItem.name),
        date: new Date(order.createdAt).toLocaleDateString('en-GB'),
        price: order.totalPrice || order.price || 0,
        itemsPrice: order.itemsPrice || 0,
        shippingPrice: order.shippingPrice || 0,
        taxPrice: order.taxPrice || 0,
        discountPrice: order.discountPrice || 0,
        totalPrice: order.totalPrice || order.price || 0,
        payment: order.isPaid ? 'Paid' : 'Unpaid',
        paymentMethod: order.paymentMethod || 'COD',
        status: resolvedStatus,
        userId: order.user || order.userId,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress || {},
        orderItems: order.orderItems || [],
        cancellationReason: order.cancellationReason,
      };
    }) || [],
    [ordersResponse, statusOverrides]);

  const filteredOrders = useMemo(() =>
    orders.filter((o) => {
      const uid = (o.userId?._id || o.userId)?.toString().toLowerCase() || '';
      const uName = (o.userId?.name || '').toString().toLowerCase();
      const sq = searchQuery.toLowerCase();
      return (
        (o.product?.toLowerCase() || '').includes(sq) ||
        (o.id?.toLowerCase() || '').includes(sq) ||
        uid.includes(sq) ||
        uName.includes(sq)
      );
    }),
    [orders, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handleExportCSV = () => {
    if (!filteredOrders.length) {
      toast.error('No orders to export');
      return;
    }

    const headers = ['Order ID', 'Product', 'Date', 'Total Price', 'Status', 'Payment', 'Customer Name', 'Phone'];
    const rows = filteredOrders.map(o => [
      `"${o.id}"`,
      `"${o.product || ''}"`,
      `"${o.date}"`,
      o.totalPrice,
      `"${o.status}"`,
      `"${o.payment}"`,
      `"${o.shippingAddress?.fullName || ''}"`,
      `"${o.shippingAddress?.phone || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Orders exported successfully!');
  };
  const paginatedOrders = useMemo(() =>
    filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredOrders, currentPage]);

  const handleUpdateStatus = async (order, newStatus) => {
    const apiId = order._id || order.orderId || order.id;
    const overrideKey = order._id || order.orderId || order.id;

    try {
      await updateStatus({ id: apiId, orderId: apiId, status: newStatus }).unwrap();
      setStatusOverrides((prev) => ({ ...prev, [overrideKey]: newStatus }));
      setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success(`Order status updated to "${newStatus}"`);
      refetch().then(() => {
        setStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[overrideKey];
          return next;
        });
      });
      setTimeout(() => setSelectedOrder(null), 600);
    } catch (err) {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });
      const message = err?.data?.message || err?.message || 'Failed to update status';
      toast.error(message);
    }
  };

  const handleExport = () => {
    toast.loading('Exporting orders...');
    setTimeout(() => { toast.dismiss(); toast.success('Orders exported!'); }, 1000);
  };

  if (ordersError) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <p className="text-rose-600 font-bold mb-4">Failed to load orders</p>
        <p className="text-xs text-slate-500 mb-6">{ordersError.message || 'Connecting to server failed.'}</p>
        <button onClick={() => window.location.reload()}
          className="px-6 py-2 bg-[#85754E] text-white text-xs font-bold rounded-lg hover:bg-[#7a6d4a] transition-colors">
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="w-full min-w-0 flex flex-col gap-5 p-4 md:p-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight m-0">Order Management</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium mb-0">Control and track all customer transactions</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by ID or Product..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs w-48 md:w-56 outline-none text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Orders"  value={statsData?.total     ?? 0} badge="14.4%" badgeUp    sub="Last 30 days"           onClick={() => setActiveTab('All order')} loading={statsLoading} isFirst={true} icon={ShoppingCart} />
          <StatCard title="New Orders"    value={statsData?.pending   ?? 0} badge="20%"   badgeUp    sub="Needs processing"       onClick={() => setActiveTab('Pending')}   loading={statsLoading} icon={Clock} />
          <StatCard title="Completed"     value={statsData?.delivered ?? 0} badge="83%"   badgeUp    sub="Successfully delivered" onClick={() => setActiveTab('Completed')} loading={statsLoading} icon={CheckCircle} />
          <StatCard title="Cancelled"     value={statsData?.cancelled ?? 0} badge="3.2%"  badgeUp={false} sub="Lost opportunities" onClick={() => setActiveTab('Canceled')}  loading={statsLoading} icon={AlertCircle} />
        </div>

        {/* Order Table Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Top bar */}
          <div className="px-4 md:px-6 py-4 border-b border-slate-50 flex justify-between items-center flex-wrap gap-3">
            <span className="text-xs font-black text-slate-800 uppercase tracking-[0.1em]">Order Repository</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 shadow-sm rounded-xl px-3 py-2 text-[11px] font-bold cursor-pointer whitespace-nowrap hover:bg-slate-50"
              >
                <Download size={13} strokeWidth={3} /> Export Data
              </button>
              <button
                onClick={handleManualOrder}
                className="flex items-center gap-1.5 bg-[#85754E] text-white border-none rounded-xl px-3 py-2 text-[11px] font-bold cursor-pointer whitespace-nowrap"
              >
                <Plus size={13} strokeWidth={3} /> Add Order
              </button>
            </div>
          </div>

          {/* Tabs + filters */}
          <div className="px-4 md:px-6 py-3 flex justify-between items-center flex-wrap gap-3 border-b border-slate-50">
            <div className="flex gap-1 bg-[#FFF5E2] p-1 rounded-xl border border-amber-50 flex-wrap">
              {tabs.map((tab) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                    className={`px-3 py-1.5 text-[11px] font-extrabold rounded-xl border-none cursor-pointer whitespace-nowrap transition-all
                      ${active ? 'bg-white text-[#85754E] shadow-sm' : 'bg-transparent text-slate-400'}`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table area */}
          <div className="overflow-x-auto min-h-[300px] px-4 md:px-6 pb-6">
            {ordersLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-11 h-11 border-4 border-amber-100 border-t-[#85754E] rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">
                  Synchronizing Local Cluster...
                </span>
              </div>
            ) : (
              <>
                <table className="w-full border-collapse" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr>
                      {[
                        { label: '#',        align: 'text-left',   cls: 'hidden sm:table-cell' },
                        { label: 'Order ID', align: 'text-left',   cls: '' },
                        { label: 'Product',  align: 'text-left',   cls: '' },
                        { label: 'Date',     align: 'text-center', cls: 'hidden md:table-cell' },
                        { label: 'Price',    align: 'text-center', cls: 'hidden sm:table-cell' },
                        { label: 'Payment',  align: 'text-center', cls: 'hidden md:table-cell' },
                        { label: 'Status',   align: 'text-center', cls: '' },
                      ].map(({ label, align, cls }) => (
                        <th key={label} className={`px-3 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ${align} whitespace-nowrap bg-gray-50 border-b border-slate-100 ${cls}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-slate-300">
                          <ArrowLeftRight size={40} className="mx-auto mb-2.5 block opacity-25" />
                          <span className="text-[11px] font-bold uppercase tracking-[0.1em]">No orders found</span>
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((o, i) => (
                        <tr
                          key={o._id || o.id}
                          onClick={() => setSelectedOrder(o)}
                          className="border-b border-slate-50 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <td className="hidden sm:table-cell px-3 py-3 text-[11px] font-bold text-slate-400">
                            {(currentPage - 1) * itemsPerPage + i + 1}
                          </td>
                          <td className="px-3 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                            #{o.id}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 shrink-0 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                                {(o.image || o.images) ? (
                                  <img 
                                    src={resolveImageUrl(o.image || o.images, o.product)} 
                                    alt={o.product} 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      e.target.src = getPlaceholderImage(o.product);
                                    }}
                                  />
                                ) : (
                                  <span className="text-base">{o.emoji}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[12px] font-bold text-slate-800 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap block">
                                  {o.product}
                                </span>
                                {(o.fabric || o.color) ? (
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {[o.color, o.fabric].filter(Boolean).join(' · ')}
                                  </span>
                                ) : o.variant ? (
                                  <span className="text-[10px] font-semibold text-slate-500">{o.variant}</span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="hidden md:table-cell px-3 py-3 text-[11px] font-semibold text-slate-500 text-center whitespace-nowrap">
                            {o.date}
                          </td>
                          <td className="hidden sm:table-cell px-3 py-3 text-[13px] font-black text-slate-900 text-center whitespace-nowrap">
                            {formatINR(o.price)}
                          </td>
                          <td className="hidden md:table-cell px-3 py-3 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase whitespace-nowrap">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${paymentDotColor[o.payment] || 'bg-slate-400'}`} />
                              {o.payment}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.06em] whitespace-nowrap ${statusStyle[o.status]?.bg || 'bg-slate-100 text-slate-600'}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {filteredOrders.length > 0 && (
                  <div className="flex items-center justify-between pt-5 flex-wrap gap-3">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-extrabold text-[#85754E] uppercase tracking-[0.05em] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>

                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-extrabold cursor-pointer
                            ${currentPage === i + 1 ? 'bg-[#85754E] text-white border-none' : 'bg-white border border-slate-200 text-slate-500'}`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-extrabold text-[#85754E] uppercase tracking-[0.05em] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedOrder && (
        <StatusUpdateModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={handleUpdateStatus}
          isUpdating={isUpdating}
        />
      )}
    </>
  );
}
