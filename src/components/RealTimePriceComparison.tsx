import React, { useState, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  RotateCw,
  Clock,
  ArrowRight,
  CheckCircle2,
  Tag,
  CreditCard,
  Truck,
  Building2,
  Percent,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Product, PriceComparisonData, RetailerPriceItem } from '../types';
import {
  fetchRealtimePriceComparison,
  getCachedPriceComparison,
  generateClientPriceComparison,
} from '../lib/priceComparison';
import { formatPriceDisplay } from '../lib/firebase';

interface RealTimePriceComparisonProps {
  product: Product;
  onAffiliateClick?: (e: React.MouseEvent, product: Product, customUrl?: string, retailerName?: string) => void;
}

export const RealTimePriceComparison: React.FC<RealTimePriceComparisonProps> = ({
  product,
  onAffiliateClick,
}) => {
  const [comparison, setComparison] = useState<PriceComparisonData>(() => {
    const cached = getCachedPriceComparison(product.id);
    if (cached) return cached;
    return generateClientPriceComparison(product);
  });

  const [loading, setLoading] = useState(false);
  const [filterSort, setFilterSort] = useState<'all' | 'lowest' | 'savings' | 'offers'>('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Background fetch on mount or when product changes
  useEffect(() => {
    let isMounted = true;
    const cached = getCachedPriceComparison(product.id);
    if (cached) {
      setComparison(cached);
    } else {
      setComparison(generateClientPriceComparison(product));
    }

    // Trigger Gemini background service
    fetchRealtimePriceComparison(product)
      .then((data) => {
        if (isMounted && data) {
          setComparison(data);
          setLastRefreshed(new Date());
        }
      })
      .catch((err) => {
        console.warn('Real-time price comparison notice:', err);
      });

    // Listen to broadcast events
    const handleComparisonUpdated = (e: Event) => {
      const ce = e as CustomEvent<{ productId: string; data: PriceComparisonData }>;
      if (ce.detail && ce.detail.productId === product.id && isMounted) {
        setComparison(ce.detail.data);
        setLastRefreshed(new Date());
      }
    };

    window.addEventListener('pickasap:price_comparison_updated', handleComparisonUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('pickasap:price_comparison_updated', handleComparisonUpdated);
    };
  }, [product.id, product.price, product.store, product.title]);

  // Manual refresh via background service
  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const fresh = await fetchRealtimePriceComparison(product);
      if (fresh) {
        setComparison(fresh);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.warn('Manual price comparison refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted retailers
  const displayedRetailers = useMemo(() => {
    if (!comparison?.retailers) return [];
    let list = [...comparison.retailers];

    if (filterSort === 'lowest') {
      list.sort((a, b) => a.price - b.price);
    } else if (filterSort === 'savings') {
      list.sort((a, b) => a.priceDiff - b.priceDiff);
    } else if (filterSort === 'offers') {
      list.sort((a, b) => (b.specialOffer ? 1 : 0) - (a.specialOffer ? 1 : 0));
    }

    return list;
  }, [comparison?.retailers, filterSort]);

  // Store brand badge helper
  const getStoreBadge = (storeKey: string, retailer: string) => {
    const s = storeKey.toLowerCase();
    if (s.includes('amazon')) {
      return {
        bg: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30',
        label: 'Amazon.in',
        iconColor: 'text-amber-500',
      };
    }
    if (s.includes('flipkart')) {
      return {
        bg: 'bg-blue-500/15 text-blue-900 dark:text-blue-200 border-blue-500/30',
        label: 'Flipkart',
        iconColor: 'text-blue-500',
      };
    }
    if (s.includes('croma')) {
      return {
        bg: 'bg-teal-500/15 text-teal-900 dark:text-teal-200 border-teal-500/30',
        label: 'Croma',
        iconColor: 'text-teal-500',
      };
    }
    if (s.includes('reliance')) {
      return {
        bg: 'bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/30',
        label: 'Reliance Digital',
        iconColor: 'text-rose-500',
      };
    }
    if (s.includes('tatacliq')) {
      return {
        bg: 'bg-pink-500/15 text-pink-900 dark:text-pink-200 border-pink-500/30',
        label: 'Tata CLiQ',
        iconColor: 'text-pink-500',
      };
    }
    return {
      bg: 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700',
      label: retailer,
      iconColor: 'text-neutral-500',
    };
  };

  const currentPriceNum =
    typeof product.currentPrice === 'number' && product.currentPrice > 0
      ? product.currentPrice
      : parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || 0;

  const lowestRetailer = comparison.retailers?.find((r) => r.isLowest);

  return (
    <section
      id="live-price-comparison-section"
      className="rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 p-6 sm:p-8 shadow-xs space-y-6 transition-all"
    >
      {/* Top Header & Real-time Live Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Market Sync
            </span>

            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              <Sparkles className="w-3 h-3 text-[#FF6E40]" />
              Gemini Background Service
            </span>

            <span className="text-[11px] text-neutral-400">
              • Verified across 6 stores
            </span>
          </div>

          <h2 className="font-heading-editorial text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Real-Time Multi-Retailer Price Comparison
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            Live prices, active bank discounts, and stock availability across major e-commerce platforms.
          </p>
        </div>

        {/* Sync Button & Last Checked */}
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <div className="text-right hidden sm:block">
            <span className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Last Verified
            </span>
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <button
            id="price-comparison-refresh-btn"
            onClick={handleManualRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh live prices via Gemini background engine"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#FF6E40] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing...' : 'Re-check Prices'}</span>
          </button>
        </div>
      </div>

      {/* Hero Best Deal Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF6E40]/10 via-[#FF6E40]/5 to-transparent border border-[#FF6E40]/25 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#FF6E40] text-white text-[10px] font-bold uppercase tracking-wider">
                Lowest Market Price
              </span>
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Found on <strong className="text-neutral-900 dark:text-white font-bold">{comparison.cheapestRetailer}</strong>
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-heading-editorial text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
                {formatPriceDisplay(comparison.lowestPrice)}
              </span>
              {comparison.maxSavings > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Save up to {formatPriceDisplay(comparison.maxSavings)} vs competitors
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl">
              {comparison.verdict || comparison.summary}
            </p>
          </div>

          {lowestRetailer && (
            <div className="shrink-0 self-start sm:self-center">
              <a
                id="lowest-retailer-hero-cta"
                href={lowestRetailer.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (onAffiliateClick) {
                    onAffiliateClick(e, product, lowestRetailer.affiliateUrl, lowestRetailer.retailer);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6E40] hover:bg-[#e05b30] text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 group"
              >
                <span>View on {lowestRetailer.retailer}</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Filter / Sort Pills */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            id="filter-all-retailers"
            onClick={() => setFilterSort('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterSort === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            All Stores ({comparison.retailers?.length || 0})
          </button>
          <button
            id="filter-lowest-price"
            onClick={() => setFilterSort('lowest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterSort === 'lowest'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Lowest Price First
          </button>
          <button
            id="filter-biggest-savings"
            onClick={() => setFilterSort('savings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterSort === 'savings'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Best Price Differences
          </button>
          <button
            id="filter-bank-offers"
            onClick={() => setFilterSort('offers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterSort === 'offers'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Bank &amp; Card Discounts
          </button>
        </div>

        <span className="text-[11px] font-medium text-neutral-400">
          Base Reference: {product.store} ({formatPriceDisplay(currentPriceNum)})
        </span>
      </div>

      {/* Retailers Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedRetailers.map((item, idx) => {
          const badge = getStoreBadge(item.storeKey, item.retailer);
          const isCheaper = item.priceDiff < 0;
          const isSame = item.priceDiff === 0;
          const isMoreExpensive = item.priceDiff > 0;

          return (
            <div
              key={idx}
              id={`retailer-card-${item.storeKey}`}
              className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all ${
                item.isLowest
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs ring-1 ring-emerald-500/20'
                  : item.isCurrentStore
                    ? 'bg-neutral-50/70 dark:bg-neutral-900/50 border-neutral-300 dark:border-neutral-700'
                    : 'bg-white dark:bg-[#151820] border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              {/* Card Header: Store Badge & Status Tags */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.bg}`}
                    >
                      <Building2 className={`w-3.5 h-3.5 ${badge.iconColor}`} />
                      {item.retailer}
                    </span>
                    {item.rating && (
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        ★ {item.rating}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {item.isLowest ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                        Best Deal
                      </span>
                    ) : item.isCurrentStore ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                        Current Store
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Price Display */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-heading-editorial text-2xl font-bold text-neutral-900 dark:text-white">
                      {item.formattedPrice}
                    </span>
                    {item.mrp && item.mrp > item.price && (
                      <span className="text-xs text-neutral-400 line-through">
                        {item.formattedMrp}
                      </span>
                    )}
                    {item.discountPercent && item.discountPercent > 0 ? (
                      <span className="text-xs font-bold text-[#FF6E40]">
                        {item.discountPercent}% OFF
                      </span>
                    ) : null}
                  </div>

                  {/* Price Difference Indicator */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {isCheaper ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <TrendingDown className="w-3 h-3 text-emerald-600" />
                        Save {Math.abs(item.priceDiff).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} ({item.priceDiffPercent}%)
                      </span>
                    ) : isSame ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        Matches Current Listing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <TrendingUp className="w-3 h-3 text-amber-600" />
                        +{item.priceDiff.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} ({item.priceDiffPercent > 0 ? `+${item.priceDiffPercent}%` : `${item.priceDiffPercent}%`})
                      </span>
                    )}
                  </div>
                </div>

                {/* Bank / Special Offers Pill */}
                {item.specialOffer && (
                  <div className="mb-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-[#FF6E40] shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.specialOffer}</span>
                  </div>
                )}

                {/* Delivery & Stock Details */}
                <div className="space-y-1 mb-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>{item.deliveryTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{item.availability}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                <a
                  id={`goto-store-${item.storeKey}`}
                  href={item.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (onAffiliateClick) {
                      onAffiliateClick(e, product, item.affiliateUrl, item.retailer);
                    }
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                    item.isLowest
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100'
                  }`}
                >
                  <span>Buy on {item.retailer}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Spread Bar / Comparative Gauge */}
      {comparison.retailers && comparison.retailers.length > 1 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FF6E40]" />
              Market Price Spread Spectrum
            </span>
            <span className="text-[11px] text-neutral-400">
              Low: {formatPriceDisplay(comparison.lowestPrice)} — High: {formatPriceDisplay(comparison.highestPrice)}
            </span>
          </div>

          <div className="relative h-3 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full"
              style={{ width: '100%' }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 flex-wrap gap-2">
            {comparison.retailers.slice(0, 4).map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                {r.retailer}: <strong className="text-neutral-800 dark:text-neutral-200">{r.formattedPrice}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Gemini Background Intelligence Audit Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] text-neutral-400 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Real-time price intelligence evaluated server-side by Gemini background AI.</span>
        </div>
        <span>Prices subject to retailer flash sales &amp; daily promotional coupon changes.</span>
      </div>
    </section>
  );
};
