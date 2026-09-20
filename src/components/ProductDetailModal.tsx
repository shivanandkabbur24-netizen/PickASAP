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
  ShieldCheck,
  Clock,
  Flame,
  Percent,
  Edit3,
} from 'lucide-react';
import { Product } from '../types';
import { PriceHistoryChart } from './PriceHistoryChart';
import { formatPriceDisplay } from '../lib/firebase';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  isFav: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenShare: (product: Product) => void;
  onAffiliateClick: (e: React.MouseEvent, product: Product) => void;
  isAdmin?: boolean;
  onOpenPriceUpdate?: (product: Product) => void;
  onSelectPartner?: (partner: { id: string; name: string }) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  isFav,
  onToggleFavorite,
  onOpenShare,
  onAffiliateClick,
  isAdmin = false,
  onOpenPriceUpdate,
  onSelectPartner,
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
    ? new Date(product.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const lastCheckedDate = product.lastUpdated
    ? new Date(product.lastUpdated).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : formattedDate;

  const isVerified = product.dealStatus === 'verified' || !product.dealStatus;
  const isPending = product.dealStatus === 'pending';
  const isExpired = product.dealStatus === 'expired';

  const displayOriginalPrice = product.mrp || product.originalPrice;
  const displayDiscount = product.discount ?? product.discountPercent;

  return (
    <div
      id="product-detail-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in"
    >
      <div
        id="product-detail-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#111113] text-neutral-900 dark:text-white rounded-2xl sm:rounded-3xl w-full max-w-5xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scale-in transition-all"
      >
        {/* Modal Top Header Bar */}
        <div className="px-5 sm:px-7 py-3.5 sm:py-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#FF6E40]" />
            <span className="text-xs uppercase tracking-widest font-bold text-neutral-800 dark:text-neutral-200">
              {product.store} Deal
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {product.category}
            </span>

            {/* Verification status pill */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ml-1 ${
                isVerified
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/60'
                  : isPending
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/60'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {isVerified ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified Deal</span>
                </>
              ) : isPending ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Pending Review</span>
                </>
              ) : (
                <span>Deal Expired</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Admin quick price update action */}
            {isAdmin && onOpenPriceUpdate && (
              <button
                id="admin-detail-update-btn"
                onClick={() => onOpenPriceUpdate(product)}
                title="Admin: Update Price & Offer"
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-[#FF6E40] hover:text-white dark:hover:bg-[#FF6E40] text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin: Update Price</span>
              </button>
            )}

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
              title="Share deal"
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

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-7 space-y-7">
          {/* Top Section: Pinterest-inspired 2-Column Desktop / Responsive Stacked Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column: Large Product Image & Multi-Image Thumbnails (lg:col-span-6) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="relative aspect-[4/3] sm:aspect-square bg-neutral-50 dark:bg-neutral-900/90 rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
                <img
                  src={currentImage}
                  alt={`${product.title} - View ${activeImageIndex + 1}`}
                  className="w-full h-full object-contain p-4 sm:p-6 transition-all duration-300"
                />

                {/* Prev / Next Arrows for Gallery */}
                {totalImages > 1 && (
                  <>
                    <button
                      id="detail-gallery-prev-btn"
                      onClick={handlePrevImage}
                      title="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      id="detail-gallery-next-btn"
                      onClick={handleNextImage}
                      title="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Photo Counter Pill */}
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-mono tracking-wider font-semibold shadow-xs">
                      {activeImageIndex + 1} / {totalImages}
                    </div>
                  </>
                )}

                {/* Discount Badge */}
                {displayDiscount && displayDiscount > 0 && (
                  <div className="absolute top-3.5 left-3.5 z-10 px-2.5 py-1 rounded-lg bg-[#FF6E40] text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{displayDiscount}% OFF</span>
                  </div>
                )}
              </div>

              {/* Multi-Image Thumbnail Strip */}
              {totalImages > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {allImages.map((imgUrl, idx) => (
                    <button
                      key={`${product.id}-thumb-${idx}`}
                      id={`detail-thumb-${idx}`}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative flex-shrink-0 w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-neutral-100 dark:bg-neutral-900 ${
                        activeImageIndex === idx
                          ? 'border-[#FF6E40] shadow-md scale-102'
                          : 'border-neutral-200 dark:border-neutral-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Title, Marketplace, Current Price, Discount, Deal Details, CTA (lg:col-span-6) */}
            <div className="lg:col-span-6 space-y-4">
              {/* Product Title */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Marketplace: <strong className="text-[#FF6E40]">{product.store}</strong>
                  </span>
                  <span>•</span>
                  <span>Category: {product.category}</span>
                </div>
                <h1 className="font-heading-editorial text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white leading-tight">
                  {product.title}
                </h1>
              </div>

              {/* Prominent Price Display Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-[#18181b] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                    Verified Current Price
                  </span>
                  {lastCheckedDate && (
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Checked {lastCheckedDate}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-extrabold font-sans text-neutral-900 dark:text-white tracking-tight">
                    {product.price}
                  </span>
                  {displayOriginalPrice && displayOriginalPrice !== product.price && (
                    <span className="text-lg text-neutral-400 line-through font-sans">
                      {displayOriginalPrice}
                    </span>
                  )}
                  {displayDiscount && displayDiscount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      Save {displayDiscount}%
                    </span>
                  )}
                </div>

                {/* Offer Details / Special Terms */}
                {product.offerDescription && (
                  <div className="mt-2.5 pt-2.5 border-t border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                    <Tag className="w-3.5 h-3.5 text-[#FF6E40] shrink-0 mt-0.5" />
                    <span>
                      <strong>Deal Offer:</strong> {product.offerDescription}
                    </span>
                  </div>
                )}

                {/* Offer Expiry if specified */}
                {product.offerExpiry && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>Offer valid until: {new Date(product.offerExpiry).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Prominent "Buy Now" CTA Button with preserved Affiliate referral link */}
              <div className="space-y-2">
                <a
                  id="detail-modal-buy-now-btn"
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => onAffiliateClick(e, product)}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#FF6E40] hover:bg-[#E65A2E] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-[0.99] cursor-pointer"
                >
                  <span>Buy Now on {product.store}</span>
                  <ArrowUpRight className="w-5 h-5" />
                </a>

                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Official affiliate link preserved
                  </span>
                  <span>{product.clicksCount || 0} shopper visits</span>
                </div>
              </div>

              {/* Editorial / Curator's Note */}
              {product.editorialNote && (
                <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF6E40]" />
                    <span>Curator Note</span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                    {product.editorialNote}
                  </p>
                </div>
              )}

              {/* Product Specifications & Overview */}
              {product.description && product.description !== product.editorialNote && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Product Description
                  </h4>
                  <p className="text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Dedicated Price-History Chart & Price Summary */}
          <div className="pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
            <PriceHistoryChart
              productId={product.id}
              product={product}
              currentPrice={product.currentPrice}
              isAdmin={isAdmin}
              onAdminUpdateClick={onOpenPriceUpdate ? () => onOpenPriceUpdate(product) : undefined}
            />
          </div>

          {/* Tags & Keyword Pills */}
          {product.tags && product.tags.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <span className="font-semibold uppercase text-[10px] tracking-wider mr-1">Tags:</span>
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Curator attribution footer */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-400">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>
                Curated by{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectPartner?.({
                      id: product.uploaderId || '',
                      name: product.uploaderName || 'Affiliate Partner',
                    });
                  }}
                  className="font-bold text-neutral-700 dark:text-neutral-300 hover:text-[#FF6E40] dark:hover:text-[#FF6E40] underline underline-offset-2 transition-colors cursor-pointer"
                  title={`View ${product.uploaderName || 'Affiliate Partner'}'s profile`}
                >
                  {product.uploaderName || 'Curator'}
                </button>
              </span>
            </div>
            {formattedDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Listed {formattedDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
