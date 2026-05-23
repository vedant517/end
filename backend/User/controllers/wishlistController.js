import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";
import { requireAuthUserId } from "../utils/resolveAuthUserId.js";

const getProductImage = (product, fallback) => {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  if (typeof first === "string") return first;
  return first?.secure_url || first?.url || first?.path || product?.image || fallback;
};

const getProductPrice = (product, color, fabric) => {
  // Try to find variant price first
  if ((color || fabric) && Array.isArray(product?.variants)) {
    const matched = product.variants.find((v) => {
      const vColor = (v.color || "").toLowerCase().trim();
      const vFabric = (v.fabric || "").toLowerCase().trim();
      const cColor = (color || "").toLowerCase().trim();
      const cFabric = (fabric || "").toLowerCase().trim();
      if (cColor && cFabric) return vColor === cColor && vFabric === cFabric;
      if (cColor) return vColor === cColor;
      if (cFabric) return vFabric === cFabric;
      return false;
    });
    if (matched?.price) return Number(matched.price);
  }
  return Number(product?.discountPrice || product?.discounted_price || product?.price || 0);
};

const getVariantImage = (product, color, fabric) => {
  if ((color || fabric) && Array.isArray(product?.variants)) {
    const matched = product.variants.find((v) => {
      const vColor = (v.color || "").toLowerCase().trim();
      const vFabric = (v.fabric || "").toLowerCase().trim();
      const cColor = (color || "").toLowerCase().trim();
      const cFabric = (fabric || "").toLowerCase().trim();
      if (cColor && cFabric) return vColor === cColor && vFabric === cFabric;
      if (cColor) return vColor === cColor;
      if (cFabric) return vFabric === cFabric;
      return false;
    });
    if (matched?.image) return matched.image;
  }
  return null;
};

const mapWishlistItem = async (item) => {
  const product = await Product.findById(item.productId).lean().catch(() => null);
  if (!product) return item;

  const variantImage = getVariantImage(product, item.color, item.fabric);
  const current = {
    name: product.name,
    price: getProductPrice(product, item.color, item.fabric),
    image: variantImage || getProductImage(product, item.image),
    rating: product.ratings || product.rating || item.rating || 4,
    description: product.description || item.description,
  };

  if (
    item.name !== current.name ||
    item.price !== current.price ||
    item.image !== current.image ||
    item.description !== current.description
  ) {
    await Wishlist.updateOne({ _id: item._id }, { $set: current });
  }

  const plainItem = typeof item.toObject === "function" ? item.toObject() : item;
  return { ...plainItem, ...current };
};

// GET WISHLIST — scoped to req.user / JWT user id only
export const getWishlist = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const wishlistItems = await Wishlist.find({ userId: String(userId) });
    const wishlist = await Promise.all(wishlistItems.map(mapWishlistItem));
    res.json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ADD TO WISHLIST — variant-aware
export const addToWishlist = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const { productId, color, fabric, variant } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Build variant-aware duplicate query
    const duplicateQuery = { userId: String(userId), productId };
    const normalizedColor  = (color  || "").trim().toLowerCase();
    const normalizedFabric = (fabric || "").trim().toLowerCase();

    if (normalizedColor)  duplicateQuery.color  = { $regex: new RegExp(`^${normalizedColor}$`,  "i") };
    if (normalizedFabric) duplicateQuery.fabric = { $regex: new RegExp(`^${normalizedFabric}$`, "i") };
    // If no variant specified, match items that also have no variant
    if (!normalizedColor && !normalizedFabric) {
      duplicateQuery.color  = { $in: ["", null] };
      duplicateQuery.fabric = { $in: ["", null] };
    }

    const exists = await Wishlist.findOne(duplicateQuery);
    if (exists) {
      return res.status(400).json({ success: false, message: "This variant is already in your wishlist" });
    }

    const variantImage = getVariantImage(product, color, fabric);
    const variantLabel = variant || [color, fabric].filter(Boolean).join(" - ") || "";

    await Wishlist.create({
      userId: String(userId),
      productId,
      name: product.name,
      price: getProductPrice(product, color, fabric),
      image: variantImage || getProductImage(product, req.body.image),
      rating: product.ratings || product.rating || 4,
      description: product.description,
      color: color || "",
      fabric: fabric || "",
      variant: variantLabel,
    });

    const wishlistItems = await Wishlist.find({ userId: String(userId) });
    const wishlist = await Promise.all(wishlistItems.map(mapWishlistItem));
    res.status(201).json({ success: true, message: "Item added to wishlist", wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// REMOVE FROM WISHLIST — variant-aware
// Supports:  DELETE /wishlist/remove/:productId?color=Pink&fabric=Cotton
// Or body:   { color, fabric }
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const { productId } = req.params;
    const color  = req.query.color  || req.body?.color  || "";
    const fabric = req.query.fabric || req.body?.fabric || "";

    const removeQuery = { userId: String(userId), productId };
    const normalizedColor  = (color  || "").trim().toLowerCase();
    const normalizedFabric = (fabric || "").trim().toLowerCase();

    if (normalizedColor)  removeQuery.color  = { $regex: new RegExp(`^${normalizedColor}$`,  "i") };
    if (normalizedFabric) removeQuery.fabric = { $regex: new RegExp(`^${normalizedFabric}$`, "i") };

    const result = await Wishlist.deleteOne(removeQuery);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Item not found in wishlist" });
    }
    const wishlist = await Wishlist.find({ userId: String(userId) });
    res.json({ success: true, message: "Item removed from wishlist", wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CLEAR WISHLIST
export const clearWishlist = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    await Wishlist.deleteMany({ userId: String(userId) });
    res.json({ success: true, message: "Wishlist cleared", wishlist: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
