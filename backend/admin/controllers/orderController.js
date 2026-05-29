import Order from "../models/Order.js";
import Transaction from "../models/Transaction.js";
import Product from "../models/Product.js";
import User from "../../models/User.js";

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const cleanString = (value) => String(value || "").trim();

const makeId = (prefix) =>
  `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const getManualOrderItems = (body) => {
  const rawItems = Array.isArray(body.orderItems) && body.orderItems.length
    ? body.orderItems
    : [{
        name: body.productName,
        qty: body.qty,
        price: body.price,
        image: body.image,
        product: body.product,
        variant: body.variant,
        fabric: body.fabric,
        color: body.color,
      }];

  return rawItems.map((item) => {
    const qty = Math.max(1, toNumber(item.qty || item.quantity, 1));
    const price = Math.max(0, toNumber(item.price, 0));

    return {
      name: cleanString(item.name || item.productName) || "Manual Order Item",
      qty,
      price,
      image: cleanString(item.image) || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
      product: cleanString(item.product || item.productId) || undefined,
      variant: cleanString(item.variant),
      fabric: cleanString(item.fabric),
      color: cleanString(item.color),
    };
  });
};

// GET ALL ORDERS
export const getOrders = async (req, res) => {
  console.time('getOrders');
  try {
    const { status } = req.query;

    let query = {};
    if (status) query.status = status;

    // If not admin, only show user's own orders
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    console.time('Order.find');
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name phone phonenum')
      .populate({ path: 'orderItems.product', select: 'variants mrp price' })
      .lean();
    console.timeEnd('Order.find');

    console.time('enrichOrders');
    // Enrich order items with variant details (fabric, color) for old orders
    const enrichedOrders = orders.map((orderObj) => {
      const enrichedItems = (orderObj.orderItems || []).map((item) => {
        try {
          const product = item.product;
          if (!product || !product.variants?.length) return item;

          // Try to match variant by color+fabric (most reliable), then variant key, then price
          const variantKey = item.variant || '';
          let matchedVariant = null;

          // 1. Match by stored color + fabric (most reliable for enriched orders)
          if (item.color || item.fabric) {
            matchedVariant = product.variants.find((v) => {
              const colorMatch = !item.color || String(v.color || '').toLowerCase() === String(item.color).toLowerCase();
              const fabricMatch = !item.fabric || String(v.fabric || '').toLowerCase() === String(item.fabric).toLowerCase();
              return colorMatch && fabricMatch;
            });
          }

          // 2. Fallback: match by variant key string
          if (!matchedVariant && variantKey) {
            matchedVariant = product.variants.find((v) =>
              String(v._id) === String(variantKey) ||
              String(v.color || '').toLowerCase() === String(variantKey).toLowerCase() ||
              String(v.fabric || '').toLowerCase() === String(variantKey).toLowerCase()
            );
          }
          // 3. Fallback: match by price or MRP
          if (!matchedVariant && item.price) {
            matchedVariant = product.variants.find((v) =>
              Number(v.price) === Number(item.price) || Number(v.mrp) === Number(item.price)
            );
          }

          // Filter product variants to only show the matched one, avoiding frontend mismatch
          if (matchedVariant && product.variants) {
            product.variants = [matchedVariant];
          }

          return {
            ...item,
            product,
            fabric: item.fabric || matchedVariant?.fabric || "",
            color: item.color || matchedVariant?.color || "",
            variant: item.variant || (matchedVariant ? `${matchedVariant.color} - ${matchedVariant.fabric}` : ""),
            selectedVariant: matchedVariant || null,
          };
        } catch {
          return item;
        }
      });

      const rawDiscountPrice = Number(orderObj.discountPrice || orderObj.discount || 0) || 0;
      const fallbackDiscountPrice = Math.max(
        0,
        (Number(orderObj.itemsPrice) || 0) - ((Number(orderObj.totalPrice) || 0) - (Number(orderObj.taxPrice) || 0) - (Number(orderObj.shippingPrice) || 0))
      );

      return {
        ...orderObj,
        orderItems: enrichedItems,
        discountPrice: rawDiscountPrice || fallbackDiscountPrice,
      };
    });
    console.timeEnd('enrichOrders');

    res.json({
      success: true,
      data: enrichedOrders
    });
    console.timeEnd('getOrders');
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

// CREATE MANUAL ORDER
export const createManualOrder = async (req, res) => {
  try {
    const customer = req.body.customer || {};
    const name = cleanString(customer.name || req.body.customerName || req.body.fullName);
    const email = cleanString(customer.email || req.body.email).toLowerCase();
    const phone = cleanString(customer.phone || req.body.phone || req.body.phonenum);

    if (!name) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: "Customer email or phone is required." });
    }

    const lookup = [];
    if (email) lookup.push({ email });
    if (phone) lookup.push({ phonenum: phone });

    let user = lookup.length ? await User.findOne({ $or: lookup }) : null;
    if (!user) {
      user = await User.create({
        name,
        email: email || undefined,
        phonenum: phone || undefined,
        role: "user",
      });
    } else {
      user.name = user.name || name;
      if (email && !user.email) user.email = email;
      if (phone && !user.phonenum) user.phonenum = phone;
      await user.save();
    }

    const shipping = req.body.shippingAddress || {};
    const shippingAddress = {
      fullName: name,
      email: email || undefined,
      phone: phone || undefined,
      address: cleanString(shipping.address || req.body.address),
      city: cleanString(shipping.city || req.body.city),
      state: cleanString(shipping.state || req.body.state),
      postalCode: cleanString(shipping.postalCode || shipping.zipCode || req.body.postalCode || req.body.zipCode),
      country: cleanString(shipping.country || req.body.country) || "India",
    };

    const orderItems = getManualOrderItems(req.body);
    if (!orderItems.length || orderItems.some((item) => !item.name || item.price <= 0 || item.qty <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Add at least one item with product name, quantity, and price.",
      });
    }

    const itemsPrice = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shippingPrice = Math.max(0, toNumber(req.body.shippingPrice, 0));
    const discountPrice = Math.max(0, toNumber(req.body.discountPrice, 0));
    const taxPrice = Math.max(0, toNumber(req.body.taxPrice, 0));
    const totalPrice = Math.max(0, toNumber(req.body.totalPrice, itemsPrice + shippingPrice + taxPrice - discountPrice));
    const paymentMethod = cleanString(req.body.paymentMethod) || "COD";
    const status = cleanString(req.body.status) || "Pending";
    const isPaid = req.body.isPaid === true || req.body.isPaid === "true";

    const order = await Order.create({
      orderId: makeId("#ORD"),
      user: user._id,
      orderItems,
      shippingAddress,
      customerName: name,
      customerPhone: phone,
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountPrice,
      totalPrice,
      paymentMethod,
      isPaid,
      paidAt: isPaid ? new Date() : undefined,
      status,
      isDelivered: status === "Delivered",
      deliveredAt: status === "Delivered" ? new Date() : undefined,
      notes: cleanString(req.body.notes),
      paymentStatus: isPaid ? "completed" : (paymentMethod.toUpperCase() === "COD" ? "cod" : "pending"),
    });

    try {
      await Transaction.create({
        transactionId: makeId("TXNMANUAL"),
        order: order._id,
        user: user._id,
        razorpayOrderId: "MANUAL_" + order.orderId,
        amount: totalPrice,
        currency: "INR",
        status: isPaid ? "captured" : (paymentMethod.toUpperCase() === "COD" ? "cod" : "created"),
        paymentMethod,
        notes: { source: "manual-admin-order" },
      });
    } catch (transactionErr) {
      console.warn("Manual order transaction log failed:", transactionErr.message);
    }

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error("Manual Order Creation Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to create manual order." });
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
        if (!item.product) continue;
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.qty }
        });
      }
    }

    // Handle stock decrease if status changes FROM Cancelled to something else
    if (order.status === "Cancelled" && status && status !== "Cancelled") {
      for (const item of order.orderItems) {
        if (!item.product) continue;
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
