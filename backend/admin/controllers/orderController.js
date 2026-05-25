import Order from "../models/Order.js";
import Transaction from "../models/Transaction.js";
import Product from "../models/Product.js";
import User from "../../models/User.js";

// GET ALL ORDERS
export const getOrders = async (req, res) => {
  try {
    const { status } = req.query;

    let query = {};
    if (status) query.status = status;

    // If not admin, only show user's own orders
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name phone phonenum');

    // Enrich order items with variant details (fabric, color) for old orders
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject();
        const enrichedItems = await Promise.all(
          (orderObj.orderItems || []).map(async (item) => {
            try {
              const product = await Product.findById(item.product).lean();
              if (!product || !product.variants?.length) return item;
              
              // Try to match variant by stored variant string or ID
              const variantKey = item.variant || '';
              let matchedVariant = null;
              if (variantKey) {
                matchedVariant = product.variants.find((v) =>
                  String(v._id) === String(variantKey) ||
                  String(v.color || '').toLowerCase() === String(variantKey).toLowerCase() ||
                  String(v.fabric || '').toLowerCase() === String(variantKey).toLowerCase()
                );
              }
              // Fallback: match by price if not matched yet
              if (!matchedVariant && item.price) {
                matchedVariant = product.variants.find(v => Number(v.price) === Number(item.price));
              }

              // Filter product variants to only show the matched one, avoiding frontend mismatch
              if (matchedVariant && product.variants) {
                product.variants = [matchedVariant];
              }

              return {
                ...item,
                product, // override populated product with the filtered one
                fabric: item.fabric || matchedVariant?.fabric || "",
                color: item.color || matchedVariant?.color || "",
                variant: item.variant || (matchedVariant ? `${matchedVariant.color} - ${matchedVariant.fabric}` : ""),
                selectedVariant: matchedVariant || null // Ensure frontend gets it directly if needed
              };
            } catch {
              return item;
            }
          })
        );
        return { ...orderObj, orderItems: enrichedItems };
      })
    );

    res.json({
      success: true,
      data: enrichedOrders
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrderCancellationDetails = async (req, res) => {
  try {
    let order = await Order.findOne({ orderId: req.params.orderId }).populate('user', 'name phone phonenum');
    if (!order) {
      order = await Order.findById(req.params.orderId).populate('user', 'name phone phonenum');
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      success: true,
      data: {
        orderId: order.orderId || order._id,
        status: order.status,
        cancellationReason: order.cancellationReason || null,
        shippingAddress: order.shippingAddress || {},
        user: order.user || null,
        createdAt: order.createdAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE ORDER STATUS
export const updateOrder = async (req, res) => {
  try {
    // The dashboard uses orderId (custom string) but if it's MongoDB ID, adapt
    const { status } = req.body;
    let order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      order = await Order.findById(req.params.orderId);
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Handle stock restoration if status changes TO Cancelled
    if (status === "Cancelled" && order.status !== "Cancelled") {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.qty }
        });
      }
    }

    // Handle stock decrease if status changes FROM Cancelled to something else
    if (order.status === "Cancelled" && status && status !== "Cancelled") {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.qty }
        });
      }
    }

    // Set isDelivered and deliveredAt if status is Delivered
    if (status === "Delivered") {
      req.body.isDelivered = true;
      req.body.deliveredAt = Date.now();
    }

    // Preserve cancellation reason when the admin cancels the order
    if (status === "Cancelled") {
      req.body.cancellationReason = req.body.cancellationReason || order.cancellationReason || 'Cancelled by admin';
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(order._id, req.body, { new: true });

    res.json({
      success: true,
      data: updatedOrder
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ORDER STATS
export const getOrderStats = async (req, res) => {
  try {
    const total = await Order.countDocuments();
    const pending = await Order.countDocuments({ status: "Pending" });
    const delivered = await Order.countDocuments({ status: "Delivered" });
    const cancelled = await Order.countDocuments({ status: "Cancelled" });

    // Revenue Aggregation from TRANSACTIONS (Real Money)
    const revenueStats = await Transaction.aggregate([
      { $match: { status: "captured" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);

    // Sales by Country (From Orders linked to Captured Transactions)
    const capturedTxns = await Transaction.find({ status: "captured" }).select('order');
    const capturedOrderIds = capturedTxns.map(t => t.order).filter(id => id);

    const salesByCountry = await Order.aggregate([
      { $match: { _id: { $in: capturedOrderIds } } },
      { $group: { _id: "$shippingAddress.country", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    // Daily Sales (Last 7 Days) from Transactions
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySales = await Transaction.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: "captured" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Orders by Hour (Last 24 Hours) from Transactions
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const hourlyOrders = await Transaction.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo }, status: "captured" } },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top Selling Products (From Orders linked to Captured Transactions)
    const topProducts = await Order.aggregate([
      { $match: { _id: { $in: capturedOrderIds } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.name" },
          image: { $first: "$orderItems.image" },
          totalQty: { $sum: "$orderItems.qty" },
          totalRevenue: { $sum: { $multiply: ["$orderItems.qty", "$orderItems.price"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 8 }
    ]);

    // Top Selling Products THIS WEEK
    const topProductsThisWeek = await Order.aggregate([
      { $match: { _id: { $in: capturedOrderIds }, createdAt: { $gte: sevenDaysAgo } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.name" },
          image: { $first: "$orderItems.image" },
          totalQty: { $sum: "$orderItems.qty" },
          totalRevenue: { $sum: { $multiply: ["$orderItems.qty", "$orderItems.price"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 8 }
    ]);

    // Active Users (last 30 minutes)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const activeUsers30m = await User.countDocuments({ lastActive: { $gte: thirtyMinsAgo } });

    res.json({
      success: true,
      total,
      pending,
      delivered,
      cancelled,
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
      salesByCountry,
      dailySales,
      hourlyOrders,
      topProducts,
      topProductsThisWeek,
      activeUsers30m
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
