import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Transaction from "../../admin/models/Transaction.js";

// Initialize Razorpay only if credentials are available
let razorpay = null;
const hasRazorpayCredentials = process.env.RAZORPAY_KEY_ID && 
                                 process.env.RAZORPAY_KEY_ID !== "rzp_test_placeholder" &&
                                 process.env.RAZORPAY_KEY_SECRET &&
                                 process.env.RAZORPAY_KEY_SECRET !== "placeholder_secret";

if (hasRazorpayCredentials) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️ Razorpay credentials not configured. Using MOCK MODE for development/testing.");
}

// Mock Razorpay order creation for testing
const createMockRazorpayOrder = (options) => {
  return {
    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entity: "order",
    amount: options.amount,
    amount_paid: 0,
    amount_due: options.amount,
    currency: options.currency,
    receipt: options.receipt,
    offer_id: null,
    status: "created",
    attempts: 0,
    notes: options.notes,
    created_at: Math.floor(Date.now() / 1000),
  };
};

const createUpiPaymentPayload = ({ amount, orderId, note }) => {
  const payeeAddress = process.env.UPI_ID || process.env.RAZORPAY_UPI_ID;
  const payeeName = process.env.UPI_PAYEE_NAME || "Sheetalya";

  if (!payeeAddress) {
    return null;
  }

  const params = new URLSearchParams({
    pa: payeeAddress,
    pn: payeeName,
    cu: "INR",
  });

  if (amount) params.set("am", String(Number(amount).toFixed(2)));
  if (orderId) params.set("tr", String(orderId));
  if (note || orderId) params.set("tn", note || `Order ${orderId}`);

  const upiLink = `upi://pay?${params.toString()}`;
  return {
    upiLink,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiLink)}`,
  };
};

export const createPaymentQr = async (req, res) => {
  try {
    const { amount, orderId, note } = req.body;
    let paymentAmount = amount;

    if (orderId && !paymentAmount) {
      let dbOrder = null;
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        dbOrder = await Order.findById(orderId);
      }
      if (!dbOrder) {
        dbOrder = await Order.findOne({ orderId });
      }
      paymentAmount = dbOrder?.totalPrice;
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required for QR payment" });
    }

    const qr = createUpiPaymentPayload({ amount: paymentAmount, orderId, note });
    if (!qr) {
      return res.status(400).json({ success: false, message: "UPI_ID is not configured on the backend" });
    }

    res.json({
      success: true,
      data: {
        amount: Number(paymentAmount),
        currency: "INR",
        orderId: orderId || null,
        ...qr,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE RAZORPAY ORDER
export const createRazorpayOrder = async (req, res) => {
  console.log("--- RECV: User createRazorpayOrder ---");
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("User:", req.user);
  try {
    // Validate user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { amount, totalPrice, grandTotal, orderTotal, currency = "INR", orderId, notes = {} } = req.body;
    
    let paymentAmount = amount || totalPrice || grandTotal || orderTotal;

    // 1. Try to fetch amount from DB if orderId is provided
    let dbOrderId = undefined;
    let dbOrder = null;
    if (orderId) {
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        dbOrder = await Order.findById(orderId);
      }
      if (!dbOrder) {
        dbOrder = await Order.findOne({ orderId: orderId });
      }
      
      if (dbOrder) {
        dbOrderId = dbOrder._id;
        if (!paymentAmount) {
          paymentAmount = Number(dbOrder.totalPrice);
          console.log(`Found order ${orderId}, using total price from DB: ${paymentAmount}`);
        }
      }
    }

    if (!paymentAmount) {
      return res.status(400).json({ success: false, message: "Amount is required" });
    }

    const options = {
      amount: Math.round(paymentAmount * 100),
      currency,
      receipt: orderId || `receipt_${Date.now()}`,
      notes: {
        orderId: orderId || "",
        userId: req.user.id || "",
        ...notes,
      },
    };

    console.log("Creating payment order with options:", JSON.stringify(options, null, 2));
    
    let order;
    
    // Use mock mode if Razorpay credentials not configured
    if (!hasRazorpayCredentials) {
      console.log("Using MOCK Razorpay order (development mode)");
      order = createMockRazorpayOrder(options);
    } else {
      try {
        order = await razorpay.orders.create(options);
      } catch (razorpayError) {
        console.error("Razorpay API Error:", razorpayError);
        const errMsg = razorpayError.error?.description || razorpayError.description || razorpayError.message || (typeof razorpayError === 'object' ? JSON.stringify(razorpayError) : String(razorpayError));
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create payment order: " + errMsg 
        });
      }
    }

    if (!order) {
      return res.status(500).json({ success: false, message: "Failed to create payment order" });
    }

    // Create transaction record
    try {
      await Transaction.create({
        user: req.user.id,
        order: dbOrderId,
        razorpayOrderId: order.id,
        amount: paymentAmount,
        currency,
        status: "created",
        receipt: options.receipt,
        notes: options.notes,
      });
      console.log("Transaction created successfully:", order.id);
    } catch (txnError) {
      console.error("Transaction Record Error:", txnError);
      // Don't fail the whole request if transaction record creation fails
    }

    res.json(order);
  } catch (error) {
    console.error("Payment order creation error:", error);
    res.status(500).json({ success: false, message: "Internal server error: " + error.message });
  }
};

// VERIFY PAYMENT
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    
    console.log("--- RECV: User verifyPayment ---");
    console.log("Order ID:", orderId);
    console.log("Razorpay Order ID:", razorpay_order_id);
    console.log("User:", req.user);

    let isValidSignature = false;

    // In mock mode, accept the payment without verification
    if (!hasRazorpayCredentials) {
      console.log("Using MOCK payment verification (development mode)");
      isValidSignature = true;
    } else {
      // Real Razorpay signature verification
      const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generated_signature = hmac.digest("hex");
      isValidSignature = generated_signature === razorpay_signature;
    }

    if (isValidSignature) {
      // Find transaction first to fallback orderId if frontend missed it
      const transaction = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });
      
      let dbOrderId = orderId || (transaction ? transaction.order : null);

      if (dbOrderId) {
        if (!mongoose.Types.ObjectId.isValid(dbOrderId)) {
          const dbOrder = await Order.findOne({ orderId: dbOrderId });
          if (dbOrder) dbOrderId = dbOrder._id;
        }
        
        const updateResult = await Order.findByIdAndUpdate(dbOrderId, {
          paymentStatus: "completed",
          paymentResult: { id: razorpay_payment_id, status: "completed", update_time: Date.now().toString() },
          isPaid: true,
          paidAt: Date.now(),
          razorpayOrderId: razorpay_order_id,
          razorpaySignature: razorpay_signature,
        }, { new: true });
        
        console.log("Order updated:", updateResult?._id);
      }

      if (transaction) {
        transaction.razorpayPaymentId = razorpay_payment_id;
        transaction.razorpaySignature = razorpay_signature;
        transaction.status = "captured";
        await transaction.save();
        console.log("Transaction updated:", transaction._id);
      }

      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      console.warn("Invalid signature detected");
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
