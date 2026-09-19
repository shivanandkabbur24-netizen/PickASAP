import { PriceIntelligenceData, PriceSnapshot } from '../types';
import { getStoredPriceHistory, setStoredPriceHistory } from './firebase';

const CACHE_PREFIX = 'pickasap_price_intel_';

export function getCachedPriceIntelligence(productId: string): PriceIntelligenceData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${productId}`);
    if (raw) {
      return JSON.parse(raw);
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
  affiliateUrl?: string;
  productUrl?: string;
  store?: string;
  currentPrice?: number;
  price?: string;
}): Promise<PriceIntelligenceData | null> {
  const effectiveUrl = product.affiliateUrl || product.productUrl || '';
  const parsedPrice =
    typeof product.currentPrice === 'number' && product.currentPrice > 0
      ? product.currentPrice
      : product.price
        ? parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || 0
        : 0;

  try {
    const response = await fetch('/api/price-history/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product.id,
        url: effectiveUrl,
        title: product.title,
        store: product.store,
        currentPrice: parsedPrice,
      }),
    });

    if (!response.ok) {
      throw new Error(`Price fetch failed with status ${response.status}`);
    }

    const json = await response.json();
    if (json.success && json.data) {
      const intelData: PriceIntelligenceData = json.data;

      // Cache the result
      saveCachedPriceIntelligence(product.id, intelData);

      // Persist milestone snapshots to product history so the curve chart is populated
      if (Array.isArray(intelData.milestones) && intelData.milestones.length > 0) {
        const existingSnapshots = getStoredPriceHistory(product.id);

        // If existing history has fewer than 2 snapshots, backfill from verified milestones
        if (existingSnapshots.length <= 1) {
          const newSnapshots: PriceSnapshot[] = intelData.milestones.map((m, idx) => ({
            id: `snap_intel_${product.id}_${idx}_${new Date(m.date).getTime()}`,
            price: m.price,
            recordedAt: new Date(m.date).toISOString(),
            source: 'background_intelligence',
            note: m.note + (m.dropPercentage ? ` (${m.dropPercentage})` : ''),
            dropPercentage: m.dropPercentage,
          }));

          // Sort chronologically ascending for the chart
          newSnapshots.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

          setStoredPriceHistory(product.id, newSnapshots);

          // Broadcast price snapshots update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('pickasap:price_snapshot_added', {
                detail: { productId: product.id, snapshots: newSnapshots },
              })
            );
          }
        }
      }

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
  } catch (err) {
    console.warn('Background price intelligence fetch notice:', err);
  }

  return getCachedPriceIntelligence(product.id);
}
