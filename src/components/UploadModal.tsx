import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Link2,
  Sparkles,
  Check,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Star,
  Layers,
} from 'lucide-react';
import { Product, UserProfile, CategoryType, StoreType } from '../types';
import { database as db, parsePriceToNumber } from '../lib/firebase';
import { fetchBackgroundPriceHistory } from '../lib/priceIntelligence';

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
  const [originalPrice, setOriginalPrice] = useState('');
  const [editorialNote, setEditorialNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Multi-Image upload state
  const [images, setImages] = useState<string[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState<number>(0);
  const [imageMode, setImageMode] = useState<'device' | 'url'>('device');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
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

  // Helper to extract price from URL parameters, product titles, or pasted strings
  const extractPriceFromText = (input: string): string | null => {
    if (!input) return null;
    try {
      const decoded = decodeURIComponent(input);
      // Check for Rupee / Rs formats
      const inrMatch = decoded.match(/(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]{2,7})/i);
      if (inrMatch && inrMatch[1]) {
        return `₹${inrMatch[1].trim()}`;
      }
      // Check for Dollar formats
      const usdMatch = decoded.match(/(?:\$|usd)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]{2,7})/i);
      if (usdMatch && usdMatch[1]) {
        return `$${usdMatch[1].trim()}`;
      }
      // Check for Euro / Pound formats
      const eurMatch = decoded.match(/(?:€|£|eur|gbp)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]{2,7})/i);
      if (eurMatch && eurMatch[1]) {
        const symbol = decoded.includes('£') ? '£' : '€';
        return `${symbol}${eurMatch[1].trim()}`;
      }
    } catch {
      // Ignore decoding issues
    }
    return null;
  };

  // Auto-detect store and price from affiliate URL
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

    if (!originalPrice.trim()) {
      const detected = extractPriceFromText(val);
      if (detected) {
        setOriginalPrice(detected);
      }
    }
  };

  // Compress and optimize image to ensure fast cloud sync and lightweight payload
  const compressImage = (img: HTMLImageElement, rawDataUrl: string): string => {
    try {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 720;
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
        return canvas.toDataURL('image/jpeg', 0.75);
      }
    } catch (err) {
      console.warn('Canvas optimization note, using source:', err);
    }
    return rawDataUrl;
  };

  const processFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error(`"${file.name}" is not an image file.`));
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        reject(new Error(`"${file.name}" exceeds 12MB limit.`));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          reject(new Error('File reading resulted in empty data.'));
          return;
        }
        const img = new Image();
        img.onload = () => {
          const optimized = compressImage(img, rawDataUrl);
          resolve(optimized);
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error('Failed to read file from disk.'));
      reader.readAsDataURL(file);
    });
  };

  // Handle multiple files selection from device
  const handleFilesSelect = async (fileList: FileList | File[]) => {
    setError('');
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('Please select valid image files (PNG, JPG, WebP).');
      return;
    }

    if (images.length + files.length > 10) {
      setError('You can add up to 10 images per product.');
    }

    setIsProcessingImages(true);
    try {
      const remainingSlots = Math.max(0, 10 - images.length);
      const toProcess = files.slice(0, remainingSlots > 0 ? remainingSlots : 1);
      const processed = await Promise.all(toProcess.map((f) => processFileToDataUrl(f)));
      setImages((prev) => {
        const next = [...prev, ...processed].slice(0, 10);
        return next;
      });
    } catch (err) {
      console.warn('Image processing notice:', err);
      setError(err instanceof Error ? err.message : 'Error processing selected images.');
    } finally {
      setIsProcessingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle adding image via URL
  const handleAddImageUrl = () => {
    setError('');
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      setError('Please enter a valid image URL.');
      return;
    }
    let url = trimmed;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    if (images.length >= 10) {
      setError('Maximum 10 images allowed per product.');
      return;
    }
    setImages((prev) => [...prev, url]);
    setImageUrlInput('');
  };

  // Make an image the primary cover (move to index 0)
  const handleSetCover = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
    setActivePreviewIdx(0);
  };

  // Remove an image from the list
  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
    if (activePreviewIdx >= index && activePreviewIdx > 0) {
      setActivePreviewIdx((prev) => prev - 1);
    }
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
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

    if (images.length === 0) {
      setError('Please add at least one product photo.');
      return;
    }

    if (!originalPrice.trim()) {
      setError('Please provide the original price.');
      return;
    }

    // Lock synchronous ref immediately to block any rapid clicks or duplicate submissions
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Format affiliate URL safely
      let formattedUrl = affiliateUrl.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const trimmedPrice = originalPrice.trim();
      const numPrice = parsePriceToNumber(trimmedPrice);

      const newProduct: Product = {
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: title.trim(),
        description: editorialNote.trim() || `Curated recommendation by ${user.name || 'Curator'}`,
        editorialNote: editorialNote.trim() || undefined,
        category,
        imageUrl: images[0],
        images: images,
        affiliateUrl: formattedUrl,
        store,
        price: trimmedPrice,
        originalPrice: trimmedPrice,
        currentPrice: numPrice > 0 ? numPrice : undefined,
        mrp: trimmedPrice,
        dealStatus: 'verified',
        lastUpdated: new Date().toISOString(),
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

      // 3. Kick off automatic background price intelligence fetch for this product
      fetchBackgroundPriceHistory(newProduct).catch((fetchErr) => {
        console.warn('Background price history prefetch notice:', fetchErr);
      });

      // 4. Immediately close modal
      onClose();

      // Reset fields
      setTitle('');
      setAffiliateUrl('');
      setOriginalPrice('');
      setEditorialNote('');
      setImages([]);
      setImageUrlInput('');
      setActivePreviewIdx(0);
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

          {/* Product Photography Section - Supports Multiple Images */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Product Photography *
                </label>
                {images.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                    {images.length} / 10 photos
                  </span>
                )}
              </div>

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

            {/* If currently processing compressed images */}
            {isProcessingImages && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                <span>Optimizing and compressing photos for fast loading...</span>
              </div>
            )}

            {/* If no images uploaded yet */}
            {images.length === 0 ? (
              imageMode === 'url' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <input
                        id="product-image-url-input"
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddImageUrl();
                          }
                        }}
                        placeholder="https://images.unsplash.com/... or merchant photo URL"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-[#FF6E40] dark:focus:border-[#FF6E40] transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold cursor-pointer shadow transition-all"
                    >
                      Add Photo
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Paste image address from Amazon, Flipkart, or your cloud storage.
                  </p>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#FF6E40] bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-900/40'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    Select photos from your device (multi-select enabled)
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Upload multiple angles, packaging, or product details (up to 10 photos)
                  </p>
                </div>
              )
            ) : (
              /* When 1 or more images are added */
              <div className="space-y-3">
                {/* Active Photo Large Preview Box */}
                <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 h-56 sm:h-64 flex items-center justify-center group">
                  <img
                    src={images[activePreviewIdx] || images[0]}
                    alt={`Preview photo ${activePreviewIdx + 1}`}
                    className="max-h-full max-w-full object-contain p-4 transition-all"
                  />

                  {/* Primary Cover Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    {activePreviewIdx === 0 ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6E40] text-white text-[11px] font-bold shadow-md">
                        <Star className="w-3 h-3 fill-white" />
                        <span>Primary Cover Photo</span>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium shadow-sm">
                        Photo {activePreviewIdx + 1} of {images.length}
                      </div>
                    )}
                  </div>

                  {/* Action overlay buttons */}
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                    {activePreviewIdx !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(activePreviewIdx)}
                        title="Set this photo as primary cover"
                        className="px-2.5 py-1.5 rounded-lg bg-white/95 dark:bg-neutral-800/95 hover:bg-white text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer border border-neutral-200 dark:border-neutral-700"
                      >
                        <Star className="w-3 h-3 text-[#FF6E40]" />
                        <span>Make Cover</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(activePreviewIdx)}
                      title="Delete this photo"
                      className="p-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Multiple Images Thumbnail Strip with "Add More" Button */}
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                  {images.map((imgUrl, idx) => (
                    <div
                      key={`thumb-${idx}`}
                      className={`relative group flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all bg-neutral-100 dark:bg-neutral-900 ${
                        activePreviewIdx === idx
                          ? 'border-[#FF6E40] shadow-md ring-1 ring-[#FF6E40]'
                          : 'border-neutral-200 dark:border-neutral-800 opacity-75 hover:opacity-100'
                      }`}
                      onClick={() => setActivePreviewIdx(idx)}
                    >
                      <img
                        src={imgUrl}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-[#FF6E40] text-[9px] text-white text-center font-bold py-0.5 leading-none">
                          Cover
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        title="Remove photo"
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add More Photos Tile if under limit */}
                  {images.length < 10 && (
                    <button
                      type="button"
                      id="upload-add-more-photos-btn"
                      onClick={() => {
                        if (imageMode === 'url') {
                          // keep focus on url field
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                      className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-[#FF6E40] dark:hover:border-[#FF6E40] text-neutral-500 hover:text-[#FF6E40] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer bg-neutral-50/50 dark:bg-neutral-900/40"
                      title="Add more photos"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-medium">Add (+)</span>
                    </button>
                  )}
                </div>

                {/* Additional URL image appender for quick web photo adding */}
                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                    placeholder="Or paste another image URL to add..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs focus:outline-none focus:border-[#FF6E40]"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    + Add URL
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Device</span>
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              id="product-file-upload-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesSelect(e.target.files);
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
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                if (!originalPrice.trim()) {
                  const detected = extractPriceFromText(val);
                  if (detected) {
                    setOriginalPrice(detected);
                  }
                }
              }}
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

          {/* Category & Pricing: single Original Price section to be filled */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Original Price *
                </label>
                <span className="text-[11px] text-neutral-400">Auto-detected or enter manually</span>
              </div>
              <input
                id="product-orig-price-input"
                type="text"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="₹2,499 or $99"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/60 text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                required
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
