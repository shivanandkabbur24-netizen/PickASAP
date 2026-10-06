import { PriceIntelligenceData, PriceSnapshot, PriceMilestone, PriceHistoryPoint } from '../types';
import { databaseService, getStoredPriceHistory, setStoredPriceHistory } from './firebase';

const CACHE_PREFIX = 'pickasap_price_intel_v2_';

// Client-side Product Baseline Generator (strictly product-specific; NEVER a shared template curve or fake history)
export function generateClientPriceHistory(product: {
  id: string;
  title: string;
  brand?: string;
  modelIdentifier?: string;
  asin?: string;
  price?: string;
  currentPrice?: number;
  originalPrice?: string;
  mrp?: string;
  discount?: number;
  discountPercent?: number;
  store?: string;
  currency?: string;
  priceHistory?: PriceHistoryPoint[];
  priceIntelligence?: PriceIntelligenceData;
}): PriceIntelligenceData {
  const currency = product.currency || '₹';
  const parseNum = (val: any): number => {
    if (typeof val === 'number' && !isNaN(val)) return Math.round(val);
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
  };

  const current =
    product.currentPrice && product.currentPrice > 0
      ? product.currentPrice
      : parseNum(product.price) || 0;

  const formatPrice = (p: number) => `${currency}${p.toLocaleString('en-IN')}`;

  // If the product has authentic sourced history points
  if (Array.isArray(product.priceHistory) && product.priceHistory.length > 1) {
    const prices = product.priceHistory.map((p) => p.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const avg = Math.round(prices.reduce((sum, v) => sum + v, 0) / prices.length);
    const lastPrice = product.priceHistory[product.priceHistory.length - 1].price || current;

    return {
      productId: product.id,
      productName: product.title || 'Verified Product',
      productTitle: product.title || 'Verified Product',
      currentPrice: lastPrice,
      formattedCurrentPrice: formatPrice(lastPrice),
      lowestPrice: low,
      formattedLowestPrice: formatPrice(low),
      highestPrice: high,
      formattedHighestPrice: formatPrice(high),
      averagePrice: avg,
      formattedAveragePrice: formatPrice(avg),
      currency,
      isHistoricalDataAvailable: true,
      uncertaintyNote: null,
      summaryNote: `Verified product-specific price trajectory ranging from ${formatPrice(low)} to ${formatPrice(high)}.`,
      priceHistory: product.priceHistory,
      milestones: product.priceHistory.map((p) => ({
        date: p.date,
        price: p.price,
        formattedPrice: formatPrice(p.price),
        source: p.source,
        sourceUrl: p.sourceUrl,
        note: p.note || 'Verified historical observation',
        dropPercentage: high > p.price ? `${Math.round(((high - p.price) / high) * 100)}% drop` : undefined,
        isLowest: p.price === low,
        isHighest: p.price === high,
      })),
    };
  }

  // When no verified historical records exist: clearly state historical data is unavailable
  // NEVER generate or invent fake historical prices or dates
  return {
    productId: product.id,
    productName: product.title || 'Curated Product',
    productTitle: product.title || 'Curated Product',
    currentPrice: current,
    formattedCurrentPrice: formatPrice(current),
    lowestPrice: current,
    formattedLowestPrice: formatPrice(current),
    highestPrice: current,
    formattedHighestPrice: formatPrice(current),
    averagePrice: current,
    formattedAveragePrice: formatPrice(current),
    currency,
    isHistoricalDataAvailable: false,
    uncertaintyNote: 'Historical price data is unavailable from verified sources for this specific product listing.',
    summaryNote: `Current verified listing price is ${formatPrice(current)}. Real-time tracking is active.`,
    priceHistory: [],
    milestones: [],
  };
}

export function getCachedPriceIntelligence(productId: string): PriceIntelligenceData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${productId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.productId === productId) {
        // Discard any legacy mock/fake test datasets
        const points = Array.isArray(parsed.priceHistory) ? parsed.priceHistory : [];
        const hasLegacyFakes = points.some((p: any) =>
          p.note?.includes('Monsoon Kitchen Days') ||
          p.note?.includes('Standard retail pricing prior to mid-year sales') ||
          p.note?.includes('Recent weekend price point') ||
          p.note?.includes('Mid-season promotional pricing') ||
          p.note?.includes('Standard list price prior to mid-year sales')
        );
        if (hasLegacyFakes) {
          localStorage.removeItem(`${CACHE_PREFIX}${productId}`);
          return null;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading cached price intelligence:', err);
  }
  return null;
}

export function saveCachedPriceIntelligence(productId: string, data: PriceIntelligenceData) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${productId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Error saving cached price intelligence:', err);
  }
}

export async function fetchBackgroundPriceHistory(product: {
  id: string;
  title: string;
  brand?: string;
  modelIdentifier?: string;
  asin?: string;
  affiliateUrl?: string;
  productUrl?: string;
  store?: string;
  currentPrice?: number;
  price?: string;
  originalPrice?: string;
  mrp?: string;
  category?: string;
  description?: string;
  discount?: number;
  discountPercent?: number;
  priceHistory?: PriceHistoryPoint[];
  priceIntelligence?: PriceIntelligenceData;
}): Promise<PriceIntelligenceData | null> {
  const effectiveUrl = product.affiliateUrl || product.productUrl || '';
  const parsedPrice =
    typeof product.currentPrice === 'number' && product.currentPrice > 0
      ? product.currentPrice
      : product.price
        ? parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || 0
        : 0;

  // Helper to store authentic milestones as snapshots in local storage and Firestore
  const syncHistoryToSnapshots = (intel: PriceIntelligenceData) => {
    const points = Array.isArray(intel.priceHistory) && intel.priceHistory.length > 0
      ? intel.priceHistory
      : Array.isArray(intel.milestones) ? intel.milestones : [];

    // ONLY sync if multiple verified historical points exist with sources
    if (intel.isHistoricalDataAvailable && points.length > 1) {
      const newSnapshots: PriceSnapshot[] = points.map((p, idx) => ({
        id: `snap_hist_${product.id}_${idx}_${new Date(p.date).getTime()}`,
        productId: product.id,
        price: p.price,
        recordedAt: new Date(p.date).toISOString(),
        source: p.source || 'background_intelligence',
        sourceUrl: p.sourceUrl,
        note: p.note || 'Recorded verified price',
        dropPercentage: p.dropPercentage,
        isLowest: p.isLowest,
        isHighest: p.isHighest,
      }));

      newSnapshots.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
      setStoredPriceHistory(product.id, newSnapshots);
      // Persist to Firestore cloud database isolated under products/{productId}/priceHistory
      databaseService.savePriceHistoryBatch(product.id, newSnapshots);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pickasap:price_snapshot_added', {
            detail: { productId: product.id, snapshots: newSnapshots },
          })
        );
      }
    }
  };

  // 1. If product object itself carries verified price intelligence, use and sync it immediately
  if (product.priceIntelligence && product.priceIntelligence.isHistoricalDataAvailable) {
    saveCachedPriceIntelligence(product.id, product.priceIntelligence);
    syncHistoryToSnapshots(product.priceIntelligence);
    return product.priceIntelligence;
  }

  // 2. Check if cached intelligence already exists for this exact product ID
  const cachedIntel = getCachedPriceIntelligence(product.id);
  if (cachedIntel && cachedIntel.isHistoricalDataAvailable) {
    syncHistoryToSnapshots(cachedIntel);
    return cachedIntel;
  }

  // 3. Fetch from backend / Cloudflare Pages / edge Gemini API with complete product identity
  let fetchedData: PriceIntelligenceData | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('/api/price-history/fetch', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product.id,
        url: effectiveUrl,
        title: product.title,
        brand: product.brand,
        modelIdentifier: product.modelIdentifier,
        asin: product.asin,
        store: product.store,
        currentPrice: parsedPrice,
        category: product.category,
        description: product.description,
      }),
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const json = await response.json();
      if (json.success && json.data) {
        fetchedData = json.data;
      }
    }
  } catch {
    // Gracefully handle network timeouts or offline mode
  }

  // 4. If API returned data, use it; otherwise fallback to cached or independent baseline
  const intelData: PriceIntelligenceData =
    fetchedData ||
    cachedIntel ||
    generateClientPriceHistory(product);

  // Cache the intelligence strictly under this product ID
  saveCachedPriceIntelligence(product.id, intelData);
  syncHistoryToSnapshots(intelData);

  // Broadcast intelligence update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pickasap:price_intel_updated', {
        detail: { productId: product.id, intelligence: intelData },
      })
    );
  }

  return intelData;
}
