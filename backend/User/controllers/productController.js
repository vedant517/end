import Product from "../models/Product.js";
import Offer from "../models/Offer.js";
import User from "../../models/User.js";
import { enrichEmbeddedReviews, resolveReviewerName } from "../utils/enrichReviews.js";
import { normalizeProductMedia } from "../../utils/mediaUrl.js";

// ✅ GET MAIN CATEGORIES
export const getMainCategories = async (req, res) => {
  try {
    const Category = (await import("../models/Category.js")).default;
    const categories = await Category.find({ isMain: true, isActive: { $ne: false } });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ GET SUB CATEGORIES
export const getSubCategories = async (req, res) => {
  try {
    const Category = (await import("../models/Category.js")).default;
    const categories = await Category.find({ isMain: false, isActive: { $ne: false } });
    res.json({ success: true, data: categories.map(c => c.name) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ GET ALL PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const { mainCategory, category, search, sort } = req.query;
    let query = { isActive: { $ne: false } };

    if (mainCategory) {
      query.mainCategory = mainCategory;
    }

    if (category) {
      query.categories = { $in: [category] };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    let products = await Product.find(query).lean();

    // Apply Offers
    try {
      const now = new Date();
      const activeOffers = await Offer.find({
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();

      products = products.map((product) => {
        const offer = activeOffers.find(
          (o) => o.productId.toString() === product._id.toString()
        );
        if (offer) {
          const discountAmount = (product.price * offer.discountPercent) / 100;
          return {
            ...product,
            discounted_price: Math.floor(product.price - discountAmount),
            offerTag: offer.tag || offer.name,
          };
        }
        return product;
      });
    } catch (offerErr) {
      console.error("OFFER CALC ERROR:", offerErr.message);
    }

    // Sorting
    if (sort === "price-asc") {
      products.sort((a, b) => (a.discounted_price || a.price) - (b.discounted_price || b.price));
    } else if (sort === "price-desc") {
      products.sort((a, b) => (b.discounted_price || b.price) - (a.discounted_price || a.price));
    } else if (sort === "rating") {
      products.sort((a, b) => b.rating - a.rating);
    } else if (sort === "newest") {
      products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const normalized = products.map((p) => normalizeProductMedia(p, req));

    res.json({
      success: true,
      data: normalized,
      products: normalized,
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      data: [],
    });
  }
};

// ✅ GET PRODUCT BY ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let productData = product;

    // Apply Offer
    try {
      const now = new Date();
      const offer = await Offer.findOne({
        productId: product._id,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();

      if (offer) {
        const discountAmount = (product.price * offer.discountPercent) / 100;
        productData = {
          ...product,
          discounted_price: Math.floor(product.price - discountAmount),
          offerTag: offer.tag || offer.name,
          offerDetails: offer,
        };
      }
    } catch (offerErr) {
      console.error("OFFER CALC ERROR:", offerErr.message);
    }

    const withReviewerNames = await enrichEmbeddedReviews(productData);
    const withMedia = normalizeProductMedia(withReviewerNames, req);

    res.json({
      success: true,
      data: withMedia,
      product: withMedia,
    });
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ✅ SEARCH PRODUCTS
export const searchProducts = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const products = await Product.find(
      {
        $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { mainCategory: { $regex: q, $options: "i" } },
        { categories: { $in: [new RegExp(q, "i")] } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ],
      isActive: true,
    }
  )
      .limit(Math.min(Number(limit) || 20, 50))
      .lean();

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("SEARCH PRODUCTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      data: [],
    });
  }
};

// ✅ ADD PRODUCT REVIEW
export const addProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: "Product already reviewed",
      });
    }

    const dbUser = await User.findById(req.user._id).select("name email");
    const reviewerName = resolveReviewerName({}, dbUser);

    const review = {
      user: req.user._id,
      name: reviewerName,
      rating: Number(rating),
      comment,
      date: new Date(),
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) /
      product.reviews.length;

    const Review = (await import("../models/Review.js")).default;
    await Review.create({
      user: req.user._id,
      product: product._id,
      rating: Number(rating),
      comment,
      name: reviewerName,
    });

    await product.save();
    const enriched = await enrichEmbeddedReviews(product.toObject());
    res.status(201).json({
      success: true,
      message: "Review added",
      data: enriched,
      product: enriched,
    });
  } catch (error) {
    console.error("ADD REVIEW ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
