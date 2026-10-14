import { PriceSnapshot, PriceMilestone } from '../types';
import initialProductsRaw from '../data/initialProducts.json';

export type TimeRangeOption = '30d' | '90d' | '180d' | '1y' | 'all';

export interface BuyingVerdict {
  rating: 'lowest' | 'good' | 'wait';
  badge: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  title: string;
  description: string;
  savingsAmount: number;
  expectedSalePrice: number;
  dropProbability: number;
}

export interface AccuratePriceStats {
  currentPrice: number;
  lowestPrice: number;
  lowestDate: string;
  lowestEvent: string;
  highestPrice: number;
  highestDate: string;
  highestEvent: string;
  averagePrice: number;
  periodAverage: number;
  dropFromHighest: number;
  dropPercentFromHighest: number;
  dropFromAverage: number;
  totalObservations: number;
  volatility: 'Low (Stable)' | 'Moderate' | 'High (Frequent Sales)';
  buyingVerdict: BuyingVerdict;
  timeRange: TimeRangeOption;
}

export interface PriceAlert {
  productId: string;
  targetPrice: number;
  createdAt: string;
  email?: string;
  active: boolean;
}

const STORAGE_PRICE_ALERTS = 'pickasap_price_alerts_v1';
const STORAGE_PRICE_HISTORY_PREFIX = 'pickasap_price_history_v6_';

/**
 * Format currency with Indian rupee numbering (e.g. ₹1,30,999)
 */
export const formatPriceInr = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '₹0';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
  return '₹' + num.toLocaleString('en-IN');
};

/**
 * Format date in clean Buyhatke-style readable format: "15 Oct 2024"
 */
export const formatReadableDate = (dateStr: string | number): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
};

/**
 * Filter snapshots strictly according to chosen time range
 */
export const filterSnapshotsByRange = (
  snapshots: PriceSnapshot[],
  range: TimeRangeOption
): PriceSnapshot[] => {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];
  if (range === 'all') return snapshots;

  const now = Date.now();
  let days = 30;
  if (range === '90d') days = 90;
  else if (range === '180d') days = 180;
  else if (range === '1y') days = 365;

  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const inRange = snapshots.filter((s) => new Date(s.recordedAt).getTime() >= cutoff);

  // If filtered range has at least 2 points, use it; otherwise provide at least the baseline
  if (inRange.length >= 2) return inRange;
  return snapshots;
};

/**
 * Calculate full Buyhatke-grade statistical metrics and buying advice
 */
export const calculatePriceStats = (
  snapshots: PriceSnapshot[],
  range: TimeRangeOption = 'all',
  activePrice?: number
): AccuratePriceStats => {
  const current =
    typeof activePrice === 'number' && activePrice > 0
      ? activePrice
      : snapshots.length > 0
      ? snapshots[snapshots.length - 1].price
      : 0;

  if (!snapshots || snapshots.length === 0) {
    const fallbackVerdict: BuyingVerdict = {
      rating: 'good',
      badge: 'Verified Listing',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      badgeBorder: 'border-emerald-300 dark:border-emerald-800',
      title: 'Current Listed Price Tracked',
      description: 'Real-time price tracking is active. Automated tracking monitors price drops.',
      savingsAmount: 0,
      expectedSalePrice: current,
      dropProbability: 35,
    };

    return {
      currentPrice: current,
      lowestPrice: current,
      lowestDate: new Date().toISOString(),
      lowestEvent: 'Active Listing',
      highestPrice: current,
      highestDate: new Date().toISOString(),
      highestEvent: 'Active Listing',
      averagePrice: current,
      periodAverage: current,
      dropFromHighest: 0,
      dropPercentFromHighest: 0,
      dropFromAverage: 0,
      totalObservations: 0,
      volatility: 'Low (Stable)',
      buyingVerdict: fallbackVerdict,
      timeRange: range,
    };
  }

  // All-time metrics across complete genuine lifetime
  const allPrices = snapshots.map((s) => s.price);
  const allLowestPrice = Math.min(...allPrices);
  const allHighestPrice = Math.max(...allPrices);
  const allLowestSnap = snapshots.find((s) => s.price === allLowestPrice) || snapshots[0];
  const allHighestSnap = snapshots.find((s) => s.price === allHighestPrice) || snapshots[0];
  const allSum = allPrices.reduce((acc, p) => acc + p, 0);
  const allAverage = Math.round(allSum / allPrices.length);

  // Range-specific metrics
  const rangeSnaps = filterSnapshotsByRange(snapshots, range);
  const rangePrices = rangeSnaps.map((s) => s.price);
  const periodSum = rangePrices.reduce((acc, p) => acc + p, 0);
  const periodAverage = Math.round(periodSum / rangePrices.length);

  // Drop calculations
  const dropFromHighest = Math.max(0, allHighestPrice - current);
  const dropPercentFromHighest =
    allHighestPrice > 0 ? Math.round((dropFromHighest / allHighestPrice) * 100) : 0;
  const dropFromAverage = periodAverage - current;

  // Volatility classification (Buyhatke style)
  let volatility: 'Low (Stable)' | 'Moderate' | 'High (Frequent Sales)' = 'Moderate';
  if (snapshots.length <= 4 || allHighestPrice - allLowestPrice < allHighestPrice * 0.1) {
    volatility = 'Low (Stable)';
  } else if (allHighestPrice - allLowestPrice > allHighestPrice * 0.3) {
    volatility = 'High (Frequent Sales)';
  }

  // Buying Verdict Determination (Buyhatke Price Health Algorithm)
  let buyingVerdict: BuyingVerdict;
  const isNearAllTimeLow = current <= allLowestPrice * 1.04; // within 4% of all-time low
  const isBelowAverage = current < periodAverage;

  if (isNearAllTimeLow) {
    buyingVerdict = {
      rating: 'lowest',
      badge: '🔥 All-Time Lowest Price',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      badgeBorder: 'border-emerald-300 dark:border-emerald-800',
      title: 'Best Time to Buy — At Lowest Price Ever!',
      description: `This product is currently listed at ${formatPriceInr(current)}, which matches or is within 4% of its all-time record lowest price (${formatPriceInr(allLowestPrice)} on ${formatReadableDate(allLowestSnap.recordedAt)}). Historical tracking shows high likelihood of price rebound once promotional inventory runs out.`,
      savingsAmount: dropFromHighest,
      expectedSalePrice: allLowestPrice,
      dropProbability: 10,
    };
  } else if (isBelowAverage) {
    buyingVerdict = {
      rating: 'good',
      badge: '✓ Good Value — Below Average',
      badgeBg: 'bg-sky-500/10 dark:bg-sky-950/40',
      badgeText: 'text-sky-700 dark:text-sky-400',
      badgeBorder: 'border-sky-300 dark:border-sky-800',
      title: 'Good Price to Buy Now',
      description: `Currently priced at ${formatPriceInr(current)}, which is ${formatPriceInr(Math.abs(dropFromAverage))} below the average price of ${formatPriceInr(periodAverage)}. You are receiving verified promotional savings of ${dropPercentFromHighest}% off the maximum price.`,
      savingsAmount: Math.abs(dropFromAverage),
      expectedSalePrice: allLowestPrice,
      dropProbability: 45,
    };
  } else {
    buyingVerdict = {
      rating: 'wait',
      badge: '⏳ Consider Waiting for Sale',
      badgeBg: 'bg-amber-500/10 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-400',
      badgeBorder: 'border-amber-300 dark:border-amber-800',
      title: 'Price is Higher Than Average',
      description: `Currently priced at ${formatPriceInr(current)}, which is above the historical average benchmark (${formatPriceInr(periodAverage)}). During major sale events, this item dropped as low as ${formatPriceInr(allLowestPrice)}. Set a Price Drop Alert to buy when it drops.`,
      savingsAmount: 0,
      expectedSalePrice: allLowestPrice,
      dropProbability: 80,
    };
  }

  return {
    currentPrice: current,
    lowestPrice: allLowestPrice,
    lowestDate: allLowestSnap.recordedAt,
    lowestEvent: allLowestSnap.note || allLowestSnap.source || 'Sale Discount',
    highestPrice: allHighestPrice,
    highestDate: allHighestSnap.recordedAt,
    highestEvent: allHighestSnap.note || allHighestSnap.source || 'Launch / MRP',
    averagePrice: allAverage,
    periodAverage,
    dropFromHighest,
    dropPercentFromHighest,
    dropFromAverage,
    totalObservations: snapshots.length,
    volatility,
    buyingVerdict,
    timeRange: range,
  };
};

/**
 * Get authentic, verified price snapshots for a product from initial catalog
 */
export const getAccurateCatalogPriceHistory = (productId: string): PriceSnapshot[] => {
  const allProducts = initialProductsRaw as any[];
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return [];

  const points = Array.isArray(product.priceHistory) ? product.priceHistory : [];
  if (points.length === 0) return [];

  const snaps: PriceSnapshot[] = points
    .filter((p: any) => p && p.price > 0 && p.date)
    .map((p: any, idx: number) => {
      const dateObj = new Date(p.date);
      const timeStamp = isNaN(dateObj.getTime()) ? idx * 86400000 : dateObj.getTime();
      const isoRecorded = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
      return {
        id: `snap_hist_${productId}_${idx}_${timeStamp}`,
        productId,
        price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price).replace(/[^0-9.]/g, '')) || 0,
        recordedAt: isoRecorded,
        source: p.source || 'Verified Archive',
        sourceUrl: p.sourceUrl || product.productUrl || product.affiliateUrl,
        evidence: p.evidence,
        note: p.note || 'Recorded verified price',
        dropPercentage: p.dropPercentage,
        isLowest: Boolean(p.isLowest),
        isHighest: Boolean(p.isHighest),
      };
    });

  snaps.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  // Ensure dataset reaches today with active listed price
  const activeCurrent =
    typeof product.currentPrice === 'number' && product.currentPrice > 0
      ? product.currentPrice
      : typeof product.price === 'string'
      ? parseFloat(product.price.replace(/[^0-9.]/g, '')) || 0
      : 0;

  if (activeCurrent > 0) {
    const todayIso = new Date().toISOString();
    const todayStr = todayIso.split('T')[0];
    const last = snaps[snaps.length - 1];
    const lastDateStr = last ? new Date(last.recordedAt).toISOString().split('T')[0] : '';

    if (lastDateStr !== todayStr) {
      const allPrices = snaps.map((s) => s.price);
      snaps.push({
        id: `snap_today_${productId}`,
        productId,
        price: activeCurrent,
        recordedAt: todayIso,
        source: product.store || 'Active Listing',
        sourceUrl: product.productUrl || product.affiliateUrl,
        note: 'Current active listed price',
        isLowest: activeCurrent <= Math.min(...allPrices),
        isHighest: activeCurrent >= Math.max(...allPrices),
      });
    }
  }

  return snaps;
};

/**
 * Manage Target Price Alerts (Local Persistence)
 */
export const getPriceAlert = (productId: string): PriceAlert | null => {
  try {
    const raw = localStorage.getItem(STORAGE_PRICE_ALERTS);
    if (!raw) return null;
    const list: PriceAlert[] = JSON.parse(raw);
    return list.find((a) => a.productId === productId && a.active) || null;
  } catch {
    return null;
  }
};

export const savePriceAlert = (alert: PriceAlert): void => {
  try {
    const raw = localStorage.getItem(STORAGE_PRICE_ALERTS);
    let list: PriceAlert[] = raw ? JSON.parse(raw) : [];
    list = list.filter((a) => a.productId !== alert.productId);
    list.push(alert);
    localStorage.setItem(STORAGE_PRICE_ALERTS, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving price alert:', e);
  }
};

export const removePriceAlert = (productId: string): void => {
  try {
    const raw = localStorage.getItem(STORAGE_PRICE_ALERTS);
    if (!raw) return;
    let list: PriceAlert[] = JSON.parse(raw);
    list = list.filter((a) => a.productId !== productId);
    localStorage.setItem(STORAGE_PRICE_ALERTS, JSON.stringify(list));
  } catch (e) {
    console.warn('Error removing price alert:', e);
  }
};
