import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Heart,
  ExternalLink,
  SlidersHorizontal,
  Bookmark,
  Share2,
  Sparkles,
  ShoppingBag,
  ArrowUpRight,
  Filter,
  Check,
  Eye,
  Copy,
  X,
  MessageCircle,
  Send,
  Tag,
  TrendingUp,
  Layers,
  Flame,
  Zap,
  Clock,
  ShieldCheck,
  Percent,
  Gift,
  Award,
  ArrowRight,
  Star,
  ChevronRight,
  RefreshCw,
  Sparkle,
} from 'lucide-react';
import { Product, CategoryType, StoreType, SortOption } from '../types';
import { database as db, formatPriceDisplay, parsePriceToNumber } from '../lib/firebase';
import { ProductDetailModal } from './ProductDetailModal';
import pickasapBannerImage from '../assets/images/pickasap_festive_banner_1790333064627.jpg';

// Calculate effective discount percentage from explicit fields or MRP comparison
export const getEffectiveDiscount = (product: Product): number => {
  if (typeof product.discountPercent === 'number' && product.discountPercent > 0) {
    return product.discountPercent;
  }
  if (typeof product.discount === 'number' && product.discount > 0) {
    return product.discount;
  }
  if (typeof product.discountPercentage === 'number' && product.discountPercentage > 0) {
    return product.discountPercentage;
  }
  const original = parsePriceToNumber(product.originalPrice || product.mrp);
  const current = typeof product.currentPrice === 'number' && product.currentPrice > 0
    ? product.currentPrice
    : parsePriceToNumber(product.price);
  if (original > current && original > 0 && current > 0) {
    return Math.round(((original - current) / original) * 100);
  }
  return 0;
};

// Composite ranking score combining best deals (discounts) and popularity (clicks)
export const getBestProductScore = (p: Product): number => {
  const discount = getEffectiveDiscount(p);
  const clicks = p.clicksCount || 0;
  const verifiedBonus = (p.dealStatus === 'verified' || p.dealStatus === 'approved') ? 10 : 0;
  // Strongly weights high discount deals and click traffic so top products appear first
  return (discount * 2) + (clicks * 2.5) + verifiedBonus;
};

interface MagazineViewProps {
  products: Product[];
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  onOpenUpload: () => void;
  isLoggedIn: boolean;
  isLoading?: boolean;
  isAdmin?: boolean;
  onOpenPriceUpdate?: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
  onSelectPartner?: (partner: { id: string; name: string }) => void;
}

const CATEGORIES: CategoryType[] = [
  'All',
  'Tech & Audio',
  'Fashion & Apparel',
  'Home & Design',
  'Beauty & Grooming',
  'Books & Stationery',
  'Everyday Carry',
];

const STORES: StoreType[] = ['All', 'Amazon', 'Flipkart', 'Myntra', 'Other'];

// Fast, smooth product card with store-themed vibrant styling, catchy numbers & dynamic badges
const MagazineProductCard: React.FC<{
  product: Product;
  index: number;
  isFav: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenShare: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onAffiliateClick: (e: React.MouseEvent, product: Product) => void;
  onSelectPartner?: (partner: { id: string; name: string }) => void;
}> = ({
  product,
  index,
  isFav,
  onToggleFavorite,
  onOpenShare,
  onSelectProduct,
  onAffiliateClick,
  onSelectPartner,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Store-specific visual identity & vibrant color system
  const storeTheme = useMemo(() => {
    const s = (product.store || '').toLowerCase();
    if (s.includes('flipkart')) {
      return {
        name: 'Flipkart',
        accentColor: '#2874f0',
        topBar: 'bg-[#2874f0]',
        cardBorder: 'border-blue-200/90 dark:border-blue-900/60',
        cardHover: 'hover:border-[#2874f0] hover:shadow-2xl hover:shadow-blue-500/15',
        cardBg: 'bg-gradient-to-b from-white via-white to-blue-50/30 dark:from-[#0f131c] dark:via-[#0c0f16] dark:to-blue-950/25',
        imageBg: 'bg-gradient-to-br from-blue-100/70 via-sky-50 to-blue-200/50 dark:from-blue-950/50 dark:via-[#0d1527] dark:to-blue-900/30',
        storeBadgeBg: 'bg-[#2874f0] text-white',
        storeDot: 'bg-[#ffe11b]', // Flipkart Yellow
        dealRibbon: 'bg-blue-600 text-white',
        dealText: 'Flipkart SuperDeal',
        ctaClass: 'bg-[#2874f0] hover:bg-[#1259cb] text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50',
        ctaText: 'Shop on Flipkart',
        titleHover: 'group-hover:text-[#2874f0]',
        tagBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
      };
    }
    if (s.includes('amazon')) {
      return {
        name: 'Amazon',
        accentColor: '#ff9900',
        topBar: 'bg-[#ff9900]',
        cardBorder: 'border-amber-200/90 dark:border-amber-900/60',
        cardHover: 'hover:border-[#ff9900] hover:shadow-2xl hover:shadow-amber-500/15',
        cardBg: 'bg-gradient-to-b from-white via-white to-amber-50/30 dark:from-[#15120f] dark:via-[#100e0c] dark:to-amber-950/25',
        imageBg: 'bg-gradient-to-br from-amber-100/70 via-orange-50 to-amber-200/50 dark:from-amber-950/50 dark:via-[#1c140a] dark:to-amber-900/30',
        storeBadgeBg: 'bg-[#131921] text-[#ff9900] border border-[#ff9900]/40',
        storeDot: 'bg-[#ff9900]',
        dealRibbon: 'bg-[#ff9900] text-black font-black',
        dealText: "Amazon's Choice Deal",
        ctaClass: 'bg-[#ff9900] hover:bg-[#e68a00] text-neutral-950 font-black shadow-md shadow-amber-500/30 hover:shadow-amber-500/50',
        ctaText: 'Shop on Amazon',
        titleHover: 'group-hover:text-[#d97706]',
        tagBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
      };
    }
    if (s.includes('myntra')) {
      return {
        name: 'Myntra',
        accentColor: '#ff3f6c',
        topBar: 'bg-[#ff3f6c]',
        cardBorder: 'border-pink-200/90 dark:border-pink-900/60',
        cardHover: 'hover:border-[#ff3f6c] hover:shadow-2xl hover:shadow-pink-500/15',
        cardBg: 'bg-gradient-to-b from-white via-white to-pink-50/30 dark:from-[#171015] dark:via-[#120c10] dark:to-pink-950/25',
        imageBg: 'bg-gradient-to-br from-pink-100/70 via-rose-50 to-pink-200/50 dark:from-pink-950/50 dark:via-[#210c17] dark:to-pink-900/30',
        storeBadgeBg: 'bg-[#ff3f6c] text-white',
        storeDot: 'bg-white',
        dealRibbon: 'bg-[#ff3f6c] text-white',
        dealText: 'Myntra Trendsetter',
        ctaClass: 'bg-[#ff3f6c] hover:bg-[#e72744] text-white shadow-md shadow-pink-500/30 hover:shadow-pink-500/50',
        ctaText: 'Shop on Myntra',
        titleHover: 'group-hover:text-[#ff3f6c]',
        tagBg: 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-900/60',
      };
    }
    return {
      name: product.store || 'Curated',
      accentColor: '#FF6E40',
      topBar: 'bg-[#FF6E40]',
      cardBorder: 'border-orange-200/90 dark:border-orange-900/60',
      cardHover: 'hover:border-[#FF6E40] hover:shadow-2xl hover:shadow-orange-500/15',
      cardBg: 'bg-gradient-to-b from-white via-white to-orange-50/30 dark:from-[#161210] dark:via-[#100d0b] dark:to-orange-950/25',
      imageBg: 'bg-gradient-to-br from-orange-100/70 via-amber-50 to-orange-200/50 dark:from-orange-950/50 dark:via-[#1e110a] dark:to-orange-900/30',
      storeBadgeBg: 'bg-[#FF6E40] text-white',
      storeDot: 'bg-white',
      dealRibbon: 'bg-[#FF6E40] text-white',
      dealText: 'PickASAP Featured',
      ctaClass: 'bg-[#FF6E40] hover:bg-[#e5592e] text-white shadow-md shadow-orange-500/30 hover:shadow-orange-500/50',
      ctaText: `Shop on ${product.store || 'Store'}`,
      titleHover: 'group-hover:text-[#FF6E40]',
      tagBg: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/60',
    };
  }, [product.store]);

  // Big catchy numbers calculations
  const discount = getEffectiveDiscount(product);
  const currentNum = typeof product.currentPrice === 'number' && product.currentPrice > 0
    ? product.currentPrice
    : parsePriceToNumber(product.price);
  const originalNum = parsePriceToNumber(product.originalPrice || product.mrp);
  const savingsAmount = originalNum > currentNum ? originalNum - currentNum : 0;

  return (
    <article
      className={`group relative flex flex-col justify-between ${storeTheme.cardBg} rounded-3xl border ${storeTheme.cardBorder} overflow-hidden shadow-md ${storeTheme.cardHover} transition-all duration-300 animate-fade-in`}
    >
      {/* Eye-Catching Store Color Bar at the top of each card */}
      <div className={`h-1.5 w-full ${storeTheme.topBar}`} />

      {/* Vibrant Image Container with Ambient Spotlight Glow */}
      <div
        onClick={() => onSelectProduct(product)}
        className={`relative aspect-[4/3] ${storeTheme.imageBg} overflow-hidden flex items-center justify-center cursor-pointer group/image border-b border-neutral-100 dark:border-neutral-800/80`}
      >
        {/* Subtle radial spotlight to make product photo pop off the card */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.85)_0%,transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,transparent_75%)] pointer-events-none" />

        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-neutral-200/50 dark:bg-neutral-800/50 animate-pulse" />
        )}

        {imgError ? (
          <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
            <ShoppingBag className="w-10 h-10 mb-2 stroke-[1.2] text-neutral-400 dark:text-neutral-500" />
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">{product.store} Deal</span>
          </div>
        ) : (
          <img
            src={product.imageUrl}
            alt={product.title}
            loading={index < 3 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgLoaded(true);
              setImgError(true);
            }}
            className={`relative z-10 w-full h-full object-contain p-3 sm:p-4 group-hover/image:scale-108 transition-transform duration-500 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Multi-image photo count badge */}
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-[10px] font-bold shadow-md">
            <Layers className="w-3 h-3 text-[#ffe11b]" />
            <span>{product.images.length} photos</span>
          </div>
        )}

        {/* Store Brand Badge with Brand Dot */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${storeTheme.storeBadgeBg} backdrop-blur-md shadow-md text-xs font-black uppercase tracking-wider`}>
            <span className={`w-2 h-2 rounded-full ${storeTheme.storeDot} ring-2 ring-white/50 animate-pulse`} />
            <span>{product.store}</span>
          </div>
        </div>

        {/* Favorite Heart Button */}
        <button
          id={`fav-btn-${product.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          title={isFav ? 'Remove from saved' : 'Save to favorites'}
          className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md ${
            isFav
              ? 'bg-rose-500 text-white'
              : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-600 dark:text-neutral-300 hover:text-rose-500 hover:bg-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
        </button>

        {/* Big Catchy Numbers: Discount Sticker on Photo */}
        {discount > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
            <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-lg shadow-red-600/30 flex items-center gap-1 border border-red-400/40">
              <Flame className="w-3.5 h-3.5 fill-white" />
              <span className="text-xs sm:text-sm font-black tracking-tight uppercase">
                {discount}% OFF
              </span>
            </div>
            {savingsAmount > 0 && (
              <div className="hidden sm:flex px-2.5 py-1 rounded-xl bg-neutral-900/90 dark:bg-black/90 text-emerald-400 text-[11px] font-black backdrop-blur-md shadow-md border border-neutral-700">
                SAVE ₹{savingsAmount.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Catchy Editorial Body with Big Bold Numbers & Colors */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Top Info Row: Category Tag, Trending Clicks & Deal Label */}
          <div className="flex items-center justify-between text-xs mb-2.5 gap-2">
            <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] border ${storeTheme.tagBg}`}>
              {product.category}
            </span>
            <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/90 px-2.5 py-0.5 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs">
              <Flame className="w-3 h-3 text-[#FF6E40]" />
              <span>{product.clicksCount || 0} views</span>
            </div>
          </div>

          {/* Title */}
          <h3
            onClick={() => onSelectProduct(product)}
            className={`font-heading-editorial text-lg sm:text-xl font-black text-neutral-900 dark:text-white leading-snug ${storeTheme.titleHover} transition-colors cursor-pointer`}
          >
            {product.title}
          </h3>

          {/* Editorial Paragraph / Description */}
          <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-serif-editorial leading-relaxed line-clamp-2">
            {product.editorialNote || product.description}
          </p>
        </div>

        {/* Big Catchy Pricing & Savings Section */}
        <div className="space-y-3 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap">
              {/* Huge Bold Price Number */}
              <span className="text-2xl sm:text-3xl font-black font-sans text-neutral-950 dark:text-white tracking-tight">
                {formatPriceDisplay(product.price)}
              </span>

              {/* MRP Strikethrough */}
              {(product.originalPrice || product.mrp) && (
                <span className="text-xs sm:text-sm font-semibold text-neutral-400 line-through">
                  {formatPriceDisplay(product.originalPrice || product.mrp || '')}
                </span>
              )}
            </div>

            {/* Savings Pill */}
            {savingsAmount > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                Save ₹{savingsAmount.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Verified Guarantee & Urgency Tag */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500 shrink-0" />
            <span>Best festive deal · Direct store checkout</span>
          </div>

          {/* Author/Partner & CTAs */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              id={`partner-profile-btn-${product.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectPartner) {
                  onSelectPartner({
                    id: product.uploaderId || '',
                    name: product.uploaderName || 'Affiliate Partner',
                  });
                }
              }}
              className="group/author text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 hover:text-[#FF6E40] dark:hover:text-[#FF6E40] flex items-center gap-1 transition-colors cursor-pointer text-left truncate max-w-[100px] sm:max-w-[130px]"
              title={`View ${product.uploaderName || 'Affiliate Partner'}'s profile`}
            >
              <span className="truncate group-hover/author:underline underline-offset-2">
                By {product.uploaderName || 'Curator'}
              </span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id={`share-btn-${product.id}`}
                onClick={() => onOpenShare(product)}
                title="Share affiliate link or post to social media"
                aria-label="Share product deal"
                className="p-2 sm:px-2.5 sm:py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {/* Eye-Catching Store-Themed CTA Button */}
              <a
                id={`shop-btn-${product.id}`}
                href={product.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => onAffiliateClick(e, product)}
                className={`px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl ${storeTheme.ctaClass} text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0`}
              >
                <span>{storeTheme.ctaText}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export const MagazineView: React.FC<MagazineViewProps> = ({
  products,
  favorites,
  onToggleFavorite,
  onOpenUpload,
  isLoggedIn,
  isLoading = false,
  isAdmin = false,
  onOpenPriceUpdate,
  onSelectProduct,
  onSelectPartner,
}) => {
  // Initialize state from URL search params for direct deep-linking and SEO
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    }
    return '';
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('category');
      if (cat && CATEGORIES.includes(cat as CategoryType)) return cat as CategoryType;
    }
    return 'All';
  });
  const [selectedStore, setSelectedStore] = useState<StoreType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const store = params.get('store');
      if (store && STORES.includes(store as StoreType)) return store as StoreType;
    }
    return 'All';
  });
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sort = params.get('sort');
      if (
        sort === 'best' ||
        sort === 'best_deals' ||
        sort === 'price_low' ||
        sort === 'price_high' ||
        sort === 'most_clicked' ||
        sort === 'alphabetical' ||
        sort === 'newest'
      ) {
        return sort as SortOption;
      }
    }
    return 'best';
  });
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('favorites') === 'true';
    }
    return false;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Listen for global filter events dispatched from SEO footer or deep links
  useEffect(() => {
    const handleGlobalFilter = (e: CustomEvent<{ store?: StoreType; category?: CategoryType; sort?: SortOption; search?: string }>) => {
      if (e.detail?.store !== undefined) setSelectedStore(e.detail.store);
      if (e.detail?.category !== undefined) setSelectedCategory(e.detail.category);
      if (e.detail?.sort !== undefined) setSortBy(e.detail.sort);
      if (e.detail?.search !== undefined) setSearchQuery(e.detail.search);
      // Smoothly scroll to product catalog
      const catalogEl = document.getElementById('product-catalog-anchor');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('pickasap:filter' as any, handleGlobalFilter as EventListener);
    return () => {
      window.removeEventListener('pickasap:filter' as any, handleGlobalFilter as EventListener);
    };
  }, []);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesTitle = p.title.toLowerCase().includes(query);
          const matchesDesc = (p.description || '').toLowerCase().includes(query);
          const matchesTags = (p.tags || []).some((t) => t.toLowerCase().includes(query));
          const matchesStore = p.store.toLowerCase().includes(query);
          if (!matchesTitle && !matchesDesc && !matchesTags && !matchesStore) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'All' && p.category !== selectedCategory) {
          return false;
        }

        // Store filter
        if (selectedStore !== 'All' && p.store !== selectedStore) {
          return false;
        }

        // Favorites filter
        if (onlyFavorites && !favorites.includes(p.id)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Default: "best products on top" - prioritized by composite deal discount and click popularity
        if (sortBy === 'best') {
          const scoreA = getBestProductScore(a);
          const scoreB = getBestProductScore(b);
          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }
          const discA = getEffectiveDiscount(a);
          const discB = getEffectiveDiscount(b);
          if (discB !== discA) {
            return discB - discA;
          }
          const clicksA = a.clicksCount || 0;
          const clicksB = b.clicksCount || 0;
          if (clicksB !== clicksA) {
            return clicksB - clicksA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Best Deals: strictly sorted by highest discount percentage
        if (sortBy === 'best_deals') {
          const discA = getEffectiveDiscount(a);
          const discB = getEffectiveDiscount(b);
          if (discB !== discA) {
            return discB - discA;
          }
          const clicksA = a.clicksCount || 0;
          const clicksB = b.clicksCount || 0;
          if (clicksB !== clicksA) {
            return clicksB - clicksA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Most Popular: strictly sorted by clicks
        if (sortBy === 'most_clicked') {
          const clicksA = a.clicksCount || 0;
          const clicksB = b.clicksCount || 0;
          if (clicksB !== clicksA) {
            return clicksB - clicksA;
          }
          const discA = getEffectiveDiscount(a);
          const discB = getEffectiveDiscount(b);
          if (discB !== discA) {
            return discB - discA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Uploading date sequence
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'price_low') {
          const pA = parsePriceToNumber(a.price);
          const pB = parsePriceToNumber(b.price);
          return pA - pB;
        }
        if (sortBy === 'price_high') {
          const pA = parsePriceToNumber(a.price);
          const pB = parsePriceToNumber(b.price);
          return pB - pA;
        }
        if (sortBy === 'alphabetical') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [products, searchQuery, selectedCategory, selectedStore, onlyFavorites, sortBy, favorites]);

  // SEO & Dynamic Metadata synchronization: updates browser title, meta tags, and URL search params
  useEffect(() => {
    // 1. Sync URL query params without triggering full page reloads
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (selectedStore !== 'All') params.set('store', selectedStore);
    if (sortBy !== 'best') params.set('sort', sortBy);
    if (onlyFavorites) params.set('favorites', 'true');

    const newQueryString = params.toString();
    const newRelativePath = newQueryString ? `${window.location.pathname}?${newQueryString}` : window.location.pathname;
    window.history.replaceState(null, '', newRelativePath);

    // 2. Dynamic document title & meta description updates for SEO
    let dynamicTitle = 'PickASAP — Curated Shopping, Flipkart & Amazon Affiliate Deals, Low Cost & High Quality Products';
    let dynamicDesc = 'PickASAP is your premier curated shopping magazine and affiliate discovery hub. Discover verified low cost products and high quality products across Flipkart, Amazon, Myntra, and top stores.';

    if (searchQuery.trim()) {
      dynamicTitle = `"${searchQuery.trim()}" — Curated Shopping & Affiliate Deals | PickASAP`;
      dynamicDesc = `Search results for "${searchQuery.trim()}" on PickASAP. Discover handpicked low cost and high quality product recommendations from Flipkart, Amazon, and Myntra.`;
    } else if (selectedStore !== 'All') {
      if (selectedStore === 'Flipkart') {
        dynamicTitle = 'Flipkart Deals, Offers & Curated Affiliate Finds — PickASAP';
        dynamicDesc = 'Explore curated Flipkart deals, verified discount recommendations, and top-rated low cost & high quality products on PickASAP.';
      } else if (selectedStore === 'Amazon') {
        dynamicTitle = 'Amazon Finds, Best Deals & Low Cost Products — PickASAP';
        dynamicDesc = 'Handpicked Amazon finds, best-seller reviews, and curated high quality recommendations with transparent affiliate links on PickASAP.';
      } else if (selectedStore === 'Myntra') {
        dynamicTitle = 'Myntra Fashion, Lifestyle Trends & Curated Deals — PickASAP';
        dynamicDesc = 'Curated fashion, apparel, and lifestyle trends from Myntra. Handpicked quality picks and seasonal offers on PickASAP.';
      } else {
        dynamicTitle = `${selectedStore} Curated Deals & Products — PickASAP`;
        dynamicDesc = `Browse curated shopping recommendations and affiliate deals from ${selectedStore} on PickASAP.`;
      }
    } else if (sortBy === 'price_low') {
      dynamicTitle = 'Low Cost Products & Budget Shopping Deals — PickASAP';
      dynamicDesc = 'Discover the best low cost products and budget-friendly finds with verified high quality across Amazon, Flipkart, and Myntra.';
    } else if (sortBy === 'most_clicked') {
      dynamicTitle = 'Top Trending & Good Quality Products — PickASAP';
      dynamicDesc = 'Explore community-favorite, most popular and highly rated product recommendations across all partnered affiliate stores on PickASAP.';
    } else if (selectedCategory !== 'All') {
      dynamicTitle = `${selectedCategory} Curated Recommendations & Deals — PickASAP`;
      dynamicDesc = `Discover handpicked ${selectedCategory} products, verified affiliate deals, and top quality picks on PickASAP.`;
    }

    document.title = dynamicTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', dynamicDesc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', dynamicTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', dynamicDesc);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', dynamicTitle);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', dynamicDesc);

    // 3. Dynamic JSON-LD structured data for product collection
    try {
      let scriptTag = document.getElementById('pickasap-dynamic-schema');
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'pickasap-dynamic-schema';
        scriptTag.setAttribute('type', 'application/ld+json');
        document.head.appendChild(scriptTag);
      }

      if (filteredProducts.length > 0) {
        const schemaItems = filteredProducts.slice(0, 12).map((p, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'Product',
            name: p.title,
            description: p.description || p.title,
            image: p.imageUrl,
            category: p.category,
            offers: {
              '@type': 'Offer',
              price: p.price.replace(/[^0-9.]/g, '') || '0',
              priceCurrency: 'INR',
              availability: 'https://schema.org/InStock',
              url: p.affiliateUrl,
              seller: {
                '@type': 'Organization',
                name: p.store,
              },
            },
          },
        }));

        scriptTag.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: dynamicTitle,
          description: dynamicDesc,
          numberOfItems: filteredProducts.length,
          itemListElement: schemaItems,
        });
      }
    } catch {
      // ignore schema update errors in non-browser env
    }
  }, [searchQuery, selectedCategory, selectedStore, sortBy, onlyFavorites, filteredProducts]);

  // Click handler that records real-time analytics
  const handleAffiliateClick = (e: React.MouseEvent, product: Product) => {
    // Record real-time analytics tracker
    db.recordClick(product);
  };

  const handleOpenShare = (product: Product) => {
    setShareProduct(product);
    setCopyStatus(null);
  };

  const copyAffiliateLink = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopyStatus('Copied to clipboard!');
      setTimeout(() => setCopyStatus(null), 2500);
    }
  };

  const handleNativeShare = async (product: Product) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `Check out ${product.title} on PickASAP:`,
          url: product.affiliateUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    }
  };

  return (
    <div className="w-full min-h-screen bg-white text-neutral-900 dark:bg-[#0c0c0d] dark:text-[#f3f3f3] transition-colors duration-300">
      {/* Top Hero Banner Section */}
      <section className="relative w-full border-b border-neutral-100 dark:border-neutral-800/80 overflow-hidden bg-white dark:bg-[#0c0c0d]">
        {/* Hero Banner Image */}
        <div className="relative w-full overflow-hidden flex items-center justify-center">
          <img
            src={pickasapBannerImage}
            alt="PickASAP - Where Affiliate Marketers Meet Smart Shoppers"
            referrerPolicy="no-referrer"
            className="w-full h-auto max-h-[700px] object-cover sm:object-contain object-center transition-all duration-300 select-none shadow-xs"
          />
        </div>
      </section>

      {/* High-Energy Live Breaking Deals Marquee Ticker */}
      <div className="w-full bg-[#0d0f14] text-white border-b border-neutral-800 py-3 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-0.5">
            <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-red-600/25 text-red-400 border border-red-500/30 font-bold uppercase tracking-wider text-[10px] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span>Live Deals Radar</span>
            </div>

            {/* Interactive ticker highlights */}
            <div className="flex items-center gap-6 whitespace-nowrap text-neutral-300">
              <button
                onClick={() => {
                  setSelectedStore('Flipkart');
                  const el = document.getElementById('product-catalog-anchor');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 hover:text-[#2874f0] transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2874f0]" />
                <span className="font-semibold text-white">Flipkart Big Billion Days:</span>
                <span className="text-neutral-400">Up to 80% off Laptops, Electronics &amp; Gadgets</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </button>

              <span className="text-neutral-700">|</span>

              <button
                onClick={() => {
                  setSelectedStore('Amazon');
                  const el = document.getElementById('product-catalog-anchor');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 hover:text-[#ff9900] transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff9900]" />
                <span className="font-semibold text-white">Amazon Great Indian Festival:</span>
                <span className="text-neutral-400">Lightning price drops &amp; bank discounts live</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </button>

              <span className="text-neutral-700">|</span>

              <button
                onClick={() => {
                  setSelectedStore('Myntra');
                  const el = document.getElementById('product-catalog-anchor');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 hover:text-[#ff3f6c] transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff3f6c]" />
                <span className="font-semibold text-white">Myntra End of Reason Sale:</span>
                <span className="text-neutral-400">Trending fashion, sneakers &amp; beauty collections</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </button>

              <span className="text-neutral-700">|</span>

              <button
                onClick={() => {
                  setSortBy('price_low');
                  const el = document.getElementById('product-catalog-anchor');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span className="font-semibold text-white">Budget Steals:</span>
                <span className="text-neutral-400">Low-cost products under ₹999 verified daily</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </button>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-neutral-400 text-[11px]">
            <Clock className="w-3 h-3 text-[#FF6E40]" />
            <span>Price drops refreshed continuously</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main id="product-catalog-anchor" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* 4-Hub Festive Showcase Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Flipkart Big Billion Deals */}
          <div
            onClick={() => {
              setSelectedStore(selectedStore === 'Flipkart' ? 'All' : 'Flipkart');
              setSortBy('best');
            }}
            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
              selectedStore === 'Flipkart'
                ? 'bg-blue-50/90 dark:bg-blue-950/30 border-blue-500 shadow-md ring-1 ring-blue-500'
                : 'bg-white dark:bg-[#111318] border-neutral-200/90 dark:border-neutral-800/90 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2874f0] ring-4 ring-blue-100 dark:ring-blue-950" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                Big Billion Days
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <span>Flipkart Deals</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
              Laptops, smart gadgets, appliances &amp; festive flash discounts.
            </p>
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Explore Deals</span>
              <span className="text-[11px] font-mono text-neutral-400">Up to 80% Off</span>
            </div>
          </div>

          {/* Card 2: Amazon Great Indian Festival */}
          <div
            onClick={() => {
              setSelectedStore(selectedStore === 'Amazon' ? 'All' : 'Amazon');
              setSortBy('best');
            }}
            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
              selectedStore === 'Amazon'
                ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500'
                : 'bg-white dark:bg-[#111318] border-neutral-200/90 dark:border-neutral-800/90 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff9900] ring-4 ring-amber-100 dark:ring-amber-950" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                Great Indian Fest
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              <span>Amazon Finds</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
              Top-rated everyday tech, audio gear &amp; lightning deal drops.
            </p>
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>Explore Deals</span>
              <span className="text-[11px] font-mono text-neutral-400">Prime Deals</span>
            </div>
          </div>

          {/* Card 3: Myntra End of Reason Sale */}
          <div
            onClick={() => {
              setSelectedStore(selectedStore === 'Myntra' ? 'All' : 'Myntra');
              setSortBy('best');
            }}
            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
              selectedStore === 'Myntra'
                ? 'bg-pink-50/90 dark:bg-pink-950/30 border-pink-500 shadow-md ring-1 ring-pink-500'
                : 'bg-white dark:bg-[#111318] border-neutral-200/90 dark:border-neutral-800/90 hover:border-pink-300 dark:hover:border-pink-700 hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff3f6c] ring-4 ring-pink-100 dark:ring-pink-950" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 bg-pink-100/70 dark:bg-pink-950/60 px-2 py-0.5 rounded-full">
                End of Reason
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
              <span>Myntra Fashion</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
              Sneakers, designer clothing, handbags &amp; luxury fragrances.
            </p>
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-semibold text-pink-600 dark:text-pink-400">
              <span>Explore Deals</span>
              <span className="text-[11px] font-mono text-neutral-400">50-80% Off</span>
            </div>
          </div>

          {/* Card 4: Super Saver & Low Cost */}
          <div
            onClick={() => {
              setSortBy(sortBy === 'best_deals' ? 'best' : 'best_deals');
            }}
            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
              sortBy === 'best_deals'
                ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-500 shadow-md ring-1 ring-rose-500'
                : 'bg-white dark:bg-[#111318] border-neutral-200/90 dark:border-neutral-800/90 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                Diwali Dhamaka
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              <span>Top Price Drops</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
              Highest percentage savings, discount steals &amp; tested deals.
            </p>
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span>Explore Deals</span>
              <span className="text-[11px] font-mono text-neutral-400">Max Discount</span>
            </div>
          </div>
        </div>

        {/* Visual Department Carousel / Tiles */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FF6E40]" />
              <span>Browse Curated Departments</span>
            </span>
            {selectedCategory !== 'All' && (
              <button
                onClick={() => setSelectedCategory('All')}
                className="text-xs font-semibold text-[#FF6E40] hover:underline cursor-pointer"
              >
                View All Departments
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-2 border shadow-xs ${
                    isSelected
                      ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-950 shadow-md scale-[1.02]'
                      : 'bg-white dark:bg-[#111318] border-neutral-200/80 dark:border-neutral-800/80 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600'
                  }`}
                >
                  {cat === 'All' && <Sparkles className="w-3.5 h-3.5 text-[#FF6E40]" />}
                  {cat === 'Tech & Audio' && <Zap className="w-3.5 h-3.5 text-blue-500" />}
                  {cat === 'Fashion & Apparel' && <Flame className="w-3.5 h-3.5 text-pink-500" />}
                  {cat === 'Home & Design' && <Gift className="w-3.5 h-3.5 text-amber-500" />}
                  {cat === 'Beauty & Grooming' && <Star className="w-3.5 h-3.5 text-purple-500" />}
                  {cat === 'Books & Stationery' && <Bookmark className="w-3.5 h-3.5 text-emerald-500" />}
                  {cat === 'Everyday Carry' && <Award className="w-3.5 h-3.5 text-indigo-500" />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search, Filter Bar & Quick Sort Controls */}
        <div className="space-y-4 mb-8 p-4 rounded-2xl bg-neutral-50/80 dark:bg-[#111318]/70 border border-neutral-200/80 dark:border-neutral-800/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="magazine-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals, products, brands, or notes..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6E40]/20 focus:border-[#FF6E40] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Sorter & Store Controls */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 font-medium">Store:</span>
                <select
                  id="filter-store-select"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value as StoreType)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {STORES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'All Stores' : s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 font-medium">Sort:</span>
                <select
                  id="filter-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="best">🔥 Best Deals (Score &amp; Clicks)</option>
                  <option value="best_deals">⚡ Highest % Off</option>
                  <option value="most_clicked">📈 Most Popular</option>
                  <option value="newest">🕒 Newest Uploads</option>
                  <option value="price_low">💰 Price: Low to High</option>
                  <option value="price_high">💎 Price: High to Low</option>
                  <option value="alphabetical">Title A-Z</option>
                </select>
              </div>

              {/* Saved Favorites */}
              <button
                id="filter-favorites-toggle"
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  onlyFavorites
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900 shadow-xs'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    onlyFavorites ? 'fill-rose-500 text-rose-500' : 'text-neutral-500'
                  }`}
                />
                <span>Saved ({favorites.length})</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Tag Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1 scrollbar-none text-xs">
            <span className="text-neutral-400 font-medium whitespace-nowrap text-[11px]">Quick Picks:</span>

            <button
              onClick={() => {
                setSortBy('best_deals');
                setSelectedStore('All');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sortBy === 'best_deals'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              🔥 Max Discounts (&gt;50% Off)
            </button>

            <button
              onClick={() => {
                setSortBy('price_low');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sortBy === 'price_low'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              💰 Low Cost Finds
            </button>

            <button
              onClick={() => {
                setSortBy('most_clicked');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sortBy === 'most_clicked'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              ⭐ Top Quality &amp; Clicks
            </button>

            <button
              onClick={() => {
                setSelectedStore('Flipkart');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedStore === 'Flipkart'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              Flipkart Specials
            </button>

            <button
              onClick={() => {
                setSelectedStore('Amazon');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedStore === 'Amazon'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              Amazon Finds
            </button>

            <button
              onClick={() => {
                setSelectedStore('Myntra');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedStore === 'Myntra'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              Myntra Fashion
            </button>
          </div>
        </div>

        {/* Product Grid / Editorial Showcase */}
        {isLoading && products.length === 0 ? (
          /* Instant smooth skeleton cards while first network fetch resolves */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {[1, 2, 3].map((n) => (
              <div
                key={`skeleton-${n}`}
                className="flex flex-col justify-between bg-white dark:bg-[#111318] rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden animate-pulse shadow-xs"
              >
                <div className="aspect-[4/3] bg-neutral-200/70 dark:bg-neutral-800/70" />
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
                    <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-800 rounded" />
                  </div>
                  <div className="h-5 w-4/5 bg-neutral-200 dark:bg-neutral-800 rounded" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                    <div className="h-3 w-3/4 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                  </div>
                  <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex justify-between items-center">
                    <div className="h-5 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
                    <div className="h-9 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          /* Rich, attractive and bustling empty catalog state */
          <div className="space-y-10 py-6">
            {/* Launch Banner Card */}
            <div className="relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-linear-to-br from-neutral-50 via-white to-orange-50/30 dark:from-[#111318] dark:via-[#0e1015] dark:to-[#1a1410] p-8 sm:p-12 shadow-sm text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/30 mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready For Your Affiliate Curations</span>
              </div>

              <h2 className="font-heading-editorial text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white max-w-2xl mx-auto leading-tight mb-4">
                Your Curated Digital Magazine Is Ready To Launch
              </h2>

              <p className="max-w-2xl mx-auto text-neutral-600 dark:text-neutral-400 font-serif-editorial text-base sm:text-lg leading-relaxed mb-8">
                The layout is primed for genuine affiliate links from Amazon, Flipkart, and Myntra. Add your first product link to showcase verified deals with instant price tracking and click metrics.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  id="empty-state-upload-cta-btn"
                  onClick={onOpenUpload}
                  className="px-7 py-3.5 rounded-full bg-[#FF6E40] hover:bg-[#e05a30] text-white text-xs uppercase tracking-widest font-bold inline-flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isLoggedIn ? 'Publish First Affiliate Product (+)' : 'Add Your Own Affiliate Link (+)'}</span>
                </button>
              </div>
            </div>

            {/* Department Preview Bento Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading-editorial text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#FF6E40]" />
                  <span>Featured Departments Ready for Links</span>
                </h3>
                <span className="text-xs text-neutral-400">Click any card to add products</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Electronics & Audio Innovations',
                    store: 'Flipkart & Amazon',
                    desc: 'Laptops, smartwatches, ANC headphones & smartphone accessories.',
                    icon: Zap,
                    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
                  },
                  {
                    title: 'Fashion, Sneakers & Apparel',
                    store: 'Myntra & Amazon',
                    desc: 'Streetwear, casual fits, watches, footwear & luxury collections.',
                    icon: Flame,
                    color: 'text-pink-500 bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900',
                  },
                  {
                    title: 'Home, Living & Interior Comfort',
                    store: 'Amazon & Flipkart',
                    desc: 'Ergonomic seating, kitchen appliances, lighting & modern decor.',
                    icon: Gift,
                    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
                  },
                  {
                    title: 'Beauty, Skincare & Grooming',
                    store: 'Myntra & Flipkart',
                    desc: 'Luxury fragrances, serums, hair care & daily grooming essentials.',
                    icon: Star,
                    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900',
                  },
                  {
                    title: 'Everyday Carry & Travel Gear',
                    store: 'Amazon & Myntra',
                    desc: 'Luggage bags, minimal wallets, multi-tools & work accessories.',
                    icon: Award,
                    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
                  },
                  {
                    title: 'Low Cost Deals Under ₹999',
                    store: 'All Retail Partners',
                    desc: 'Verified budget finds with verified customer reviews & ratings.',
                    icon: Tag,
                    color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
                  },
                ].map((dept, i) => {
                  const Icon = dept.icon;
                  return (
                    <div
                      key={i}
                      onClick={onOpenUpload}
                      className="group p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111318] hover:border-neutral-400 dark:hover:border-neutral-600 transition-all duration-300 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${dept.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] font-mono text-neutral-400">{dept.store}</span>
                        </div>
                        <h4 className="font-heading-editorial text-lg font-bold text-neutral-900 dark:text-white group-hover:text-[#FF6E40] transition-colors">
                          {dept.title}
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                          {dept.desc}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-semibold text-[#FF6E40]">
                        <span>Add Product to Department</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3-Pillar Feature Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="p-6 rounded-2xl bg-neutral-50/80 dark:bg-[#111318]/60 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Direct Merchant Store Checkout</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Shoppers purchase directly through Amazon, Flipkart, or Myntra with full merchant warranty and zero added fees.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-neutral-50/80 dark:bg-[#111318]/60 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Real-Time Click Tracking</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Every recommendation tracks real user clicks transparently, promoting the most popular and top-rated finds.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-neutral-50/80 dark:bg-[#111318]/60 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Handpicked Editorial Standards</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Focusing on price-to-quality ratio, price drops, and verified customer reviews across top shopping categories.
                </p>
              </div>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <h3 className="font-serif-editorial text-xl text-neutral-700 dark:text-neutral-300">
              No products match your current filters.
            </h3>
            <p className="text-xs text-neutral-400">
              Try adjusting your search query, category, or store filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedStore('All');
                setOnlyFavorites(false);
              }}
              className="mt-2 text-xs font-semibold text-[#FF6E40] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {filteredProducts.map((product, index) => (
              <MagazineProductCard
                key={product.id}
                product={product}
                index={index}
                isFav={favorites.includes(product.id)}
                onToggleFavorite={onToggleFavorite}
                onOpenShare={handleOpenShare}
                onSelectProduct={onSelectProduct || setSelectedProductForModal}
                onAffiliateClick={handleAffiliateClick}
                onSelectPartner={onSelectPartner}
              />
            ))}
          </div>
        )}

        {/* Shopping Perks & Confidence Strip (Always rendered for busy, authentic commerce magazine feel) */}
        <div className="mt-16 pt-10 border-t border-neutral-200/80 dark:border-neutral-800/80">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-neutral-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% Direct Store Checkout</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                You purchase securely on Flipkart, Amazon, and Myntra with official warranties.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-neutral-900 dark:text-white">
                <Percent className="w-4 h-4 text-red-500" />
                <span>Zero Markup Guarantee</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Affiliate recommendations provide authentic discounts at zero extra cost to you.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-neutral-900 dark:text-white">
                <Zap className="w-4 h-4 text-blue-500" />
                <span>Real-Time Deal Tracking</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Live monitoring of price drops, seasonal sales, and top community clicks.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-neutral-900 dark:text-white">
                <Award className="w-4 h-4 text-purple-500" />
                <span>Curated Quality Standards</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Handpicked balance of low cost and high product satisfaction scores.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Showcase Product Details & Multi-Image Gallery Modal */}
      <ProductDetailModal
        product={selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
        isFav={selectedProductForModal ? favorites.includes(selectedProductForModal.id) : false}
        onToggleFavorite={onToggleFavorite}
        onOpenShare={handleOpenShare}
        onAffiliateClick={handleAffiliateClick}
        isAdmin={isAdmin}
        onOpenPriceUpdate={onOpenPriceUpdate}
        onSelectPartner={onSelectPartner}
      />

      {/* Share Product & Affiliate Link Modal */}
      {shareProduct && (
        <div
          id="share-modal-backdrop"
          onClick={() => setShareProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            id="share-modal-container"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#131316] border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading-editorial text-lg font-bold text-neutral-900 dark:text-white">
                    Share Recommendation
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Copy affiliate link or share on social platforms
                  </p>
                </div>
              </div>
              <button
                id="close-share-modal-btn"
                onClick={() => setShareProduct(null)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Summary Preview */}
            <div className="flex items-center gap-3.5 my-5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
              <img
                src={shareProduct.imageUrl}
                alt={shareProduct.title}
                className="w-14 h-14 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
                  {shareProduct.store} • {shareProduct.category}
                </span>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                  {shareProduct.title}
                </h4>
                <span className="text-xs font-bold text-neutral-900 dark:text-white">
                  {shareProduct.price}
                </span>
              </div>
            </div>

            {/* Direct Copy Affiliate Link Section */}
            <div className="space-y-2 mb-6">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>Affiliate Link</span>
                {copyStatus && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {copyStatus}
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareProduct.affiliateUrl}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-300 font-mono select-all focus:outline-none"
                />
                <button
                  id="copy-affiliate-link-btn"
                  onClick={() => copyAffiliateLink(shareProduct.affiliateUrl)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap active:scale-95"
                >
                  {copyStatus ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copyStatus ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Social Media Sharing Channels */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                Share directly via
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <a
                  id="share-whatsapp-btn"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Check out this curated recommendation on PickASAP: ${shareProduct.title} (${shareProduct.price})\n\n${shareProduct.affiliateUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp</span>
                </a>

                {/* X (Twitter) */}
                <a
                  id="share-twitter-btn"
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Check out this curated find on PickASAP: "${shareProduct.title}"`
                  )}&url=${encodeURIComponent(shareProduct.affiliateUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="font-bold text-sm">𝕏</span>
                  <span>Twitter / X</span>
                </a>

                {/* Telegram */}
                <a
                  id="share-telegram-btn"
                  href={`https://t.me/share/url?url=${encodeURIComponent(
                    shareProduct.affiliateUrl
                  )}&text=${encodeURIComponent(`Check out ${shareProduct.title} on PickASAP`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-sky-200 dark:border-sky-950/60 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/70 dark:hover:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Telegram</span>
                </a>

                {/* Facebook */}
                <a
                  id="share-facebook-btn"
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    shareProduct.affiliateUrl
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-blue-200 dark:border-blue-950/60 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Facebook</span>
                </a>
              </div>

              {/* Native device share sheet if available */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  id="native-device-share-btn"
                  onClick={() => handleNativeShare(shareProduct)}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>More Device Sharing Options...</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
