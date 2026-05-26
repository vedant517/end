import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Plus, Search, Image as ImageIcon, Check,
  Edit2, Type, X, Layers, ChevronDown
} from 'lucide-react';
import { addProduct, updateProduct, fetchProductById } from '../../features/products/productSlice';
import { useNavigate, useParams } from 'react-router-dom';
import { formatINR } from '../../utils/currency';
import { fetchMetadata } from '../../features/products/categorySlice';
import { resolveImageUrl } from '../../utils/imageUrl';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const AddProduct = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const { loading, error } = useSelector((state) => state.products);
  const {
    mainCategories: MAIN_CATEGORIES = [],
    categories: SUB_CATEGORIES = [],
    colors: PRODUCT_COLORS = []
  } = useSelector((state) => state.categories || {});

  const [formData, setFormData] = useState({
    name: '', description: '', price: '', mrp: '', discountPrice: '',
    mainCategory: '', categories: [],
    stockQuantity: '', stockStatus: 'In Stock',
  });

  const [variants, setVariants] = useState([]);
  const [variantImages, setVariantImages] = useState([]);
  const [variantPreviews, setVariantPreviews] = useState([]);

  const [isActive, setIsActive] = useState(true);
  const [imageError, setImageError] = useState('');
  const [taxIncluded, setTaxIncluded] = useState(true);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isFeatured, setIsFeatured] = useState(true);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saleResult, setSaleResult] = useState(0);

  const fileInputRef = useRef(null);
  const variantImageRefs = useRef([]);

  useEffect(() => {
    dispatch(fetchMetadata());
    if (isEditMode) {
      const loadProduct = async () => {
        const result = await dispatch(fetchProductById(id));
        if (fetchProductById.fulfilled.match(result)) {
          const p = result.payload;
          setFormData({
            name: p.name || '', description: p.description || '',
            price: p.price || '', mrp: p.mrp || '', discountPrice: p.discountPrice || '',
            mainCategory: p.mainCategory || '',
            categories: p.categories || [],
            stockQuantity: p.stock || '',
            stockStatus: p.stock > 0 ? 'In Stock' : 'Out of Stock',
          });
          const loadedVariants = p.variants || [];
          const mappedVariants = loadedVariants.map(v => {
            let dp = v.discountPercentage || '';
            if (!dp && v.mrp && v.price && v.mrp > 0) {
               dp = Math.round(((v.mrp - v.price) / v.mrp) * 100).toString();
            }
            return { ...v, discountPercentage: dp };
          });
          setVariants(mappedVariants);
          setVariantImages(mappedVariants.map(() => null));
          setVariantPreviews(mappedVariants.map((v) => (v.image || v.images) ? resolveImageUrl(v.image || v.images, p.name) : null));
          setIsFeatured(p.isFeatured !== false);
          setIsActive(p.isActive !== false);
          if (p.image || p.images) setPreviews([resolveImageUrl(p.image || p.images, p.name)]);
        }
      };
      loadProduct();
    }
  }, [dispatch, id, isEditMode]);

  useEffect(() => {
    const p = getEffectiveBasePrice();
    const d = parseFloat(formData.discountPrice) || 0;
    setSaleResult(p - d);

    if (variants.length > 0) {
      const totalVariantStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      setFormData((prev) => ({ ...prev, stockQuantity: totalVariantStock.toString() }));
    }
  }, [formData.price, formData.discountPrice, variants]);

  const getVariantPrices = () =>
    variants
      .map((variant) => Number(variant.price))
      .filter((price) => Number.isFinite(price) && price > 0);

  const getEffectiveBasePrice = () => {
    const variantPrices = getVariantPrices();
    if (variantPrices.length > 0) return Math.min(...variantPrices);
    return Number(formData.price) || 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryToggle = (cat) => {
    setFormData(prev => {
      const current = prev.categories || [];
      if (current.includes(cat)) return { ...prev, categories: current.filter(c => c !== cat) };
      return { ...prev, categories: [...current, cat] };
    });
  };

  // ── Fixed: validate file types before accepting ──
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const invalidFiles = files.filter(f => !ALLOWED_IMAGE_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      setImageError('Only image files are allowed (JPG, PNG, WEBP, GIF)');
      // Reset input so the same file can be re-selected after correction
      e.target.value = '';
      return;
    }
    setImageError('');
    setImages((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    // Reset input value so same file can be selected again if needed
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index, field, value) => {
    const nv = [...variants];
    const variant = { ...nv[index], [field]: value };
    
    // Auto-calculate discount or selling price
    if (field === 'mrp') {
      const mrpVal = parseFloat(value);
      if (!isNaN(mrpVal) && mrpVal > 0) {
        if (variant.discountPercentage !== undefined && variant.discountPercentage !== '') {
          const discount = parseFloat(variant.discountPercentage);
          if (!isNaN(discount)) {
            variant.price = Math.round(mrpVal - (mrpVal * discount / 100)).toString();
          }
        } else if (variant.price !== undefined && variant.price !== '') {
          const price = parseFloat(variant.price);
          if (!isNaN(price)) {
            variant.discountPercentage = Math.round(((mrpVal - price) / mrpVal) * 100).toString();
          }
        }
      }
    } else if (field === 'price') {
      const priceVal = parseFloat(value);
      const mrpVal = parseFloat(variant.mrp);
      if (!isNaN(priceVal) && !isNaN(mrpVal) && mrpVal > 0) {
        variant.discountPercentage = Math.round(((mrpVal - priceVal) / mrpVal) * 100).toString();
      } else if (value === '') {
        variant.discountPercentage = '';
      }
    } else if (field === 'discountPercentage') {
      const discount = parseFloat(value);
      const mrpVal = parseFloat(variant.mrp);
      if (!isNaN(discount) && !isNaN(mrpVal) && mrpVal > 0) {
        variant.price = Math.round(mrpVal - (mrpVal * discount / 100)).toString();
      } else if (value === '') {
        variant.price = '';
      }
    }

    nv[index] = variant;
    setVariants(nv);
  };

  // ── Fixed: validate variant image file types too ──
  const handleVariantImageChange = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Only image files are allowed (JPG, PNG, WEBP, GIF)');
      e.target.value = '';
      return;
    }
    setImageError('');
    const newImages = [...variantImages];
    const newPreviews = [...variantPreviews];
    newImages[index] = file;
    newPreviews[index] = URL.createObjectURL(file);
    setVariantImages(newImages);
    setVariantPreviews(newPreviews);
    e.target.value = '';
  };

  const removeVariantImage = (index) => {
    const newImages = [...variantImages];
    const newPreviews = [...variantPreviews];
    newImages[index] = null;
    newPreviews[index] = null;
    setVariantImages(newImages);
    setVariantPreviews(newPreviews);
  };

  const addVariant = () => {
    setVariants([...variants, { color: '', fabric: '', price: '', mrp: '', discountPercentage: '', stock: '' }]);
    setVariantImages([...variantImages, null]);
    setVariantPreviews([...variantPreviews, null]);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
    setVariantImages(variantImages.filter((_, i) => i !== index));
    setVariantPreviews(variantPreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const variantPrices = getVariantPrices();
    const effectiveBasePrice = getEffectiveBasePrice();

    if (effectiveBasePrice <= 0) {
      setImageError('Please enter a base price or at least one valid variant price.');
      return;
    }

    const submissionData = new FormData();
    submissionData.append('name', formData.name);
    submissionData.append('description', formData.description);
    submissionData.append('price', String(effectiveBasePrice));
    submissionData.append('mrp', String(formData.mrp || effectiveBasePrice));
    submissionData.append('discountPrice', formData.discountPrice);
    submissionData.append('mainCategory', formData.mainCategory);
    formData.categories.forEach(cat => submissionData.append('categories', cat));
    submissionData.append('taxIncluded', taxIncluded);
    submissionData.append('isFeatured', isFeatured);
    submissionData.append('isActive', isActive);
    submissionData.append('stock', isUnlimited ? 999999 : formData.stockQuantity);
    submissionData.append('variants', JSON.stringify(variants.map((variant) => ({
      ...variant,
      price: Number(variant.price) || effectiveBasePrice,
      mrp: Number(variant.mrp) || Number(variant.price) || Number(formData.mrp) || effectiveBasePrice,
      discountPercentage: Number(variant.discountPercentage) || 0,
      stock: Number(variant.stock) || 0,
    }))));
    if (images.length > 0) submissionData.append('image', images[0]);
    variantImages.forEach((file, idx) => {
      if (file) submissionData.append(`variantImage_${idx}`, file);
    });

    let result;
    if (isEditMode) {
      result = await dispatch(updateProduct({ id, productData: submissionData }));
    } else {
      result = await dispatch(addProduct(submissionData));
    }
    if (addProduct.fulfilled.match(result) || updateProduct.fulfilled.match(result)) {
      navigate('/products');
    }
  };

  /* ── shared input style ── */
  const inputStyle = {
    width: '100%', padding: '12px 16px', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px',
    outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box', color: '#1e293b',
  };

  const labelStyle = {
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block',
  };

  const sectionStyle = {
    background: 'white', padding: '24px', borderRadius: '16px',
    border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  };

  const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all box-border text-slate-800 focus:border-[#85754E] focus:bg-white";
  const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block";
  const sectionCls = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm";

  return (
    <div className="flex flex-col gap-0 bg-slate-50 flex-1 min-w-0">

      {/* Top bar */}
      <div className="px-4 py-4 md:px-6 md:py-5 flex flex-col gap-3 md:flex-row md:justify-between md:items-center md:flex-wrap bg-slate-50">
        <div>
          <h1 className="text-lg font-extrabold text-gray-800 m-0">
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-[13px] text-slate-500 mt-1 mb-0">
            {isEditMode ? 'Modify existing product details' : 'Create and publish a new item in your store'}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-56">
            <input
              type="text"
              placeholder="Search product metadata..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all box-border text-slate-800"
            />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button type="submit" form="main-form"
            style={{ padding: '10px 20px', background: '#85754E', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? 'Processing...' : (isEditMode ? 'Update Product' : 'Publish Product')}
          </button>
        </div>
      </div>

      {/* Redux error */}
      {error && (
        <div className="mx-4 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center gap-2">
          <X size={16} /> {error}
        </div>
      )}

      {/* Image validation error */}
      {imageError && (
        <div className="mx-4 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <X size={16} /> {imageError}
          </div>
          <button
            type="button"
            onClick={() => setImageError('')}
            className="text-red-400 hover:text-red-600 bg-transparent border-0 cursor-pointer p-0 leading-none"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Form */}
      <form
        id="main-form"
        onSubmit={handleSubmit}
        className="px-4 pb-6 flex flex-col gap-5 lg:px-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-5 lg:items-start"
      >
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">

          {/* Basic Details */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Type size={16} color="#85754E" /> Basic Details
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Product Name</label>
                <input required name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Silk Saree" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Product Description</label>
                <textarea
                  required name="description" rows={5} value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide a detailed description of the product features..."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Variants */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Layers size={16} color="#85754E" /> Product Variants
              </h2>
              <button type="button" onClick={addVariant} style={{ fontSize: '12px', fontWeight: 700, color: '#85754E', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> Add Variant
              </button>
            </div>

            {variants.length === 0 ? (
              <div className="py-7 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-xs text-slate-400 m-0">No variants added. (e.g., Color, Fabric, Price)</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {variants.map((variant, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_100px_100px_36px] sm:items-end">
                      {[
                        { label: 'Fabric', field: 'fabric', type: 'text' },
                        { label: 'MRP', field: 'mrp', type: 'number' },
                        { label: 'Selling Price', field: 'price', type: 'number' },
                        { label: 'Discount %', field: 'discountPercentage', type: 'number' },
                        { label: 'Stock', field: 'stock', type: 'number' },
                      ].map(({ label, field, type }) => (
                        <div key={field}>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{label}</label>
                          <input
                            required
                            type={type}
                            value={variant[field]}
                            onChange={(e) => handleVariantChange(idx, field, e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none box-border"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="p-2 text-red-300 bg-transparent border-0 cursor-pointer self-end hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Variant Color</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Royal Blue, Golden, etc."
                        value={variant.color || ''}
                        onChange={(e) => handleVariantChange(idx, 'color', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Variant Image</label>
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                        {variantPreviews[idx] ? (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50">
                            <img src={variantPreviews[idx]} className="w-full h-full object-cover" alt="Variant preview" />
                            <button
                              type="button"
                              onClick={() => removeVariantImage(idx)}
                              className="absolute inset-0 bg-red-500/75 flex items-center justify-center border-0 cursor-pointer text-white hover:bg-red-600/90 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => variantImageRefs.current[idx]?.click()}
                            className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer bg-slate-50 text-slate-400 hover:border-[#85754E] hover:text-[#85754E] transition-all flex-shrink-0"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-700 truncate m-0">
                            {variantImages[idx] ? variantImages[idx].name : (variant.image ? "Saved Image" : "No image selected")}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 mb-0">
                            JPG, PNG, WEBP (Max 5MB)
                          </p>
                        </div>
                        <input
                          ref={(el) => (variantImageRefs.current[idx] = el)}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleVariantImageChange(idx, e)}
                        />
                      </div>
                    </div>

                    <button type="button" onClick={() => removeVariant(idx)} style={{ padding: '8px', color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1px' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className={sectionCls}>
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 mb-5">Pricing</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>MRP (Maximum Retail Price)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number" name="mrp" value={formData.mrp}
                      onChange={handleInputChange} placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Base Selling Price (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      required={variants.length === 0} type="number" name="price" value={formData.price}
                      onChange={handleInputChange} placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
                {variants.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-[11px] text-[#85754E] font-bold mt-2 mb-0">
                      Variant pricing active: product base will save as lowest variant price ({formatINR(getEffectiveBasePrice())}).
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Discount Price (INR)</label>
                <div style={{ borderRadius: '12px', border: '1px solid #F0E5CF', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
                    <span style={{ padding: '12px 14px', background: '#FFF5E2', color: '#85754E', fontWeight: 700 }}>₹</span>
                    <input type="number" name="discountPrice" value={formData.discountPrice} onChange={handleInputChange} placeholder="0.00"
                      style={{ background: '#FFF5E2', padding: '12px', fontSize: '14px', fontWeight: 700, color: '#85754E', border: 'none', outline: 'none' }} />
                  </div>
                  <div style={{ background: '#FFF5E2', borderTop: '1px solid #F0E5CF', padding: '8px 14px', fontSize: '11px', fontWeight: 700, color: '#85754E', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Sale: {formatINR(saleResult)}
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Tax Included</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Yes', 'No'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTaxIncluded(opt === 'Yes')}
                      className={`py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${(opt === 'Yes' ? taxIncluded : !taxIncluded) ? 'border-0 bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-400'}`}
                    >
                      Tax {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Inventory & Stock</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Unlimited</span>
                <button type="button" onClick={() => setIsUnlimited(!isUnlimited)}
                  style={{ width: '44px', height: '22px', borderRadius: '999px', position: 'relative', border: 'none', cursor: 'pointer', background: isUnlimited ? '#85754E' : '#e2e8f0', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: 'left 0.2s', left: isUnlimited ? '24px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Stock Quantity</label>
                <input
                  type="number" name="stockQuantity" disabled={isUnlimited || variants.length > 0}
                  value={isUnlimited ? '' : formData.stockQuantity}
                  onChange={handleInputChange} placeholder={isUnlimited ? 'Unlimited' : '0'}
                  className={`${inputCls} ${isUnlimited || variants.length > 0 ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                />
                {variants.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">Auto-calculated from variants</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Stock Status</label>
                <div className="relative">
                  <select
                    name="stockStatus" value={formData.stockStatus} onChange={handleInputChange}
                    className={`${inputCls} appearance-none pr-9 cursor-pointer`}
                  >
                    <option>In Stock</option>
                    <option>Out of Stock</option>
                    <option>Pre-Order</option>
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', cursor: 'pointer', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: isFeatured ? 'none' : '2px solid #cbd5e1', background: isFeatured ? '#85754E' : 'white', transition: 'all 0.15s' }}>
                {isFeatured && <Check size={13} color="white" strokeWidth={3} />}
              </div>
              <input type="checkbox" style={{ display: 'none' }} checked={isFeatured} onChange={() => setIsFeatured(!isFeatured)} />
              <span style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>Highlight this product in a featured top section on your storefront.</span>
            </label>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">

          {/* Media */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '20px' }}>Product Media</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div onClick={() => fileInputRef.current.click()}
                style={{ border: '2px dashed #F0E5CF', borderRadius: '16px', background: '#FFF5E2', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#85754E'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#F0E5CF'}
              >
                {previews.length > 0 ? (
                  <img src={previews[0]} className="max-h-[140px] w-full object-contain rounded-xl" alt="main" />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '52px', height: '52px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <ImageIcon size={22} color="#85754E" />
                    </div>
                    <p className="text-[13px] font-bold text-gray-700 m-0">Drop your image here</p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Supports JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {previews.slice(1).map((src, idx) => (
                  <div key={idx} className="aspect-square bg-slate-50 rounded-xl border border-slate-200 relative overflow-hidden">
                    <img src={src} className="w-full h-full object-cover" alt="thumb" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx + 1)}
                      className="absolute inset-0 bg-red-500/70 flex items-center justify-center border-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current.click()}
                  style={{ aspectRatio: '1', border: '2px dashed #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white', color: '#94a3b8', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#85754E'; e.currentTarget.style.color = '#85754E'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}>
                  <Plus size={16} />
                </button>
              </div>

              {/* ── Fixed: added accept="image/*" to restrict file picker to images only ── */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* Organization */}
          <div className={sectionCls}>
            <h2 className="text-sm font-extrabold text-slate-800 mb-5 mt-0">Organization</h2>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className={labelCls}>Main Category</label>
                <div className="relative">
                  <select
                    required name="mainCategory" value={formData.mainCategory} onChange={handleInputChange}
                    className={`${inputCls} appearance-none pr-9 cursor-pointer`}
                  >
                    <option value="">Select Main Category</option>
                    {SUB_CATEGORIES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tags / Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SUB_CATEGORIES.filter(cat => cat !== formData.mainCategory).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryToggle(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${formData.categories?.includes(cat) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-5 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="py-3 bg-slate-100 text-slate-500 border-0 rounded-xl text-[13px] font-bold cursor-pointer hover:bg-slate-200 transition-colors"
              >
                Dismiss
              </button>
              <button type="submit" form="main-form"
                style={{ padding: '12px', background: '#85754E', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {isEditMode ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddProduct;
