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
} from 'lucide-react';
import { Product, CategoryType, StoreType, SortOption } from '../types';
import { database as db } from '../lib/firebase';

interface MagazineViewProps {
  products: Product[];
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  onOpenUpload: () => void;
  isLoggedIn: boolean;
  isLoading?: boolean;
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

// Fast, smooth product card with progressive image loading & fallbacks
const MagazineProductCard: React.FC<{
  product: Product;
  index: number;
  isFav: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenShare: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onAffiliateClick: (e: React.MouseEvent, product: Product) => void;
}> = ({
  product,
  index,
  isFav,
  onToggleFavorite,
  onOpenShare,
  onSelectProduct,
  onAffiliateClick,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <article
      className="group flex flex-col justify-between bg-white dark:bg-[#111318] rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 animate-fade-in"
    >
      {/* Image Container with Store Badge and Favorite Button */}
      <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-neutral-200/50 dark:bg-neutral-800/50 animate-pulse" />
        )}

        {imgError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400">
            <ShoppingBag className="w-10 h-10 mb-2 stroke-[1.2] text-neutral-300 dark:text-neutral-600" />
            <span className="text-xs font-medium text-neutral-500">{product.store} Product</span>
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
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Store Tag */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-sm text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 border border-neutral-200/50 dark:border-neutral-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6E40]" />
          <span>{product.store}</span>
        </div>

        {/* Favorite Heart Button */}
        <button
          id={`fav-btn-${product.id}`}
          onClick={() => onToggleFavorite(product.id)}
          title={isFav ? 'Remove from saved' : 'Save to favorites'}
          className={`absolute top-4 right-4 z-10 w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-sm ${
            isFav
              ? 'bg-rose-500 text-white'
              : 'bg-white/90 dark:bg-neutral-900/90 text-neutral-600 dark:text-neutral-300 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
        </button>

        {/* Discount Badge if available */}
        {product.discountPercent && product.discountPercent > 0 && (
          <div className="absolute bottom-4 left-4 z-10 px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
            {product.discountPercent}% OFF
          </div>
        )}
      </div>

      {/* Editorial Body */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Category and live click count */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-400 mb-2">
            <span className="uppercase tracking-wider font-semibold">
              {product.category}
            </span>
            <span className="font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
              {product.clicksCount || 0} clicks
            </span>
          </div>

          {/* Title */}
          <h3
            onClick={() => onSelectProduct(product)}
            className="font-heading-editorial text-xl font-bold text-neutral-900 dark:text-white leading-snug hover:text-[#FF6E40] transition-colors cursor-pointer"
          >
            {product.title}
          </h3>

          {/* Editorial Paragraph / Description */}
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 font-serif-editorial leading-relaxed line-clamp-3">
            {product.editorialNote || product.description}
          </p>
        </div>

        {/* Price and CTA */}
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-sans text-neutral-900 dark:text-white">
                {product.price}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-neutral-400 line-through">
                  {product.originalPrice}
                </span>
              )}
            </div>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Verified Affiliate Partner
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id={`share-btn-${product.id}`}
              onClick={() => onOpenShare(product)}
              title="Share affiliate link or post to social media"
              className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span>Share</span>
            </button>

            <a
              id={`shop-btn-${product.id}`}
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => onAffiliateClick(e, product)}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5 transition-all shadow active:scale-95 cursor-pointer"
            >
              <span>Shop on {product.store}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
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
        sort === 'price_low' ||
        sort === 'price_high' ||
        sort === 'most_clicked' ||
        sort === 'alphabetical' ||
        sort === 'newest'
      ) {
        return sort as SortOption;
      }
    }
    return 'newest';
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
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'most_clicked') {
          return (b.clicksCount || 0) - (a.clicksCount || 0);
        }
        if (sortBy === 'price_low') {
          const pA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
          const pB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
          return pA - pB;
        }
        if (sortBy === 'price_high') {
          const pA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
          const pB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
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
    if (sortBy !== 'newest') params.set('sort', sortBy);
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
      {/* Editorial Top Hero Section matching Image 1 */}
      <section className="relative w-full border-b border-neutral-100 dark:border-neutral-800/80 overflow-hidden py-16 sm:py-24 px-4 sm:px-6">
        {/* Subtle decorative curved architectural lines as shown in reference Image 1 */}
        <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-15 flex items-center justify-center">
          <svg className="w-full h-full max-w-5xl" viewBox="0 0 1000 400" fill="none">
            <path
              d="M-100 350 C 200 400, 350 200, 600 300 C 850 400, 950 150, 1100 250"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="4 4"
            />
            <path
              d="M-50 280 C 250 340, 450 120, 700 240 C 950 360, 1050 100, 1150 180"
              stroke="currentColor"
              strokeWidth="0.5"
            />
            <circle cx="850" cy="220" r="140" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="850" cy="220" r="180" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 3" />
            <circle cx="150" cy="320" r="100" stroke="currentColor" strokeWidth="0.4" />
          </svg>
        </div>

        <div className="relative max-w-4xl mx-auto text-center z-10">
          <h1 className="font-heading-editorial text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.1] mb-6">
            Welcome to PickASAP
          </h1>

          <div className="max-w-2xl mx-auto text-neutral-600 dark:text-neutral-400 text-base sm:text-lg font-serif-editorial leading-relaxed space-y-4">
            <p>
              A high-end digital shopping magazine bringing you carefully verified product recommendations, exclusive bargains, and authentic affiliate selections from Amazon, Flipkart, and Myntra.
            </p>
            <p className="text-sm font-sans text-neutral-500 dark:text-neutral-400">
              Browse by aesthetic, save your favorites, and click any item to shop directly through our verified affiliate links.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main id="product-catalog-anchor" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search, Filter Bar & Favorites Toggle */}
        <div className="space-y-6 mb-12">
          {/* Quick Hubs & Curations: Flipkart, Amazon, Myntra, Low Cost & Quality */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-neutral-400 font-medium whitespace-nowrap mr-1">Curated Hubs:</span>
            
            <button
              id="hub-all-btn"
              onClick={() => {
                setSelectedStore('All');
                setSortBy('newest');
              }}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap font-medium ${
                selectedStore === 'All' && sortBy === 'newest'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
              }`}
            >
              All Finds
            </button>

            <button
              id="hub-flipkart-btn"
              onClick={() => setSelectedStore(selectedStore === 'Flipkart' ? 'All' : 'Flipkart')}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap font-medium ${
                selectedStore === 'Flipkart'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-semibold'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-blue-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#2874f0]"></span>
              <span>Flipkart Deals</span>
            </button>

            <button
              id="hub-amazon-btn"
              onClick={() => setSelectedStore(selectedStore === 'Amazon' ? 'All' : 'Amazon')}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap font-medium ${
                selectedStore === 'Amazon'
                  ? 'border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-semibold'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-amber-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ff9900]"></span>
              <span>Amazon Finds</span>
            </button>

            <button
              id="hub-myntra-btn"
              onClick={() => setSelectedStore(selectedStore === 'Myntra' ? 'All' : 'Myntra')}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap font-medium ${
                selectedStore === 'Myntra'
                  ? 'border-pink-600 bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800 font-semibold'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-pink-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ff3f6c]"></span>
              <span>Myntra Fashion</span>
            </button>

            <button
              id="hub-low-cost-btn"
              onClick={() => setSortBy(sortBy === 'price_low' ? 'newest' : 'price_low')}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap font-medium ${
                sortBy === 'price_low'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-semibold'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-emerald-300'
              }`}
            >
              <Tag className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Low Cost Products</span>
            </button>

            <button
              id="hub-quality-btn"
              onClick={() => setSortBy(sortBy === 'most_clicked' ? 'newest' : 'most_clicked')}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap font-medium ${
                sortBy === 'most_clicked'
                  ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 font-semibold'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-purple-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Good Quality Picks</span>
            </button>
          </div>

          {/* Top Filter Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="magazine-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands, or notes..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-sm focus:outline-none focus:border-neutral-500 dark:focus:border-neutral-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Controls: Stores, Sort, Favorites */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Store Partner Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-400 font-medium">Store:</span>
                <select
                  id="filter-store-select"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value as StoreType)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:outline-none cursor-pointer"
                >
                  {STORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-400 font-medium">Sort:</span>
                <select
                  id="filter-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="most_clicked">Most Popular (Clicks)</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="alphabetical">Title A-Z</option>
                </select>
              </div>

              {/* Save to Favorites toggle */}
              <button
                id="filter-favorites-toggle"
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  onlyFavorites
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    onlyFavorites ? 'fill-rose-500 text-rose-500' : 'text-neutral-500'
                  }`}
                />
                <span>Saved Favorites ({favorites.length})</span>
              </button>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-100 dark:border-neutral-800/60 pt-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer font-medium ${
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-sm'
                      : 'bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
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
          /* Strictly adhering to user prompt: "Don't add any product by yourself (AI) let the page be empty, once the website is ready i will upload my affiliate links." */
          <div className="py-20 px-6 max-w-2xl mx-auto text-center rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/20">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white dark:bg-neutral-800 shadow-sm border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center text-neutral-400">
              <ShoppingBag className="w-8 h-8 stroke-[1.2]" />
            </div>

            <span className="text-[10px] font-mono tracking-widest uppercase text-[#FF6E40] font-bold">
              Ready For Your Affiliate Links
            </span>

            <h2 className="font-heading-editorial text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white mt-2 mb-4">
              The Catalog Is Ready For Your Curations
            </h2>

            <div className="text-neutral-600 dark:text-neutral-400 font-serif-editorial text-base sm:text-lg leading-relaxed space-y-4 mb-8">
              <p>
                As requested, no artificial products have been populated. The catalog is pristine and ready for you to upload your genuine affiliate links from Amazon, Flipkart, and Myntra.
              </p>
              <p className="text-sm font-sans text-neutral-500">
                Click the button below or in the top navigation to sign in and publish your first product with real-time click tracking.
              </p>
            </div>

            <button
              id="empty-state-upload-cta-btn"
              onClick={onOpenUpload}
              className="px-6 py-3 rounded-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs uppercase tracking-widest font-semibold inline-flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#FF6E40]" />
              <span>{isLoggedIn ? 'Add Affiliate Link (+)' : 'Add Your Own Affiliate Link'}</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center">
            <h3 className="font-serif-editorial text-xl text-neutral-700 dark:text-neutral-300">
              No products match your current filters.
            </h3>
            <p className="text-xs text-neutral-400 mt-2">
              Try adjusting your search query, category, or store filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedStore('All');
                setOnlyFavorites(false);
              }}
              className="mt-4 text-xs font-semibold text-[#FF6E40] hover:underline cursor-pointer"
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
                onSelectProduct={setSelectedProductForModal}
                onAffiliateClick={handleAffiliateClick}
              />
            ))}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProductForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-white rounded-3xl w-full max-w-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="relative aspect-[16/9] bg-neutral-100 dark:bg-neutral-900">
              <img
                src={selectedProductForModal.imageUrl}
                alt={selectedProductForModal.title}
                className="w-full h-full object-contain p-6"
              />
              <button
                onClick={() => setSelectedProductForModal(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-black"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold">
                  {selectedProductForModal.store}
                </span>
                <span className="text-xs text-neutral-400">
                  {selectedProductForModal.category}
                </span>
              </div>
              <h2 className="font-heading-editorial text-2xl font-bold">
                {selectedProductForModal.title}
              </h2>
              <div className="text-sm font-serif-editorial leading-relaxed text-neutral-600 dark:text-neutral-300 whitespace-pre-line space-y-4">
                <p>
                  {selectedProductForModal.editorialNote || selectedProductForModal.description}
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4">
                <div>
                  <span className="text-2xl font-bold font-sans">
                    {selectedProductForModal.price}
                  </span>
                  {selectedProductForModal.originalPrice && (
                    <span className="text-xs text-neutral-400 line-through ml-2">
                      {selectedProductForModal.originalPrice}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    id={`detail-share-btn-${selectedProductForModal.id}`}
                    onClick={() => handleOpenShare(selectedProductForModal)}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                  <a
                    href={selectedProductForModal.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleAffiliateClick(e, selectedProductForModal)}
                    className="px-6 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-semibold text-xs flex items-center gap-2 cursor-pointer shadow"
                  >
                    <span>Shop on {selectedProductForModal.store}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
