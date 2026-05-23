import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
  rating: { type: Number, default: 4 },
  description: { type: String },
  color: { type: String, default: "" },
  fabric: { type: String, default: "" },
  variant: { type: String, default: "" },
});

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    ...wishlistItemSchema.obj, // Embed the item fields directly
  },
  { timestamps: true }
);

export default mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);