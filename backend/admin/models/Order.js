import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: { // Added for dashboard compatibility
    type: String,
    unique: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: null,
  },
  orderItems: [
    {
      name: { type: String, required: true },
      qty: { type: Number, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      variant: { type: String }, // Store variant name/label
      fabric: { type: String },   // Store variant fabric
      color: { type: String },    // Store variant color
      product: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: true,
      },
    },
  ],
  shippingAddress: {
    fullName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
  },
  customerName: { type: String },
  customerPhone: { type: String },
  cancellationReason: { type: String },
  paymentMethod: {
    type: String,
    default: 'Razorpay'
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String,
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0,
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0,
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0,
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0,
  },
  discountPrice: {
    type: Number,
    required: true,
    default: 0.0,
  },
  isPaid: {
    type: Boolean,
    required: true,
    default: false,
  },
  paidAt: {
    type: Date,
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false,
  },
  deliveredAt: {
    type: Date,
  },
  status: { // Added for dashboard compatibility
    type: String,
    enum: ["Pending", "Delivered", "Cancelled", "Shipped", "Out for Delivery"],
    default: "Pending",
  },
}, {
  timestamps: true,
  bufferCommands: false,
});

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
