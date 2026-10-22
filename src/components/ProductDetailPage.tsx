/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  Scale,
  Award,
  Zap,
} from 'lucide-react';
import { Product, PriceSnapshot, UserProfile } from '../types';
import { PriceUpdateModal } from './PriceUpdateModal';
import { database as db, formatPriceDisplay, parsePriceToNumber } from '../lib/firebase';
import {
  getMarketplacePriceComparison,
  extractExactVariant,
  VerifiedMarketplaceListing,
} from '../lib/marketplaceComparison';

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

  // Subscribe to price history for this product
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

  // Exact Variant & Marketplace Price Comparison
  const exactVariant = useMemo(() => {
    return extractExactVariant(product);
  }, [product]);

  const comparisonData = useMemo(() => {
    return getMarketplacePriceComparison(product, allProducts);
  }, [product, allProducts]);

  // Historical coverage period calculation
  const coveragePeriod = useMemo(() => {
    const points = product.priceHistory || [];
    if (points.length > 0) {
      const dates = points.map((p: any) => p.date).filter(Boolean).sort();
      if (dates.length >= 2) {
        const first = new Date(dates[0]).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const last = new Date(dates[dates.length - 1]).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        return `${first} – ${last}`;
      }
    }
    return 'Active Tracking Period';
  }, [product.priceHistory]);

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
            <span>Back to Curated Deals</span>
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
        {/* =========================================================================
            THREE-SECTION PRODUCT-DETAIL LAYOUT (Section 3 of Master Prompt)
            Desktop: 3 visually distinct columns side-by-side (lg:col-span-4 each)
            Tablet/Mobile: Stacked responsively
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* -----------------------------------------------------------------------
              SECTION 1: LEFT COLUMN — Product Gallery (lg:col-span-4)
             ----------------------------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-5">
            {/* Gallery Image Display */}
            <div className="space-y-3">
              <div className="relative aspect-[4/3] w-full rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-sm flex items-center justify-center group/hero">
                <img
                  src={currentImage}
                  alt={product.title}
                  className="w-full h-full max-h-[320px] object-contain p-4 group-hover/hero:scale-102 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />

                {/* Left/Right Carousel Controls */}
                {totalImages > 1 && (
                  <>
                    <button
                      id="hero-img-prev-btn"
                      onClick={handlePrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 text-neutral-800 dark:text-white flex items-center justify-center shadow-md backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/60 transition-all cursor-pointer opacity-80 group-hover/hero:opacity-100"
                      title="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      id="hero-img-next-btn"
                      onClick={handleNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 text-neutral-800 dark:text-white flex items-center justify-center shadow-md backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/60 transition-all cursor-pointer opacity-80 group-hover/hero:opacity-100"
                      title="Next photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Photos Counter Badge */}
                {totalImages > 1 && (
                  <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-white text-[11px] font-semibold">
                    <Layers className="w-3 h-3 text-[#FF6E40]" />
                    <span>
                      {activeImageIndex + 1} / {totalImages}
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {totalImages > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      id={`thumbnail-select-${idx}`}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 bg-white dark:bg-neutral-900 transition-all cursor-pointer ${
                        activeImageIndex === idx
                          ? 'border-[#FF6E40] shadow-xs scale-102 ring-1 ring-[#FF6E40]/30'
                          : 'border-neutral-200 dark:border-neutral-800 opacity-60 hover:opacity-100'
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

            {/* Product Title & Brand Badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/30">
                  {product.store}
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-medium bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {product.category}
                </span>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Deal
                  </span>
                )}
              </div>

              <h1 className="font-heading-editorial text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white leading-snug">
                {product.title}
              </h1>

              {/* Exact Variant & Attributes Tag */}
              <div className="p-3 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-neutral-800 text-xs space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Exact Model & Variant Details
                </div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#FF6E40]" />
                  <span>{exactVariant}</span>
                </div>
                {product.modelIdentifier && (
                  <div className="text-[11px] text-neutral-500 font-mono">
                    Model Identifier: {product.modelIdentifier}
                  </div>
                )}
              </div>
            </div>

            {/* Editorial Overview & Description */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#FF6E40]" />
                <span>Editorial Overview</span>
              </h3>
              <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                {product.description ||
                  `A verified high-quality selection handpicked from ${product.store}. Evaluated for pricing value, user satisfaction, and direct purchase assurance.`}
              </p>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  {product.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* -----------------------------------------------------------------------
              SECTION 2: MIDDLE COLUMN — Marketplace Price Comparison (lg:col-span-4)
             ----------------------------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-5">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#FF6E40]" />
                  <h2 className="font-heading-editorial text-base font-bold text-neutral-900 dark:text-white">
                    Marketplace Comparison
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-neutral-400">
                  Exact Variant Match
                </span>
              </div>

              {/* Lowest Price Banner Callout */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 text-[11px] uppercase tracking-wide">
                    <Award className="w-3.5 h-3.5" />
                    Lowest Comparable Price
                  </span>
                  <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                    {comparisonData.formattedLowestPrice}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Best price available on <strong className="text-neutral-700 dark:text-neutral-200">{comparisonData.cheapestStore}</strong> for {exactVariant}.
                </p>
              </div>

              {/* Verified Listings List */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                  Available Marketplace Offers ({comparisonData.listings.length})
                </span>

                {comparisonData.listings.map((item, idx) => {
                  const isAmazon = item.storeKey === 'amazon';
                  const isFlipkart = item.storeKey === 'flipkart';
                  const isMyntra = item.storeKey === 'myntra';

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.isLowest
                          ? 'border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs'
                          : 'border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Store Badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              isAmazon
                                ? 'bg-[#131921] text-[#ff9900]'
                                : isFlipkart
                                ? 'bg-[#2874f0] text-white'
                                : isMyntra
                                ? 'bg-[#ff3f6c] text-white'
                                : 'bg-neutral-800 text-white'
                            }`}
                          >
                            {item.storeName}
                          </span>
                          {item.isCurrentStore && (
                            <span className="text-[10px] font-semibold text-neutral-400">
                              (Current Listing)
                            </span>
                          )}
                        </div>

                        {/* Lowest Price Tag */}
                        {item.isLowest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                            <Check className="w-3 h-3" />
                            Lowest Price
                          </span>
                        )}
                      </div>

                      {/* Price & Discount */}
                      <div className="flex items-baseline justify-between pt-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xl font-bold text-neutral-900 dark:text-white">
                            {item.formattedPrice}
                          </span>
                          {item.mrp && item.mrp > item.price && (
                            <span className="font-mono text-xs text-neutral-400 line-through">
                              {item.formattedMrp}
                            </span>
                          )}
                        </div>

                        {typeof item.discountPercent === 'number' && item.discountPercent > 0 && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {item.discountPercent}% OFF
                          </span>
                        )}
                      </div>

                      {/* Offer Description & Availability */}
                      <div className="mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 text-xs flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                        <span className="truncate max-w-[180px]">{item.specialOffer || exactVariant}</span>
                        <span className="text-[11px] text-emerald-600 font-semibold">
                          {item.availability}
                        </span>
                      </div>

                      {/* Action Button: Affiliate Redirect */}
                      <div className="mt-3">
                        <a
                          href={item.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => onAffiliateClick(e, product)}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            item.isLowest
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>View on {item.storeName}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Exact Variant Matching Guarantee Notice */}
              <div className="p-3 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-[#FF6E40] shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Variant Integrity:</strong> Prices are matched specifically for the exact product model and specifications. Different storage, colors, or bundles are not equated.
                </span>
              </div>
            </div>
          </div>

          {/* -----------------------------------------------------------------------
              SECTION 3: RIGHT COLUMN — Price Intelligence Card (lg:col-span-4)
             ----------------------------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 shadow-md space-y-5">
              {/* Card Header: Buying Indicator */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Smart Price Intelligence
                </span>

                {/* Buying Indicator Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    comparisonData.buyingIndicator === 'Good time to buy'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : comparisonData.buyingIndicator === 'Consider waiting'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                  }`}
                >
                  {comparisonData.buyingIndicator === 'Good time to buy' && <Flame className="w-3.5 h-3.5 text-emerald-600" />}
                  {comparisonData.buyingIndicator === 'Consider waiting' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                  {comparisonData.buyingIndicator === 'At the reference price' && <Scale className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{comparisonData.buyingIndicator}</span>
                </span>
              </div>

              {/* 1. Current Verified Price Display */}
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-medium">
                  Current Verified Price
                </span>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white font-mono tracking-tight">
                    {formatPriceDisplay(numericCurrentPrice)}
                  </span>
                  {numericMrp > numericCurrentPrice && (
                    <span className="text-base sm:text-lg text-neutral-400 line-through font-mono">
                      {formatPriceDisplay(numericMrp)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
                {savingsAmount > 0 && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-0.5">
                    Save {formatPriceDisplay(savingsAmount)} off original list price
                  </p>
                )}
              </div>

              {/* 3, 4, 5, 6: Price Intelligence Metrics Table */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 space-y-2.5 text-xs">
                {/* Lowest price found */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                    Lowest Price Found:
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">
                    {formatPriceDisplay(comparisonData.lowestPriceFound)}
                  </span>
                </div>

                {/* Highest price found */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                    Highest Price Found:
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">
                    {formatPriceDisplay(comparisonData.highestPrice)}
                  </span>
                </div>

                {/* Reference Midpoint (Formula: (high + low) / 2) */}
                <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 font-medium">
                    <Scale className="w-3.5 h-3.5 text-[#FF6E40]" />
                    Reference Midpoint:
                  </span>
                  <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                    {formatPriceDisplay(comparisonData.referenceMidpoint)}
                  </span>
                </div>

                {/* Percentage Difference: ((current - midpoint) / midpoint) * 100 */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Difference vs Midpoint:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      comparisonData.percentageDifference < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : comparisonData.percentageDifference > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {comparisonData.percentageDifference < 0
                      ? `${comparisonData.percentageDifference}% below midpoint`
                      : comparisonData.percentageDifference > 0
                      ? `+${comparisonData.percentageDifference}% above midpoint`
                      : '0% (at midpoint)'}
                  </span>
                </div>
              </div>

              {/* 8, 9, 10: Metadata, Date & Coverage */}
              <div className="space-y-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
                <div className="flex items-center justify-between">
                  <span>Latest Price Check:</span>
                  <strong className="text-neutral-700 dark:text-neutral-300">
                    {new Date().toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span>Historical Coverage:</span>
                  <strong className="text-neutral-700 dark:text-neutral-300">{coveragePeriod}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span>Verified Data Sources:</span>
                  <span className="text-[#FF6E40] font-medium">
                    {product.store} Official &amp; Verified Records
                  </span>
                </div>
              </div>

              {/* Advisory Disclaimer */}
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed border-t border-neutral-100 dark:border-neutral-800 pt-2">
                * Price-based indicator derived from verified historical high/low midpoint. Presented as shopping advisory, not a future price guarantee.
              </div>

              {/* PRIMARY CALL TO ACTION: Buy Now on Store */}
              <div className="space-y-2.5 pt-2">
                <a
                  id="primary-buy-now-btn"
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => onAffiliateClick(e, product)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6E40] hover:bg-[#e05b30] active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF6E40]/25 transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Buy on {product.store}</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                </a>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="copy-product-link-btn"
                    onClick={copyToClipboard}
                    className="py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    id="share-product-link-btn"
                    onClick={() => onOpenShare(product)}
                    className="py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Deal</span>
                  </button>
                </div>

                {/* Community Update Price Button */}
                <button
                  id="page-update-price-btn"
                  onClick={() => setIsPriceModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#FF6E40]" />
                  <span>Found a Different Price? Update</span>
                </button>
              </div>

              {/* Affiliate partner uploader credit */}
              <div className="pt-1 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
                <span>Shared by:</span>
                <button
                  type="button"
                  id="product-detail-partner-btn"
                  onClick={() => {
                    onSelectPartner?.({
                      id: product.uploaderId || '',
                      name: product.uploaderName || 'Affiliate Partner',
                    });
                  }}
                  className="font-bold text-neutral-800 dark:text-neutral-200 hover:text-[#FF6E40] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  {product.uploaderName || 'Affiliate Partner'}
                </button>
              </div>
            </div>
          </div>
        </div>



        {/* =========================================================================
            Related Curated Finds
           ========================================================================= */}
        {relatedProducts.length > 0 && (
          <section className="pt-8 border-t border-neutral-200/80 dark:border-neutral-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading-editorial text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                  More Curated Finds from {product.store} &amp; {product.category}
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
