import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUpRight,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Tag,
  Calendar,
  User,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Product } from '../types';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  isFav: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenShare: (product: Product) => void;
  onAffiliateClick: (e: React.MouseEvent, product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  isFav,
  onToggleFavorite,
  onOpenShare,
  onAffiliateClick,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reset active image index whenever the opened product changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

  // Keyboard navigation for closing (Esc) and cycling images (Left/Right)
  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, activeImageIndex]);

  if (!product) return null;

  // Build the list of images, falling back to imageUrl
  const allImages: string[] = (
    product.images && product.images.length > 0
      ? product.images
      : [product.imageUrl]
  ).filter(Boolean);

  const totalImages = allImages.length;
  const currentImage = allImages[activeImageIndex] || product.imageUrl;

  const handlePrevImage = () => {
    if (totalImages <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (totalImages <= 1) return;
    setActiveImageIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
  };

  const formattedDate = product.createdAt
    ? new Date(product.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      id="product-detail-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
    >
      <div
        id="product-detail-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-white rounded-3xl w-full max-w-4xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
      >
        {/* Modal Top Header Bar */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6E40]" />
            <span className="text-xs uppercase tracking-widest font-semibold text-neutral-500 dark:text-neutral-400">
              {product.store} Recommendation
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span className="text-xs text-neutral-400">{product.category}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="detail-modal-favorite-btn"
              onClick={() => onToggleFavorite(product.id)}
              title={isFav ? 'Remove from saved' : 'Save to favorites'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                isFav
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
            </button>

            <button
              id="detail-modal-share-btn"
              onClick={() => onOpenShare(product)}
              title="Share affiliate link"
              className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              id="detail-modal-close-btn"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Visual Showcase: Main Large Image & Multi-Image Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-neutral-100 dark:bg-neutral-900/90 rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-200/80 dark:border-neutral-800">
              <img
                src={currentImage}
                alt={`${product.title} - View ${activeImageIndex + 1}`}
                className="w-full h-full object-contain p-4 sm:p-6 transition-all duration-300"
              />

              {/* Prev / Next Arrows for Multi-image */}
              {totalImages > 1 && (
                <>
                  <button
                    id="detail-gallery-prev-btn"
                    onClick={handlePrevImage}
                    title="Previous photo"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    id="detail-gallery-next-btn"
                    onClick={handleNextImage}
                    title="Next photo"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Photo Counter Pill */}
                  <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-mono tracking-wider font-semibold shadow-sm">
                    {activeImageIndex + 1} / {totalImages}
                  </div>
                </>
              )}

              {/* Discount Badge */}
              {product.discountPercent && product.discountPercent > 0 && (
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider shadow-md">
                  {product.discountPercent}% OFF
                </div>
              )}
            </div>

            {/* Thumbnail Navigation Bar for Multi-Images */}
            {totalImages > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                {allImages.map((imgUrl, idx) => (
                  <button
                    key={`${product.id}-thumb-${idx}`}
                    id={`detail-thumb-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative flex-shrink-0 w-16 sm:w-20 aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-neutral-100 dark:bg-neutral-900 ${
                      activeImageIndex === idx
                        ? 'border-[#FF6E40] shadow-md scale-105'
                        : 'border-neutral-200 dark:border-neutral-800 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 font-medium leading-none">
                        Cover
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Information & Editorial Details */}
          <div className="space-y-5">
            {/* Title & Store Partner */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-full bg-[#FF6E40]/10 text-[#FF6E40] text-xs font-semibold">
                  {product.store} Affiliate Pick
                </span>
                <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium">
                  {product.category}
                </span>
              </div>
              <h2 className="font-heading-editorial text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white leading-snug">
                {product.title}
              </h2>
            </div>

            {/* Pricing Section */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-0.5">
                  Current Listed Price
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold font-sans text-neutral-900 dark:text-white">
                    {product.price}
                  </span>
                  {product.originalPrice && product.originalPrice !== product.price && (
                    <span className="text-base text-neutral-400 line-through">
                      {product.originalPrice}
                    </span>
                  )}
                  {product.discountPercent && product.discountPercent > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                      Save {product.discountPercent}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Verified Direct Affiliate Link</span>
              </div>
            </div>

            {/* Curator's Editorial Note */}
            {product.editorialNote && (
              <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  <Sparkles className="w-4 h-4 text-[#FF6E40]" />
                  <span>Curator's Editorial Review</span>
                </div>
                <p className="font-serif-editorial text-neutral-800 dark:text-neutral-200 text-base leading-relaxed whitespace-pre-line">
                  {product.editorialNote}
                </p>
              </div>
            )}

            {/* Product Description */}
            {product.description && product.description !== product.editorialNote && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Product Overview & Details
                </h4>
                <div className="text-sm font-serif-editorial leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line space-y-2">
                  <p>{product.description}</p>
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider font-semibold">Tags & Keywords</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Curator Attribution & Analytics */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Curated by <strong className="text-neutral-700 dark:text-neutral-200">{product.uploaderName || 'Curator'}</strong></span>
                </div>

                {formattedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{formattedDate}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 font-mono text-neutral-600 dark:text-neutral-400">
                <Eye className="w-3.5 h-3.5" />
                <span>{product.clicksCount || 0} reader clicks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom CTA Footer Bar */}
        <div className="p-4 sm:p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#12141a] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left w-full sm:w-auto">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">
              Purchases through this link support the curator at no extra cost.
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="detail-modal-share-cta-btn"
              onClick={() => onOpenShare(product)}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            <a
              id="detail-modal-shop-cta-btn"
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => onAffiliateClick(e, product)}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>Shop on {product.store}</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
