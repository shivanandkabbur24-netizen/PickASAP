import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Tag,
  ExternalLink,
  ShieldCheck,
  Clock,
  Flame,
  Percent,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  Layers,
  ArrowDownRight,
  Info,
  Edit3,
} from 'lucide-react';
import { Product, PriceSnapshot, UserProfile } from '../types';
import { PriceHistoryChart } from './PriceHistoryChart';
import { PriceUpdateModal } from './PriceUpdateModal';
import { RealTimePriceComparison } from './RealTimePriceComparison';
import { database as db, formatPriceDisplay, parsePriceToNumber } from '../lib/firebase';

interface ProductDetailPageProps {
  product: Product;
  onBack: () => void;
  isFav: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenShare: (product: Product) => void;
  onAffiliateClick: (e: React.MouseEvent, product: Product) => void;
  isAdmin?: boolean;
  currentUser?: UserProfile | null;
  onOpenPriceUpdate?: (product: Product) => void;
  allProducts?: Product[];
  onSelectRelatedProduct?: (product: Product) => void;
  onSelectPartner?: (partner: { id: string; name: string }) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  onBack,
  isFav,
  onToggleFavorite,
  onOpenShare,
  onAffiliateClick,
  isAdmin = false,
  currentUser = null,
  onOpenPriceUpdate,
  allProducts = [],
  onSelectRelatedProduct,
  onSelectPartner,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveImageIndex(0);
  }, [product.id]);

  // Subscribe to price history for this product to evaluate "Is it a good price to buy?"
  useEffect(() => {
    setLoadingHistory(true);
    const unsubscribe = db.subscribeToPriceHistory(product.id, (history) => {
      setSnapshots(history);
      setLoadingHistory(false);
    });

    const handleSnapshotAdded = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; snapshots: PriceSnapshot[] }>;
      if (customEvent.detail && customEvent.detail.productId === product.id) {
        setSnapshots(customEvent.detail.snapshots);
      }
    };
    window.addEventListener('pickasap:price_snapshot_added', handleSnapshotAdded);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('pickasap:price_snapshot_added', handleSnapshotAdded);
    };
  }, [product.id]);

  // Handle image carousel
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalImages]);

  // Numeric Price and Price History Analysis
  const numericCurrentPrice = useMemo(() => {
    return product.currentPrice || parsePriceToNumber(product.price);
  }, [product.currentPrice, product.price]);

  const numericMrp = useMemo(() => {
    if (product.mrp) return parsePriceToNumber(product.mrp);
    if (product.originalPrice) return parsePriceToNumber(product.originalPrice);
    return 0;
  }, [product.mrp, product.originalPrice]);

  const discountPercent = useMemo(() => {
    if (product.discount !== undefined) return product.discount;
    if (product.discountPercent !== undefined) return product.discountPercent;
    if (numericMrp > numericCurrentPrice && numericMrp > 0) {
      return Math.round(((numericMrp - numericCurrentPrice) / numericMrp) * 100);
    }
    return 0;
  }, [product.discount, product.discountPercent, numericMrp, numericCurrentPrice]);

  const savingsAmount = useMemo(() => {
    if (numericMrp > numericCurrentPrice && numericMrp > 0) {
      return numericMrp - numericCurrentPrice;
    }
    return 0;
  }, [numericMrp, numericCurrentPrice]);

  // Compute stats for "Is it a good price to buy?" verdict
  const priceStats = useMemo(() => {
    if (snapshots.length === 0) {
      return {
        lowest: numericCurrentPrice,
        highest: numericMrp > numericCurrentPrice ? numericMrp : numericCurrentPrice,
        average: numericCurrentPrice,
        dataPointsCount: 0,
      };
    }
    const prices = snapshots.map((s) => s.price);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const average = Math.round(sum / prices.length);
    return {
      lowest,
      highest,
      average,
      dataPointsCount: snapshots.length,
    };
  }, [snapshots, numericCurrentPrice, numericMrp]);

  // Evaluation of "Is it a good price to buy?"
  const priceVerdict = useMemo(() => {
    const { lowest, highest, average } = priceStats;
    const current = numericCurrentPrice;

    // Check if within 5% of lowest price ever recorded
    const isAtLowest = current <= lowest * 1.05;
    // Check if below average
    const isBelowAverage = current < average;
    // Discount percentage
    const hasGreatDiscount = discountPercent >= 25;

    if (isAtLowest || (hasGreatDiscount && isBelowAverage)) {
      return {
        rating: 'excellent',
        badge: '🔥 Great Time to Buy',
        badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        title: 'Yes, this is an excellent price to buy!',
        summary: `Currently priced at ${formatPriceDisplay(current)}, which is near its all-time lowest recorded price (${formatPriceDisplay(lowest)}).`,
        tips: [
          `Priced within 5% of the historic all-time low (${formatPriceDisplay(lowest)})`,
          discountPercent > 0 ? `Savings of ${discountPercent}% off MRP (${formatPriceDisplay(savingsAmount)} saved)` : 'Special verified publisher deal price',
          'High probability of price rebound once promotional quotas expire',
        ],
        gaugePercent: Math.max(5, Math.min(95, highest > lowest ? ((current - lowest) / (highest - lowest)) * 100 : 15)),
        gaugeLabel: 'Near All-Time Low',
      };
    } else if (isBelowAverage) {
      return {
        rating: 'good',
        badge: '✓ Good Price to Buy',
        badgeBg: 'bg-sky-500/10 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800',
        title: 'Yes, this is a good value purchase',
        summary: `Currently priced below the historic average of ${formatPriceDisplay(average)}. You are getting verified discount value.`,
        tips: [
          `Save ${formatPriceDisplay(average - current)} compared to the average price`,
          discountPercent > 0 ? `${discountPercent}% off original retail price` : 'Reliable verified seller listing',
          'Solid buying opportunity for immediate needs',
        ],
        gaugePercent: Math.max(10, Math.min(90, highest > lowest ? ((current - lowest) / (highest - lowest)) * 100 : 45)),
        gaugeLabel: 'Below Historical Average',
      };
    } else {
      return {
        rating: 'fair',
        badge: '⚖️ Fair Price',
        badgeBg: 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        title: 'Fair price, but watch for flash drops',
        summary: `Priced around regular retail levels. If you do not need it immediately, tracking this product could reveal future discounts.`,
        tips: [
          `Lowest price recorded was ${formatPriceDisplay(lowest)}`,
          `Current price is closer to typical non-sale benchmarks (${formatPriceDisplay(average)})`,
          'Bookmark or favorite this item to monitor upcoming price drops',
        ],
        gaugePercent: Math.max(20, Math.min(95, highest > lowest ? ((current - lowest) / (highest - lowest)) * 100 : 75)),
        gaugeLabel: 'Around Average Price',
      };
    }
  }, [priceStats, numericCurrentPrice, discountPercent, savingsAmount]);

  const copyToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(product.affiliateUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isVerified = product.dealStatus === 'verified' || !product.dealStatus;
  const isPending = product.dealStatus === 'pending';

  // Related products from the same category or store
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => p.id !== product.id && (p.category === product.category || p.store === product.store))
      .slice(0, 3);
  }, [allProducts, product.id, product.category, product.store]);

  return (
    <div className="w-full min-h-screen bg-neutral-50/50 dark:bg-[#0b0c0e] text-neutral-900 dark:text-neutral-100 animate-fade-in pb-24">
      {/* Top Breadcrumbs & Action Bar */}
      <nav className="sticky top-0 z-30 bg-white/95 dark:bg-[#0d0e12]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Back Button */}
          <button
            id="back-to-magazine-btn"
            onClick={onBack}
            className="group flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Curated Magazine</span>
          </button>

          {/* Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400">
            <span>Catalog</span>
            <span>/</span>
            <span className="text-neutral-600 dark:text-neutral-300">{product.category}</span>
            <span>/</span>
            <span className="text-neutral-600 dark:text-neutral-300">{product.store}</span>
            <span>/</span>
            <span className="text-neutral-900 dark:text-white font-medium truncate max-w-[240px]">
              {product.title}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              id="page-favorite-btn"
              onClick={() => onToggleFavorite(product.id)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isFav
                  ? 'border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400'
                  : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
              title={isFav ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>

            <button
              id="page-share-btn"
              onClick={() => onOpenShare(product)}
              className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Share this recommendation"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-12">
        {/* Top Two-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* LEFT COLUMN: Product Images & Title */}
          <div className="lg:col-span-7 space-y-6">
            {/* Multi-Image Gallery Showcase (Placed Above Title) */}
            <div className="space-y-3.5">
              {/* Main Active Image Display - slightly reduced carefully */}
              <div className="relative aspect-[4/3] sm:aspect-[16/11] max-h-[420px] w-full rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-2xs flex items-center justify-center group/hero">
                <img
                  src={currentImage}
                  alt={product.title}
                  className="w-full h-full max-h-[385px] object-contain p-4 group-hover/hero:scale-102 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />

                {/* Left/Right Carousel Controls */}
                {totalImages > 1 && (
                  <>
                    <button
                      id="hero-img-prev-btn"
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 text-neutral-800 dark:text-white flex items-center justify-center shadow-lg backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/60 transition-all cursor-pointer opacity-80 group-hover/hero:opacity-100 active:scale-95"
                      title="Previous photo"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      id="hero-img-next-btn"
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 text-neutral-800 dark:text-white flex items-center justify-center shadow-lg backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/60 transition-all cursor-pointer opacity-80 group-hover/hero:opacity-100 active:scale-95"
                      title="Next photo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Photos Counter Badge */}
                {totalImages > 1 && (
                  <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-xs font-semibold shadow-md">
                    <Layers className="w-3.5 h-3.5 text-[#FF6E40]" />
                    <span>
                      Photo {activeImageIndex + 1} of {totalImages}
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {totalImages > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      id={`thumbnail-select-${idx}`}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative flex-shrink-0 w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 bg-white dark:bg-neutral-900 transition-all cursor-pointer ${
                        activeImageIndex === idx
                          ? 'border-[#FF6E40] shadow-sm scale-102 ring-2 ring-[#FF6E40]/20'
                          : 'border-neutral-200 dark:border-neutral-800 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.title} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Store & Category Badges */}
            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6E40]" />
                {product.store} Curated
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {product.category}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Verified Deal
                </span>
              ) : isPending ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Review Pending
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  Deal Expired
                </span>
              )}
            </div>

            {/* Product Title (Editorial Headline) */}
            <h1 className="font-heading-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-white leading-[1.25] tracking-tight">
              {product.title}
            </h1>

            {/* Description & Curated Insights */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 shadow-2xs space-y-4">
              <h3 className="font-heading-editorial text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6E40]" />
                Editorial Overview & Specifications
              </h3>
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {product.description ||
                  `A verified high-quality selection handpicked from ${product.store}. Evaluated for pricing value, user satisfaction, and direct purchase assurance.`}
              </p>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  {product.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Product Price & "Is it a good price to buy?" Advisory */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Price & Offer Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 shadow-md space-y-6">
              {/* Header: Verified Status & Last checked */}
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-neutral-400">
                  Verified Offer on {product.store}
                </span>
                {product.lastUpdated && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    Updated {new Date(product.lastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Big Price Display */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white font-mono tracking-tight">
                    {formatPriceDisplay(numericCurrentPrice)}
                  </span>
                  {numericMrp > numericCurrentPrice && (
                    <span className="text-lg sm:text-xl text-neutral-400 line-through font-mono">
                      {formatPriceDisplay(numericMrp)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold tracking-wide">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>

                {savingsAmount > 0 && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    You save {formatPriceDisplay(savingsAmount)} off original MRP
                  </p>
                )}

                {/* Affiliate partner uploader credit */}
                <div className="pt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>Affiliate link uploaded by:</span>
                  <button
                    type="button"
                    id="product-detail-partner-btn"
                    onClick={() => {
                      onSelectPartner?.({
                        id: product.uploaderId || '',
                        name: product.uploaderName || 'Affiliate Partner',
                      });
                    }}
                    className="font-bold text-neutral-800 dark:text-neutral-200 hover:text-[#FF6E40] dark:hover:text-[#FF6E40] underline underline-offset-2 transition-colors cursor-pointer"
                    title={`View all links uploaded by ${product.uploaderName || 'Affiliate Partner'}`}
                  >
                    {product.uploaderName || 'Affiliate Partner'}
                  </button>
                </div>

                {product.offerDescription && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
                    <Tag className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{product.offerDescription}</span>
                  </div>
                )}
              </div>

              {/* PRIMARY CALL TO ACTION: Buy Now on Store */}
              <div className="space-y-3 pt-2">
                <a
                  id="primary-buy-now-btn"
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => onAffiliateClick(e, product)}
                  className="w-full py-4 px-6 rounded-2xl bg-[#FF6E40] hover:bg-[#e05b30] active:scale-98 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-[#FF6E40]/25 transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Buy Now on {product.store}</span>
                  <ExternalLink className="w-4 h-4 ml-0.5" />
                </a>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    id="copy-product-link-btn"
                    onClick={copyToClipboard}
                    className="py-2.5 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    id="share-product-link-btn"
                    onClick={() => onOpenShare(product)}
                    className="py-2.5 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share Deal</span>
                  </button>
                </div>

                {/* Community Update Price Button */}
                <button
                  id="page-update-price-btn"
                  onClick={() => setIsPriceModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#FF6E40]" />
                  <span>Found a Different Price? Update Price</span>
                </button>
              </div>

              {/* Affiliate Disclosure Guarantee */}
              <div className="pt-2 text-[11px] text-neutral-400 dark:text-neutral-500 text-center leading-relaxed">
                Direct merchant checkout on {product.store}. Standard store return & warranty policies apply.
              </div>
            </div>

            {/* "IS IT A GOOD PRICE TO BUY?" ADVISORY CARD */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 shadow-md space-y-5">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${priceVerdict.badgeBg}`}
                >
                  {priceVerdict.badge}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {priceStats.dataPointsCount} price logs analyzed
                </span>
              </div>

              {/* Title & Explanation */}
              <div>
                <h3 className="font-heading-editorial text-lg font-bold text-neutral-900 dark:text-white">
                  {priceVerdict.title}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1.5 leading-relaxed">
                  {priceVerdict.summary}
                </p>
              </div>

              {/* Price Position Meter / Gauge */}
              <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  <span>Lowest: {formatPriceDisplay(priceStats.lowest)}</span>
                  <span className="text-[#FF6E40] font-bold">{priceVerdict.gaugeLabel}</span>
                  <span>Highest: {formatPriceDisplay(priceStats.highest)}</span>
                </div>
                {/* Visual Bar */}
                <div className="relative h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 rounded-full"
                    style={{ width: `${priceVerdict.gaugePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span>Best Deal</span>
                  <span>Average ({formatPriceDisplay(priceStats.average)})</span>
                  <span>High Price</span>
                </div>
              </div>

              {/* Quick Decision Checklist */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Why this recommendation:
                </span>
                <ul className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {priceVerdict.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Jump to Live Comparison Link */}
              <a
                href="#live-price-comparison-section"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-2 cursor-pointer"
              >
                <span>⚡ Live Multi-Retailer Price Comparison</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Jump to Chart Link */}
              <a
                href="#price-history-section"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6E40] hover:underline pt-1 cursor-pointer"
              >
                <span>View complete interactive price history chart below</span>
                <TrendingDown className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* SECTION: Real-Time Multi-Retailer Price Comparison (Gemini Background Intelligence) */}
        <RealTimePriceComparison
          product={product}
          onAffiliateClick={(e, prod, customUrl, retailerName) => {
            if (customUrl) {
              onAffiliateClick(e, {
                ...prod,
                store: retailerName || prod.store,
                affiliateUrl: customUrl,
              });
            } else {
              onAffiliateClick(e, prod);
            }
          }}
        />

        {/* SCROLL-DOWN SECTION: Price History Chart */}
        <section
          id="price-history-section"
          className="pt-8 border-t border-neutral-200/80 dark:border-neutral-800/80 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6E40] uppercase tracking-wider">
                <TrendingDown className="w-4 h-4" />
                <span>Price Intelligence & Audit Logs</span>
              </div>
              <h2 className="font-heading-editorial text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white mt-1">
                Price History & Drop Trends
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Real verified price points recorded over time. Compare historical prices to make informed shopping decisions.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
              <button
                id="chart-community-update-btn"
                onClick={() => setIsPriceModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#e05b30] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Price</span>
              </button>
            </div>
          </div>

          {/* Render Responsive Price History Chart */}
          <div className="rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 p-6 sm:p-8 shadow-sm">
            <PriceHistoryChart
              productId={product.id}
              product={product}
              currentPrice={numericCurrentPrice}
              isAdmin={isAdmin}
              onAdminUpdateClick={onOpenPriceUpdate ? () => onOpenPriceUpdate(product) : undefined}
            />
          </div>
        </section>

        {/* Related Curated Finds */}
        {relatedProducts.length > 0 && (
          <section className="pt-8 border-t border-neutral-200/80 dark:border-neutral-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading-editorial text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                  More Curated Finds from {product.store} & {product.category}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Handpicked alternatives with active verified discounts
                </p>
              </div>
              <button
                onClick={onBack}
                className="text-xs font-semibold text-[#FF6E40] hover:underline cursor-pointer"
              >
                Browse All Deals →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((relProduct) => (
                <div
                  key={relProduct.id}
                  onClick={() => {
                    if (onSelectRelatedProduct) {
                      onSelectRelatedProduct(relProduct);
                    }
                  }}
                  className="group p-4 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="aspect-[4/3] rounded-2xl bg-neutral-100 dark:bg-neutral-900 overflow-hidden mb-3 relative">
                    <img
                      src={relProduct.imageUrl}
                      alt={relProduct.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm text-neutral-800 dark:text-neutral-200">
                      {relProduct.store}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-neutral-400">{relProduct.category}</span>
                    <h4 className="font-serif-editorial font-bold text-sm text-neutral-900 dark:text-white truncate">
                      {relProduct.title}
                    </h4>
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="font-mono font-bold text-sm text-neutral-900 dark:text-white">
                        {formatPriceDisplay(relProduct.price)}
                      </span>
                      {relProduct.mrp && relProduct.mrp !== relProduct.price && (
                        <span className="text-xs text-neutral-400 line-through font-mono">
                          {formatPriceDisplay(relProduct.mrp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Community Price Update Modal */}
      <PriceUpdateModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        product={product}
        currentUser={currentUser || db.getCurrentUser()}
      />
    </div>
  );
};
