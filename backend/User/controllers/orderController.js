import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Address from "../../models/Address.js";
import Transaction from "../../admin/models/Transaction.js";
import { calculateDiscount } from "./couponController.js";
import { calculateShippingCharges } from "../../services/shiprocketService.js";
import Coupon from "../models/Coupon.js";

const getProductImage = (product, fallback = "") => {
  const firstImage = Array.isArray(product?.images) ? product.images[0] : null;
  if (typeof firstImage === "string") return firstImage;
  return firstImage?.secure_url || firstImage?.url || firstImage?.path || product?.image || fallback;
};

const getSelectedVariant = (product, item = {}) => {
  const selected = item.selectedVariant || item.variant || {};
  const variantKey =
    selected._id ||
    selected.id ||
    selected.value ||
    selected.name ||
    item.variantId ||
    item.variant;

  let matched = null;

  if (variantKey) {
    matched = (product?.variants || []).find((variant) =>
      String(variant._id || variant.id || variant.color || variant.fabric || variant.name) === String(variantKey) ||
      String(variant.color || "").toLowerCase() === String(variantKey).toLowerCase() ||
      String(variant.fabric || "").toLowerCase() === String(variantKey).toLowerCase()
    );
  }

  // Fallback: match by price if variantKey is missing or no match found
  if (!matched && item.price) {
    matched = (product?.variants || []).find((variant) => Number(variant.price) === Number(item.price));
  }

  return matched || null;
};

const getProductPrice = (product, item = {}) => {
  const variant = getSelectedVariant(product, item);
  return Number(variant?.price || product?.discountPrice || product?.discounted_price || product?.price || item.price || 0);
};

// CREATE ORDER
export const createOrder = async (req, res) => {
  try {
    const { termsAccepted, couponCode, pincode } = req.body;

    // Validate Terms & Conditions
    if (termsAccepted !== true && termsAccepted !== "true") {
      return res.status(400).json({ 
        success: false, 
        message: "You must accept the Terms and Conditions to proceed." 
      });
    }

    // 1. Handle flexible items input (items or orderItems)
    const orderItems = req.body.orderItems || req.body.items;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: "No order items" });
    }

    // 2. Handle flexible shipping address input
    let shippingAddress = req.body.shippingAddress;
    
    // If shippingAddress is an ID/string (or ObjectId representation), fetch it from Database
    if (shippingAddress && (typeof shippingAddress === 'string' || (typeof shippingAddress === 'object' && shippingAddress.toString && /^[0-9a-fA-F]{24}$/.test(shippingAddress.toString())))) {
      try {
        const addressDoc = await Address.findById(shippingAddress);
        if (addressDoc) {
          shippingAddress = addressDoc.toObject();
        }
      } catch (err) {
        console.error("Error fetching shipping address by ID:", err);
      }
    }
    
    // If shippingAddress is missing but flat fields are present, map them
    if (!shippingAddress && (req.body.address || req.body.city || req.body.zipCode)) {
      shippingAddress = {
        fullName: `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || undefined,
        address: req.body.address,
        city: req.body.city,
        postalCode: req.body.zipCode || req.body.postalCode,
        country: req.body.country,
        state: req.body.state,
        phone: req.body.phoneNumber || req.body.phone
      };
    }

    // Normalize shippingAddress object to match Order's shippingAddress schema
    if (shippingAddress && typeof shippingAddress === 'object' && !(shippingAddress.toString && /^[0-9a-fA-F]{24}$/.test(shippingAddress.toString()))) {
      shippingAddress = {
        fullName: shippingAddress.fullName || `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() || undefined,
        firstName: shippingAddress.firstName || undefined,
        lastName: shippingAddress.lastName || undefined,
        email: shippingAddress.email || undefined,
        phone: shippingAddress.phone || shippingAddress.phoneNumber || undefined,
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode || shippingAddress.zipCode,
        country: shippingAddress.country
      };
    }

    // Calculate items price securely and GST
    let calculatedItemsPrice = 0;
    let totalWeight = 0;
    
    // We recreate orderItems with secure prices from the DB
    const secureOrderItems = [];

    for (const item of orderItems) {
      const productId = item.product || item.productId || item._id;
      const quantity = parseInt(item.qty || item.quantity || 1);

      if (!productId) {
        console.warn("Skipping item without product ID:", item);
        continue;
      }

      const product = await Product.findById(productId);
      const priceToUse = product ? getProductPrice(product, item) : (item.price || 0);
      const matchedVariant = product ? getSelectedVariant(product, item) : null;
      
      secureOrderItems.push({
        ...item,
        product: productId,
        qty: quantity,
        price: priceToUse,
        name: product ? product.name : (item.name || "Unknown Product"),
        image: product ? getProductImage(product, item.image || "") : (item.image || ""),
        variant: matchedVariant ? `${matchedVariant.color} - ${matchedVariant.fabric}` : (item.variant || ""),
        fabric: matchedVariant?.fabric || item.fabric || "",
        color: matchedVariant?.color || item.color || "",
      });
      
      calculatedItemsPrice += (priceToUse * quantity);
      totalWeight += (0.5 * quantity); // Mock weight
      
      if (product) {
        await Product.findByIdAndUpdate(productId, {
          $inc: { stock: -quantity }
        });
      }
    }

    const itemsPrice = calculatedItemsPrice;

    // 3. Discount Calculation
    let discountPrice = 0;
    if (couponCode) {
      try {
        const discResult = await calculateDiscount(couponCode, itemsPrice, req.user?.id);
        discountPrice = discResult.discountAmount;
      } catch (err) {
        console.warn("Coupon validation failed during checkout:", err.message);
      }
    }

    // 4. Shipping Calculation (Shiprocket) - REMOVED AS REQUESTED
    let shippingPrice = 0;
    /*
    const deliveryZip = pincode || shippingAddress?.postalCode;
    
    if (deliveryZip) {
      const shipResult = await calculateShippingCharges({ delivery_postcode: deliveryZip, weight: totalWeight });
      shippingPrice = shipResult.success ? shipResult.data.shipping_cost : 50;
    } else {
      shippingPrice = itemsPrice < 500 ? 50 : 0;
    }
    */

    // 5. Tax Calculation (18% GST)
    const taxableAmount = itemsPrice - discountPrice;
    const taxPrice = Number((taxableAmount * 0.18).toFixed(2));

    const totalPrice = taxableAmount + shippingPrice + taxPrice;
    
    // Extract payment method from request, default to COD
    const paymentMethod = req.body.paymentMethod?.trim() || 'COD';
    const isPaidInitially = paymentMethod === 'Razorpay' ? false : (paymentMethod === 'COD' ? false : false);

    const orderData = {
      ...req.body,
      orderId: "#ORD" + Date.now(),
      orderItems: secureOrderItems,
      shippingAddress,
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountPrice, // Add discount field
      totalPrice,
      paymentMethod,
      isPaid: isPaidInitially,
      status: "Pending"
    };

    if (req.user?.id) {
      orderData.user = req.user.id;
    }

    const order = await Order.create(orderData);
    
    // Create transaction based on payment method
    if (paymentMethod.toUpperCase() === 'COD' || paymentMethod.toLowerCase().includes('cash on delivery')) {
       await Transaction.create({
         transactionId: 'TXNCOD' + Date.now(),
         order: order._id,
         user: order.user,
         razorpayOrderId: 'COD_' + order.orderId,
         amount: totalPrice,
         currency: 'INR',
         status: 'captured',
         paymentMethod: 'COD',
       });
    } else if (paymentMethod === 'Razorpay') {
       // Razorpay transaction will be created when payment is initiated
       await Transaction.create({
         transactionId: 'TXN_' + Date.now(),
         order: order._id,
         user: order.user,
         razorpayOrderId: 'PENDING_' + order.orderId, // Required by model
         amount: totalPrice,
         currency: 'INR',
         status: 'created', // 'initiated' is not in enum
         paymentMethod: 'Razorpay',
       });
    }

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (err) {
    console.error("Order Creation Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET USER ORDERS (with variant details enrichment for old orders)
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user?.id })
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    // Enrich order items with variant details from the product (for old orders missing fabric/color)
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject();
        const enrichedItems = await Promise.all(
          (orderObj.orderItems || []).map(async (item) => {
            try {
              // product is already populated
              const product = item.product?._id ? item.product : await Product.findById(item.product).lean();
              if (!product) return item;

              // Try to find the matching variant
              const matchedVariant = getSelectedVariant(product, item);
              
              // Filter product variants to only show the matched one, avoiding frontend mismatch
              if (matchedVariant && product.variants) {
                product.variants = [matchedVariant];
              }

              return {
                ...item,
                product, // override populated product with the filtered one
                price: Number(item.price) || getProductPrice(product, item),
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

// CANCEL ORDER (USER)
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, user: req.user?.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    // Restore stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.qty }
      });
    }

    order.status = "Cancelled";
    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET SINGLE ORDER (USER)
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate("orderItems.product");

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found." });

    const orderObj = order.toObject();
    orderObj.orderItems = (orderObj.orderItems || []).map((item) => {
      const product = item.product;
      return {
        ...item,
        price: Number(item.price) || getProductPrice(product, item),
      };
    });

    res.json({ success: true, data: orderObj });
  } catch (err) {
    console.error("Get order error:", err.message);
    res.status(500).json({ success: false, message: "Server error fetching order." });
  }
};

// SECURE ORDER CALCULATION
export const calculateOrder = async (req, res) => {
  try {
    const { orderItems, couponCode, pincode } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ success: false, message: "No items provided" });
    }

    let itemsPrice = 0;
    let totalWeight = 0;
    const items = [];

    for (const item of orderItems) {
      const productId = item.product || item.productId || item._id;
      const product = await Product.findById(productId);
      if (!product) continue;
      
      const price = getProductPrice(product, item);
      const qty = parseInt(item.qty || item.quantity || 1);
      
      itemsPrice += price * qty;
      totalWeight += (0.5 * qty); // Mock weight 0.5kg per item

      items.push({
        product: productId,
        name: product.name,
        price: price,
        qty: qty,
        total: price * qty
      });
    }

    // 1. Shipping Calculation (Shiprocket) - REMOVED AS REQUESTED
    let shippingPrice = 0;
    let shippingInfo = null;
    /*
    if (pincode) {
      const shipResult = await calculateShippingCharges({ delivery_postcode: pincode, weight: totalWeight });
      if (shipResult.success) {
        shippingPrice = shipResult.data.shipping_cost;
        shippingInfo = shipResult.data;
      } else {
        shippingPrice = 50; // Fallback
      }
    } else {
      shippingPrice = itemsPrice < 999 ? 99 : 0; // Simple fallback
    }
    */

    // 2. Discount Calculation (Coupon)
    let discount = 0;
    let couponInfo = null;
    if (couponCode) {
      try {
        const discResult = await calculateDiscount(couponCode, itemsPrice, req.user?.id);
        discount = discResult.discountAmount;
        couponInfo = discResult;
      } catch (err) {
        // We don't fail the whole calculation, just return the coupon error
        couponInfo = { error: err.message };
      }
    }

    // 3. Tax Calculation (18% GST on items after discount)
    const taxableAmount = itemsPrice - discount;
    const taxPrice = Number((taxableAmount * 0.18).toFixed(2));

    const totalPrice = taxableAmount + shippingPrice + taxPrice;

    res.json({
      success: true,
      data: {
        items,
        summary: {
          itemsPrice,
          discount,
          taxableAmount,
          taxPrice,
          shippingPrice,
          totalPrice,
        },
        coupon: couponInfo,
        shipping: shippingInfo,
        pincode
      }
    });
  } catch (error) {
    console.error("Order calculation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
