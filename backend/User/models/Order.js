import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productId: String,
  name: { type: String, required: true },
  image: String,
  price: { type: Number, required: true },
  qty: { type: Number, required: true, default: 1 }, // Changed from quantity to qty for Admin compatibility
  variant: String, // Added for Admin compatibility
  fabric: String,
  color: String,
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true }, // Added for Admin Dashboard compatibility
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderItems: [orderItemSchema], // Changed from items to orderItems
    shippingAddress: {
      fullName:   String,
      firstName:  String,
      lastName:   String,
      email:      String,
      phone:      String,
      address:    String,
      city:       String,
      state:      String,
      postalCode: String,
      country:    String,
    },
    customerName: { type: String },
    customerPhone: { type: String },
    cancellationReason: { type: String },
    itemsPrice: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    shippingPrice: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true }, // Changed from totalAmount to totalPrice
    paymentMethod: { type: String, default: "COD" },
    paymentResult: { // Added for Admin Dashboard compatibility
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },
    isPaid: { type: Boolean, default: false }, // Added for Admin Dashboard compatibility
    paidAt: Date,
    isDelivered: { type: Boolean, default: false },
    deliveredAt: Date,
    status: { 
      type: String, 
      default: "Pending", // Capitalized for Admin compatibility
      enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"] 
    },
    paymentStatus: { 
      type: String, 
      default: "pending", 
      enum: ["pending", "completed", "failed", "cod"] 
    },
    razorpayOrderId: String,
    razorpaySignature: String,
    trackingNumber: String,
    notes: String,
    coupon: {
      code: String,
      discountType: String,
      discountValue: Number
    },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
