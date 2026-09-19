import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  ExternalLink,
  ShoppingBag,
  Share2,
  Heart,
  BadgeCheck,
  Tag,
  Layers,
  Sparkles,
  Copy,
  Check,
  SlidersHorizontal,
  Calendar,
} from 'lucide-react';
import { Product, CategoryType, StoreType, SortOption } from '../types';
import { formatPriceDisplay, parsePriceToNumber } from '../lib/firebase';
import { getEffectiveDiscount, getBestProductScore } from './MagazineView';

interface AffiliatePartnerProfileProps {
  partner: { id: string; name: string };
  products: Product[];
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  onAffiliateClick: (e: React.MouseEvent, product: Product) => void;
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

export const AffiliatePartnerProfile: React.FC<AffiliatePartnerProfileProps> = ({
  partner,
  products,
  onBack,
  onSelectProduct,
  favorites,
  onToggleFavorite,
  onAffiliateClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [selectedStore, setSelectedStore] = useState<StoreType>('All');
  const [sortBy, setSortBy] = useState<SortOption>('best');
  const [copiedProfileUrl, setCopiedProfileUrl] = useState(false);

  // Filter all products uploaded by this specific affiliate partner
  // Matches by uploaderId or case-insensitive uploaderName for full reliability
  const partnerProducts = useMemo(() => {
    return products.filter((p) => {
      const matchId = partner.id && p.uploaderId === partner.id;
      const matchName =
        p.uploaderName &&
        partner.name &&
        p.uploaderName.trim().toLowerCase() === partner.name.trim().toLowerCase();
      return matchId || matchName;
    });
  }, [products, partner]);

  // Extract metadata stats for this affiliate partner
  const partnerStats = useMemo(() => {
    const storesSet = new Set<string>();
    const categoriesSet = new Set<string>();
    let totalClicks = 0;
    let maxDiscount = 0;

    partnerProducts.forEach((p) => {
      if (p.store) storesSet.add(p.store);
      if (p.category) categoriesSet.add(p.category);
      if (p.clicksCount) totalClicks += p.clicksCount;
      const discount = getEffectiveDiscount(p);
      if (discount > maxDiscount) maxDiscount = discount;
    });

    return {
      totalLinks: partnerProducts.length,
      stores: Array.from(storesSet),
      categories: Array.from(categoriesSet),
      totalClicks,
      maxDiscount,
    };
  }, [partnerProducts]);

  // Compute initials for the partner avatar
  const partnerInitials = useMemo(() => {
    if (!partner.name) return 'AP';
    const parts = partner.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [partner.name]);

  // Search & filter within the partner's uploaded links
  const filteredProducts = useMemo(() => {
    return partnerProducts
      .filter((product) => {
        const matchesSearch =
          searchQuery.trim() === '' ||
          product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.editorialNote?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory =
          selectedCategory === 'All' || product.category === selectedCategory;

        const matchesStore =
          selectedStore === 'All' ||
          (selectedStore === 'Other'
            ? !['Amazon', 'Flipkart', 'Myntra'].includes(product.store)
            : product.store === selectedStore);

        return matchesSearch && matchesCategory && matchesStore;
      })
      .sort((a, b) => {
        const priceA = parsePriceToNumber(a.price);
        const priceB = parsePriceToNumber(b.price);
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();

        if (sortBy === 'best') return getBestProductScore(b) - getBestProductScore(a);
        if (sortBy === 'discount') return getEffectiveDiscount(b) - getEffectiveDiscount(a);
        if (sortBy === 'price-asc') return priceA - priceB;
        if (sortBy === 'price-desc') return priceB - priceA;
        if (sortBy === 'newest') return dateB - dateA;
        if (sortBy === 'popular') return (b.clicksCount || 0) - (a.clicksCount || 0);
        return 0;
      });
  }, [partnerProducts, searchQuery, selectedCategory, selectedStore, sortBy]);

  const handleShareProfile = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        setCopiedProfileUrl(true);
        setTimeout(() => setCopiedProfileUrl(false), 2000);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Top Navigation Bar: Back to Magazine */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <button
          id="partner-back-to-magazine-btn"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-98"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Magazine</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer" onClick={onBack}>
            Magazine
          </span>
          <span>/</span>
          <span className="text-neutral-600 dark:text-neutral-300 font-semibold">
            Affiliate Partner Profile
          </span>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-50/90 dark:bg-[#111318] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm relative overflow-hidden">
        {/* Subtle background decorative accent */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#FF6E40]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar badge */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#FF6E40] to-[#E64A19] text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-[#FF6E40]/25 shrink-0 select-none">
              {partnerInitials}
            </div>

            {/* Partner Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Verified Affiliate Partner
                </span>
                <span className="text-xs text-neutral-400">
                  Curator #{partner.id ? partner.id.slice(-6).toUpperCase() : 'PARTNER'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-heading-editorial">
                {partner.name || 'Affiliate Partner'}
              </h1>

              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-xl">
                Browse all verified affiliate recommendations, price-tracked deals, and curated shopping links shared by this partner.
              </p>
            </div>
          </div>

          {/* Action: Copy Profile Share Link */}
          <div className="flex items-center gap-3 shrink-0 self-stretch md:self-auto justify-end">
            <button
              id="copy-partner-profile-link-btn"
              type="button"
              onClick={handleShareProfile}
              className="w-full md:w-auto px-4 py-3 rounded-2xl border border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
            >
              {copiedProfileUrl ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Profile Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-[#FF6E40]" />
                  <span>Share Partner Profile</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-neutral-200/80 dark:border-neutral-800/80">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block">
              Uploaded Links
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white font-mono mt-0.5 block">
              {partnerStats.totalLinks}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block">
              Stores Linked
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-[#FF6E40] font-mono mt-0.5 block">
              {partnerStats.stores.length || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block">
              Max Savings
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {partnerStats.maxDiscount > 0 ? `${partnerStats.maxDiscount}% OFF` : 'Best MRP'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block">
              Shopper Clicks
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white font-mono mt-0.5 block">
              {partnerStats.totalClicks}
            </span>
          </div>
        </div>
      </div>

      {/* Search, Store, Category & Sort Bar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search inside this partner's uploaded links */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              id="partner-search-links-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${partner.name}'s uploaded links...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-hidden focus:border-[#FF6E40] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <SlidersHorizontal className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="text-xs text-neutral-500 font-medium">Sort by:</span>
            <select
              id="partner-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort affiliate partner links"
              className="py-2 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:border-[#FF6E40]"
            >
              <option value="best">Best Deals First</option>
              <option value="discount">Biggest Discount</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="newest">Newest Uploaded</option>
              <option value="popular">Most Clicked</option>
            </select>
          </div>
        </div>

        {/* Store & Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Store Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mr-1">
              Store:
            </span>
            {STORES.map((store) => (
              <button
                key={store}
                type="button"
                onClick={() => setSelectedStore(store)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedStore === store
                    ? 'bg-[#FF6E40] text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {store}
              </button>
            ))}
          </div>

          {/* Result Count Indicator */}
          <div className="text-xs text-neutral-400">
            Showing <strong className="text-neutral-800 dark:text-neutral-200">{filteredProducts.length}</strong> of{' '}
            {partnerProducts.length} links uploaded
          </div>
        </div>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 space-y-3">
          <ShoppingBag className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
            No matching links found
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {partnerProducts.length === 0
              ? `No active affiliate links have been uploaded by ${partner.name} yet.`
              : `No links uploaded by ${partner.name} matched your search or filter criteria.`}
          </p>
          {(searchQuery || selectedCategory !== 'All' || selectedStore !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedStore('All');
              }}
              className="mt-2 text-xs font-semibold text-[#FF6E40] hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {filteredProducts.map((product) => {
            const isFav = favorites.includes(product.id);
            const effectiveDiscount = getEffectiveDiscount(product);

            return (
              <article
                key={product.id}
                className="group flex flex-col justify-between bg-white dark:bg-[#111318] rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300"
              >
                {/* Image Container with Store Badge and Favorite Button */}
                <div
                  onClick={() => onSelectProduct(product)}
                  className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center cursor-pointer group/image"
                >
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    loading="lazy"
                    className="w-full h-full object-contain p-4 group-hover/image:scale-105 transition-transform duration-500"
                  />

                  {/* Store Badge */}
                  <span className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-white/95 dark:bg-black/90 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
                    {product.store}
                  </span>

                  {/* Discount Badge */}
                  {effectiveDiscount > 0 && (
                    <span className="absolute top-4 right-14 z-10 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-sm">
                      {effectiveDiscount}% OFF
                    </span>
                  )}

                  {/* Favorite Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(product.id);
                    }}
                    title={isFav ? 'Remove from favorites' : 'Save to favorites'}
                    className={`absolute top-4 right-4 z-10 w-8.5 h-8.5 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-90 shadow-sm ${
                      isFav
                        ? 'bg-red-500 text-white'
                        : 'bg-white/90 dark:bg-black/80 text-neutral-600 dark:text-neutral-300 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {/* Category */}
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
                        {product.category}
                      </span>
                      {product.clicksCount !== undefined && product.clicksCount > 0 && (
                        <span className="text-[11px] font-mono text-neutral-400">
                          {product.clicksCount} clicks
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => onSelectProduct(product)}
                      className="font-sans font-bold text-neutral-900 dark:text-white text-base sm:text-lg leading-snug line-clamp-2 hover:text-[#FF6E40] dark:hover:text-[#FF6E40] transition-colors cursor-pointer"
                    >
                      {product.title}
                    </h3>

                    {/* Editorial Note / Description */}
                    {product.editorialNote && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 italic">
                        "{product.editorialNote}"
                      </p>
                    )}
                  </div>

                  {/* Pricing and Action Footer */}
                  <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-sans text-neutral-900 dark:text-white">
                          {formatPriceDisplay(product.price)}
                        </span>
                        {(product.originalPrice || product.mrp) &&
                          (product.originalPrice || product.mrp) !== product.price && (
                            <span className="text-xs text-neutral-400 line-through">
                              {formatPriceDisplay(product.originalPrice || product.mrp)}
                            </span>
                          )}
                      </div>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        By {product.uploaderName || partner.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        id={`partner-shop-btn-${product.id}`}
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => onAffiliateClick(e, product)}
                        className="px-4 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#e05b30] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-[#FF6E40]/25 transition-all cursor-pointer active:scale-95 shrink-0"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Shop</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
