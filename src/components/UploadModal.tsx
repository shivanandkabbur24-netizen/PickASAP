import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Link2, Sparkles, Check, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { Product, UserProfile, CategoryType, StoreType } from '../types';
import { database as db } from '../lib/firebase';

interface UploadModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: Product) => void;
}

const CATEGORIES: CategoryType[] = [
  'Tech & Audio',
  'Fashion & Apparel',
  'Home & Design',
  'Beauty & Grooming',
  'Books & Stationery',
  'Everyday Carry',
];

const STORES: StoreType[] = ['Amazon', 'Flipkart', 'Myntra', 'Other'];

export const UploadModal: React.FC<UploadModalProps> = ({
  user,
  isOpen,
  onClose,
  onProductCreated,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const [title, setTitle] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [store, setStore] = useState<StoreType>('Amazon');
  const [category, setCategory] = useState<CategoryType>('Tech & Audio');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [editorialNote, setEditorialNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Image upload state
  const [imageMode, setImageMode] = useState<'device' | 'url'>('device');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      isSubmittingRef.current = false;
      setSubmitting(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-detect store from affiliate URL
  const handleUrlChange = (val: string) => {
    setAffiliateUrl(val);
    const lower = val.toLowerCase();
    if (lower.includes('amazon') || lower.includes('amzn')) {
      setStore('Amazon');
    } else if (lower.includes('flipkart') || lower.includes('fkrt')) {
      setStore('Flipkart');
    } else if (lower.includes('myntra')) {
      setStore('Myntra');
    }
  };

  // Compress and optimize image to ensure fast cloud sync and no payload errors
  const compressImage = (img: HTMLImageElement, rawDataUrl: string): string => {
    try {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 640;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        // Fast, compact JPEG under 50KB for instant storage
        return canvas.toDataURL('image/jpeg', 0.70);
      }
    } catch (err) {
      console.warn('Canvas optimization note, using source:', err);
    }
    return rawDataUrl;
  };

  // Handle file input from device
  const handleFileSelect = (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file exceeds 10MB limit. Please choose a smaller photo.');
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const optimized = compressImage(img, rawDataUrl);
        setImageDataUrl(optimized);
      };
      img.onerror = () => {
        setImageDataUrl(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read image file from your device.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || submitting) {
      return;
    }

    setError('');

    if (!title.trim()) {
      setError('Please provide a product title.');
      return;
    }
    if (!affiliateUrl.trim()) {
      setError('Please provide your affiliate link.');
      return;
    }

    // Determine final image URL
    const activeImage = imageMode === 'url' ? imageUrlInput.trim() : imageDataUrl;
    if (!activeImage) {
      setError(
        imageMode === 'url'
          ? 'Please enter an image URL or switch to uploading a photo from your device.'
          : 'Please select a product photo from your device or paste an image URL.'
      );
      return;
    }

    if (!price.trim()) {
      setError('Please state the product price.');
      return;
    }

    // Lock synchronous ref immediately to block any rapid clicks or duplicate submissions
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Calculate discount percentage if original price exists
      let discount: number | undefined = undefined;
      const numPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
      const numOrig = parseFloat(originalPrice.replace(/[^0-9.]/g, ''));
      if (numPrice && numOrig && numOrig > numPrice) {
        discount = Math.round(((numOrig - numPrice) / numOrig) * 100);
      }

      // Format affiliate URL safely
      let formattedUrl = affiliateUrl.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const newProduct: Product = {
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: title.trim(),
        description: editorialNote.trim() || `Curated recommendation by ${user.name || 'Curator'}`,
        editorialNote: editorialNote.trim() || undefined,
        category,
        imageUrl: activeImage,
        affiliateUrl: formattedUrl,
        store,
        price: price.trim(),
        originalPrice: originalPrice.trim() || undefined,
        discountPercent: discount,
        tags: tags.length > 0 ? tags : [category.toLowerCase(), store.toLowerCase()],
        uploaderId: user.id || 'usr_' + Date.now(),
        uploaderName: user.name || 'Curator',
        createdAt: new Date().toISOString(),
        clicksCount: 0,
      };

      // 1. Immediately notify parent component for 0ms UI update
      onProductCreated(newProduct);

      // 2. Persist to storage & cloud
      await db.addProduct(newProduct);

      // 3. Immediately close modal
      onClose();

      // Reset fields
      setTitle('');
      setAffiliateUrl('');
      setPrice('');
      setOriginalPrice('');
      setEditorialNote('');
      setImageDataUrl('');
      setImageUrlInput('');
      setImageFileName('');
      setTagsInput('');
    } catch (err: unknown) {
      console.error('Upload product caught error:', err);
      setError(err instanceof Error ? err.message : 'Upload was interrupted. Please try again.');
      isSubmittingRef.current = false;
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 rounded-3xl w-full max-w-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 dark:text-neutral-400 block">
              Curator Studio
            </span>
            <h2 className="text-xl sm:text-2xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              Upload Affiliate Product
            </h2>
          </div>
          <button
            id="close-upload-modal-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Photography Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Product Photography *
              </label>
              <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs">
                <button
                  type="button"
                  onClick={() => setImageMode('device')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                    imageMode === 'device'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  From Device
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                    imageMode === 'url'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {imageMode === 'url' ? (
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="product-image-url-input"
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/... or merchant photo URL"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                  />
                </div>
                {imageUrlInput && (
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 h-48 flex items-center justify-center p-2">
                    <img
                      src={imageUrlInput}
                      alt="URL preview"
                      className="max-h-full max-w-full object-contain rounded-xl"
                      onError={() => setError('Image URL could not be loaded. Please verify the link.')}
                    />
                  </div>
                )}
              </div>
            ) : imageDataUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 group">
                <img
                  src={imageDataUrl}
                  alt="Uploaded product preview"
                  className="w-full h-56 object-contain p-4"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium cursor-pointer shadow hover:bg-neutral-100"
                  >
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl('');
                      setImageFileName('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium cursor-pointer shadow hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-500 truncate flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{imageFileName || 'Photo processed & ready for magazine feature'}</span>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-900/40'
                }`}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  Click to select photo or drag & drop
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  PNG, JPG, or WebP (auto-optimized for instant mobile loading)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              id="product-file-upload-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Product Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
              Product Title *
            </label>
            <input
              id="product-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sony WH-1000XM5 Wireless Headphones"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
              required
            />
          </div>

          {/* Affiliate URL & Store Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                Your Affiliate Link *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Link2 className="w-4 h-4" />
                </div>
                <input
                  id="product-affiliate-url-input"
                  type="url"
                  value={affiliateUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://amzn.to/... or https://fkrt.it/..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                Store Partner
              </label>
              <select
                id="product-store-select"
                value={store}
                onChange={(e) => setStore(e.target.value as StoreType)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors cursor-pointer"
              >
                {STORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                Magazine Category
              </label>
              <select
                id="product-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                Deal / Offer Price *
              </label>
              <input
                id="product-price-input"
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="₹2,499 or $99"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                Original Price (opt)
              </label>
              <input
                id="product-orig-price-input"
                type="text"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="₹3,999 or $149"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Editorial Note / Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Editorial Review / Why You Recommend It
              </label>
              <span className="text-[11px] text-neutral-400">Magazine feature text</span>
            </div>
            <textarea
              id="product-editorial-note-input"
              rows={3}
              value={editorialNote}
              onChange={(e) => setEditorialNote(e.target.value)}
              placeholder="e.g. An exceptional minimalist daily audio companion featuring class-leading active noise cancellation, luxurious lambskin memory pads, and seamless multi-device Bluetooth handoff."
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
              Tags (comma separated)
            </label>
            <input
              id="product-tags-input"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="audio, premium, wireless, deal of the day"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
            />
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="publish-product-btn"
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 dark:text-amber-600" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-600" />
            )}
            <span>{submitting ? 'Publishing...' : 'Publish Across Platform'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
