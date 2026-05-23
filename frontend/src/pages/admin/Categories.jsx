import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import {
  Plus, Trash2, Edit2, Image as ImageIcon,
  X, Loader2, Upload, RefreshCw, Link, ToggleLeft, ToggleRight
} from 'lucide-react';
import { resolveImageUrl } from '../../utils/imageUrl';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', image: null, imageUrl: '', isMain: false, isActive: true, categories: '' });
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [urlInputMode, setUrlInputMode] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/categories', { params: { isAdmin: true } });
      setCategories(data.data);
      setImgErrors({});
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
      setFormData(prev => ({ ...prev, image: file, imageUrl: '' }));
      setPreview(URL.createObjectURL(file));
      setUrlInputMode(false);
    }
  };

  const handleUrlInput = (url) => {
    setFormData(prev => ({ ...prev, imageUrl: url, image: null }));
    setPreview(url.trim() ? url.trim() : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = new FormData();
    payload.append('name', formData.name);
    payload.append('isMain', formData.isMain);
    payload.append('isActive', formData.isActive);
    payload.append('categories', formData.categories || '');
    if (formData.image instanceof File) {
      payload.append('image', formData.image);
    } else if (formData.imageUrl && typeof formData.imageUrl === 'string' && formData.imageUrl.trim() !== '') {
      payload.append('imageUrl', formData.imageUrl.trim());
    }
    const config = { headers: { 'Content-Type': 'multipart/form-data' } };
    try {
      let savedCategory;
      if (editingId) {
        const { data } = await api.put(`/admin/categories/${editingId}`, payload, config);
        savedCategory = data.data;
        setCategories(prev => prev.map(c => c._id === editingId ? savedCategory : c));
      } else {
        const { data } = await api.post('/admin/categories', payload, config);
        savedCategory = data.data;
        setCategories(prev => [savedCategory, ...prev]);
      }
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      alert(error.response?.data?.message || 'Something went wrong. Make sure you are logged in as an admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFormData({ name: '', image: null, imageUrl: '', isMain: false, isActive: true, categories: '' });
    setPreview(null);
    setUrlInputMode(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      setCategories(prev => prev.filter(c => c._id !== id));
    } catch {
      alert('Error deleting category');
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat._id);
    const existingUrl = resolveImageUrl(cat.image, cat.name, { fallback: null }) || '';
    setFormData({
      name: cat.name,
      image: null,
      imageUrl: existingUrl,
      isMain: cat.isMain || false,
      isActive: cat.isActive !== false,
      categories: Array.isArray(cat.categories) ? cat.categories.join(', ') : ''
    });
    setPreview(existingUrl || null);
    setUrlInputMode(!!existingUrl);
    setShowAddModal(true);
  };

  const handleToggle = async (id) => {
    try {
      await api.patch(`/admin/categories/${id}/toggle-status`);
      setCategories(prev => prev.map(c => c._id === id ? { ...c, isActive: !c.isActive } : c));
    } catch {
      alert('Error toggling category status');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh]">
      <Loader2 className="animate-spin text-[#85754E]" size={40} />
    </div>
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-6 p-6 max-sm:p-4 max-sm:gap-4">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 max-sm:flex-col max-sm:items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#85754E] rounded-2xl flex items-center justify-center shrink-0">
            <ToggleLeft size={24} color="white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">Category Management</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 mb-0">Add, edit and manage your product categories.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchCategories}
            title="Refresh list"
            className="flex items-center gap-1.5 bg-slate-100 text-slate-600 border-0 px-3.5 py-2.5 rounded-xl font-semibold cursor-pointer text-sm hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-[#85754E] text-white border-0 px-5 py-2.5 rounded-xl font-bold cursor-pointer text-sm shadow-lg shadow-amber-200 hover:bg-[#837349] transition-colors"
          >
            <Plus size={18} /> Add New Category
          </button>
        </div>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <ImageIcon size={52} className="mx-auto mb-4 opacity-35" />
          <p className="text-base font-medium">No categories yet. Add your first one!</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map((cat, idx) => {
          const imgSrc = resolveImageUrl(cat.image, cat.name, { fallback: null });
          const hasError = imgErrors[cat._id];
          const isFirst = idx === 0;
                            console.log(imgSrc)

          return (
            <div key={cat._id} className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-shadow duration-300 bg-white">
              {/* Image */}
              <div className="w-full h-44 relative bg-slate-100 overflow-hidden">
                {imgSrc && !hasError ? (
                  <img
                    src={imgSrc}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors(prev => ({ ...prev, [cat._id]: true }))}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1.5">
                    <ImageIcon size={36} />
                    {hasError && <span className="text-xs text-red-400 font-medium">Image failed to load</span>}
                  </div>
                )}
                {cat.isMain && (
                  <div className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-lg ${isFirst ? 'bg-white text-heritage shadow-black/10' : 'bg-[#85754E] text-white shadow-amber-300'}`}>
                    Featured
                  </div>
                )}
                <div className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-lg ${cat.isActive !== false ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {cat.isActive !== false ? 'Active' : 'Disabled'}
                </div>
              </div>
              {/* Body */}
              <div className="px-5 py-4">
                <div className="flex justify-between items-center">
                  <div className="min-w-0 mr-3">
                    <h3 className="text-sm font-black truncate uppercase tracking-tight m-0 text-heritage">{cat.name}</h3>
                    <p className="text-[10px] font-bold mt-1 uppercase tracking-widest mb-0 text-slate-400">/{cat.slug}</p>
                    {Array.isArray(cat.categories) && cat.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cat.categories.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-400">
                            {tag}
                          </span>
                        ))}
                        {cat.categories.length > 3 && (
                          <span className="text-[9px] font-bold px-1 py-0.5 text-slate-400">
                            +{cat.categories.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 items-center">
                    <button
                      onClick={() => handleToggle(cat._id)}
                      title={cat.isActive !== false ? "Disable" : "Enable"}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer hover:bg-slate-50 transition-all text-[11px] font-bold bg-white ${cat.isActive !== false ? 'border-amber-200 text-amber-500' : 'border-slate-200 text-[#85754E]'}`}
                    >
                      {cat.isActive !== false ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {cat.isActive !== false ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => startEdit(cat)}
                      title="Edit"
                      className="p-1.5 rounded-lg border cursor-pointer hover:opacity-80 hover:scale-105 transition-all bg-white border-slate-200 text-slate-500"
                    ><Edit2 size={15} /></button>
                    <button
                      onClick={() => handleDelete(cat._id)}
                      title="Delete"
                      className="p-1.5 rounded-lg border cursor-pointer hover:opacity-80 hover:scale-105 transition-all bg-red-50 border-red-100 text-red-500"
                    ><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center z-[1000] p-5"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); resetForm(); } }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[95vh] overflow-y-auto">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-900">{editingId ? 'Edit Category' : 'Add Category'}</h2>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="border-0 bg-slate-100 rounded-lg cursor-pointer text-slate-500 p-1.5 flex hover:bg-slate-200 transition-colors"
              ><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Name */}
              <div className="mb-5">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g. Wedding Collection"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm text-slate-800 focus:border-[#85754E] transition-colors box-border"
                />
              </div>

              {/* Sub-categories / Tags */}
              <div className="mb-5">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                  Sub-categories / Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.categories}
                  onChange={(e) => setFormData(prev => ({ ...prev, categories: e.target.value }))}
                  placeholder="e.g. Wedding, Festive, Party Wear, Casual"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm text-slate-800 focus:border-[#85754E] transition-colors box-border"
                />
              </div>

              {/* Image Section */}
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                  Category Image
                </label>

                {/* Tab switcher */}
                <div className="flex rounded-xl overflow-hidden border border-amber-100 mb-3 bg-[#FFF5E2]">
                  <button
                    type="button"
                    onClick={() => setUrlInputMode(false)}
                    className={`flex-1 py-2.5 border-0 cursor-pointer text-sm font-bold flex items-center justify-center gap-1.5 transition-all border-r border-amber-100 ${!urlInputMode ? 'bg-[#85754E] text-white shadow-inner' : 'bg-transparent text-slate-500 hover:bg-white/50'}`}
                  >
                    <Upload size={14} /> Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrlInputMode(true)}
                    className={`flex-1 py-2.5 border-0 cursor-pointer text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${urlInputMode ? 'bg-[#85754E] text-white shadow-inner' : 'bg-transparent text-slate-500 hover:bg-white/50'}`}
                  >
                    <Link size={14} /> Paste URL
                  </button>
                </div>

                {/* Upload zone */}
                {!urlInputMode && (
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-2xl h-44 flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-50 hover:border-[#85754E] hover:bg-amber-50 transition-all relative"
                    onClick={() => fileInputRef.current.click()}
                  >
                    {preview && formData.image instanceof File ? (
                      <img src={preview} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                      <>
                        <Upload size={30} className="text-slate-400" />
                        <p className="text-sm text-slate-600 mt-2 mb-0.5 font-medium">Click to upload</p>
                        <p className="text-xs text-slate-400">PNG, JPG, WEBP — max 10 MB</p>
                      </>
                    )}
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                />

                {/* URL input */}
                {urlInputMode && (
                  <div>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => handleUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm text-slate-800 mb-2.5 focus:border-[#85754E] transition-colors box-border"
                    />
                    {preview && (
                      <div className="w-full h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img
                          src={preview}
                          alt="URL Preview"
                          className="w-full h-full object-cover block"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="hidden w-full h-full items-center justify-center text-red-400 text-xs font-medium flex-col gap-1.5">
                          <ImageIcon size={28} className="text-red-400" />
                          Invalid image URL
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Remove button for file */}
                {!urlInputMode && preview && formData.image instanceof File && (
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[75%]">
                      📁 {formData.image.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
                        setPreview(null);
                        setFormData(prev => ({ ...prev, image: null, imageUrl: '' }));
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-500 bg-transparent border-0 cursor-pointer font-semibold flex-shrink-0"
                    >✕ Remove</button>
                  </div>
                )}
              </div>

              {/* isMain */}
              <div className="mb-7 flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="isMain"
                  checked={formData.isMain}
                  onChange={(e) => setFormData(prev => ({ ...prev, isMain: e.target.checked }))}
                  className="w-4.5 h-4.5 accent-[#85754E] flex-shrink-0 cursor-pointer"
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="isMain" className="text-sm font-semibold text-slate-500 cursor-pointer m-0">
                  Show on Home Page Showcase
                </label>
              </div>

              {/* isActive */}
              <div className="mb-7 flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4.5 h-4.5 accent-[#85754E] flex-shrink-0 cursor-pointer"
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-500 cursor-pointer m-0">
                  Enable this Category (Inactive categories are hidden from site)
                </label>
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 bg-white font-semibold cursor-pointer text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-[2] py-3 rounded-xl border-0 text-white font-bold cursor-pointer text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${submitting ? 'bg-amber-300 cursor-not-allowed shadow-none' : 'bg-[#85754E] hover:bg-[#837349] shadow-amber-200'}`}
                >
                  {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : (editingId ? '💾 Save Changes' : '✚ Create Category')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
