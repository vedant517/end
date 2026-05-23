import Product from '../models/Product.js';
import { PRODUCT_MAIN_CATEGORIES, PRODUCT_SUB_CATEGORIES, PRODUCT_COLORS } from '../config/constants.js';
import { createCode128Svg } from '../../utils/barcode.js';
import { getMulterFileUrl, normalizeProductMedia } from '../../utils/mediaUrl.js';

const parseVariants = (variants) => {
  if (!variants) return [];
  try {
    const parsed = typeof variants === 'string' ? JSON.parse(variants) : variants;
    return Array.isArray(parsed)
      ? parsed.map((variant) => ({
          ...variant,
          price: Number(variant.price) || 0,
          mrp: Number(variant.mrp) || Number(variant.price) || 0,
          stock: Number(variant.stock) || 0,
        }))
      : [];
  } catch (err) {
    console.error('Error parsing variants:', err.message, 'Input:', variants);
    return [];
  }
};

const getLowestVariantPrice = (variants = []) => {
  const prices = variants
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length > 0 ? Math.min(...prices) : 0;
};

export const getProducts = async (req, res) => {
  try {
    const { category, subcategory, search, sort, page = 1, limit = 20 } = req.query;

    let query = {};
    const mongoose = (await import('mongoose')).default;

    if (req.query.mainCategory) {
      query.mainCategory = req.query.mainCategory;
    }
    
    if (req.query.categories) {
      query.categories = { $in: [req.query.categories] };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { mainCategory: { $regex: search, $options: 'i' } },
        { categories: { $in: [new RegExp(search, 'i')] } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    let sortOpt = { createdAt: -1 };
    if (sort === 'price_asc') sortOpt = { price: 1 };
    if (sort === 'price_desc') sortOpt = { price: -1 };
    if (sort === 'rating') sortOpt = { ratings: -1 };

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)

      .sort(sortOpt)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: products.map((p) => normalizeProductMedia(p, req)),
    });
  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }

};

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, mrp, mainCategory, categories, stock, variants } = req.body;
    
    console.log('Create Product Debug:', {
      name, description, price, mainCategory, stock,
      categoriesType: Array.isArray(categories) ? 'array' : typeof categories,
      variantsType: typeof variants
    });
    
    const parsedVariants = parseVariants(variants);
    const variantBasePrice = getLowestVariantPrice(parsedVariants);
    const finalPrice = Number(price) > 0 ? Number(price) : variantBasePrice;
    const finalMrp = Number(mrp) || finalPrice;

    if (!name || !description || !finalPrice || !mainCategory || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, description, base price or variant price, mainCategory and stock',
      });
    }

    // Handle categories - could be string or array
    let finalCategories = [];
    if (categories) {
      if (Array.isArray(categories)) {
        finalCategories = categories;
      } else if (typeof categories === 'string') {
        finalCategories = [categories];
      }
    }

    const productData = {
      name,
      description,
      price: finalPrice,
      mrp: finalMrp,
      mainCategory,
      categories: finalCategories,
      stock: Number(stock),
      variants: parsedVariants,
      isFeatured: req.body.isFeatured === 'true' || req.body.isFeatured === true,
      isActive: req.body.isActive === 'true' || req.body.isActive !== false,
      taxIncluded: req.body.taxIncluded === 'true' || req.body.taxIncluded === true,
      user: req.user ? req.user.id : undefined,
    };

    // Handle images from upload.any()
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (file.fieldname === 'image') {
          const uploadedUrl = getMulterFileUrl(file);
          productData.image = uploadedUrl;
          if (!productData.images) productData.images = [];
          productData.images.push({
            url: uploadedUrl,
            public_id: file.filename || file.public_id || Date.now().toString()
          });
        } else if (file.fieldname === 'images') {
          if (!productData.images) productData.images = [];
          const uploadedUrl = getMulterFileUrl(file);
          productData.images.push({
            url: uploadedUrl,
            public_id: file.filename || file.public_id || Date.now().toString()
          });
        } else if (file.fieldname.startsWith('variantImage_')) {
          const idx = parseInt(file.fieldname.split('_')[1]);
          if (productData.variants && productData.variants[idx]) {
            const uploadedUrl = getMulterFileUrl(file);
            productData.variants[idx].image = uploadedUrl;
            if (!productData.variants[idx].images) productData.variants[idx].images = [];
            productData.variants[idx].images.push(uploadedUrl);
          }
        } else if (file.fieldname.startsWith('variantImages_')) {
          const idx = parseInt(file.fieldname.split('_')[1]);
          if (productData.variants && productData.variants[idx]) {
            const uploadedUrl = getMulterFileUrl(file);
            if (!productData.variants[idx].images) productData.variants[idx].images = [];
            productData.variants[idx].images.push(uploadedUrl);
            if (!productData.variants[idx].image) productData.variants[idx].image = uploadedUrl;
          }
        }

      });

      // Ensure primary image is set
      if (!productData.image && productData.images && productData.images.length > 0) {
        productData.image = productData.images[0].url;
      }
    }

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      data: normalizeProductMedia(product.toObject(), req),
    });
  } catch (error) {
    console.error('Create Product Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

      .lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({
      success: true,
      data: normalizeProductMedia(product, req),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Create updateData from req.body AND req.files
    const updateData = { ...req.body };
    
    console.log('Update Product Debug:', {
      bodyFields: Object.keys(req.body),
      filesCount: req.files ? req.files.length : 0,
      variantsField: updateData.variants ? 'present' : 'missing'
    });
    
    // Convert types
    if (updateData.discountPrice) updateData.discountPrice = Number(updateData.discountPrice);
    if (updateData.stock) updateData.stock = Number(updateData.stock);
    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.mrp) updateData.mrp = Number(updateData.mrp);
    if (updateData.isFeatured) updateData.isFeatured = updateData.isFeatured === 'true';
    if (updateData.taxIncluded) updateData.taxIncluded = updateData.taxIncluded === 'true';
    if (updateData.isActive) updateData.isActive = updateData.isActive === 'true';
    
    // Parse variants
    if (updateData.variants) {
      updateData.variants = parseVariants(updateData.variants);
    } else {
      // Keep existing variants if not provided
      updateData.variants = product.variants || [];
    }

    const variantBasePrice = getLowestVariantPrice(updateData.variants || product.variants || []);
    if (updateData.price !== undefined && updateData.price > 0) {
      // Price is already set
    } else if (variantBasePrice > 0) {
      updateData.price = variantBasePrice;
    }
    if (updateData.mrp === undefined || updateData.mrp <= 0) {
      updateData.mrp = updateData.price || product.price;
    }
    // Handle categories - could be string or array
    let finalCategories = updateData.categories;
    if (updateData.categories) {
      if (Array.isArray(updateData.categories)) {
        finalCategories = updateData.categories;
      } else if (typeof updateData.categories === 'string') {
        finalCategories = [updateData.categories];
      }
    } else {
      // Keep existing categories if not provided
      finalCategories = product.categories || [];
    }
    updateData.categories = finalCategories;
    
    // Handle images from upload.any()
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (file.fieldname === 'image') {
          const uploadedUrl = getMulterFileUrl(file);
          updateData.image = uploadedUrl;
          if (!updateData.images) updateData.images = [];
          updateData.images.push({
            url: uploadedUrl,
            public_id: file.filename || file.public_id || Date.now().toString()
          });
        } else if (file.fieldname === 'images') {
          if (!updateData.images) updateData.images = [];
          const uploadedUrl = getMulterFileUrl(file);
          updateData.images.push({
            url: uploadedUrl,
            public_id: file.filename || file.public_id || Date.now().toString()
          });
        } else if (file.fieldname.startsWith('variantImage_')) {
          const idx = parseInt(file.fieldname.split('_')[1]);
          if (updateData.variants && updateData.variants[idx]) {
            const uploadedUrl = getMulterFileUrl(file);
            updateData.variants[idx].image = uploadedUrl;
            if (!updateData.variants[idx].images) updateData.variants[idx].images = [];
            updateData.variants[idx].images.push(uploadedUrl);
          }
        } else if (file.fieldname.startsWith('variantImages_')) {
          const idx = parseInt(file.fieldname.split('_')[1]);
          if (updateData.variants && updateData.variants[idx]) {
            const uploadedUrl = getMulterFileUrl(file);
            if (!updateData.variants[idx].images) updateData.variants[idx].images = [];
            updateData.variants[idx].images.push(uploadedUrl);
            if (!updateData.variants[idx].image) updateData.variants[idx].image = uploadedUrl;
          }
        }

      });

      // Update primary image if new one uploaded
      if (!updateData.image && updateData.images && updateData.images.length > 0) {
        // Only set if not already present or if we want to force update
        // (usually if a new main image was uploaded via 'image' field, it's already set)
      }
    }

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: false, // Set to false to avoid schema validation issues during partial updates
    }).lean();

    res.status(200).json({
      success: true,
      data: normalizeProductMedia(product, req),
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    await product.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
export const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ success: false, message: 'Product already reviewed' });
    }

    const review = {
      name: req.user.name || 'Anonymous',
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    product.reviews.push(review);

    product.numOfReviews = product.reviews.length;

    product.ratings =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) /
      product.reviews.length;

    // ✅ Also save to standalone Review collection for Admin Panel
    // Use dynamic import to avoid circular dependency if Review model imports Product
    const Review = (await import('../../User/models/Review.js')).default;
    await Review.create({
      user: req.user._id,
      product: product._id,
      rating: Number(rating),
      comment,
    });

    await product.save({ validateBeforeSave: false });
    res.status(201).json({ success: true, message: 'Review added' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getProductMetadata = async (req, res) => {
  try {
    const Category = (await import('../../User/models/Category.js')).default;
    
    // Fetch categories from DB
    const allCategories = await Category.find().lean();
    
    // For the dropdown, we show everything
    const mainCategories = allCategories;
    
    // For the tags, we also show everything
    const subCategories = allCategories.map(c => c.name);

    res.status(200).json({
      success: true,
      data: {
        mainCategories,
        categories: subCategories,
        colors: PRODUCT_COLORS
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('isActive');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Only flip isActive — avoid product.save() which re-validates the entire document
    // (legacy rows can fail on mrp/description/variants and break the toggle).
    const nextActive = product.isActive === false;

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: nextActive },
      { new: true, runValidators: false }
    );

    res.status(200).json({
      success: true,
      message: `Product ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle product status error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getProductBarcode = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const value = product.sku || product._id.toString();
    const svg = createCode128Svg(value);

    if (req.query.format === 'svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
      return;
    }

    res.json({
      success: true,
      data: {
        productId: product._id,
        name: product.name,
        value,
        svg,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
