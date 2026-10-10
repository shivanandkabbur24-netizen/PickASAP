import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingDown,
  Calendar,
  Clock,
  Info,
  ShieldCheck,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  RefreshCw,
  Award,
  Layers,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { PriceSnapshot, PriceIntelligenceData, PriceMilestone } from '../types';
import { databaseService as db, formatPriceDisplay } from '../lib/firebase';
import {
  fetchBackgroundPriceHistory,
  getCachedPriceIntelligence,
  saveCachedPriceIntelligence,
  generateClientPriceHistory,
} from '../lib/priceIntelligence';

interface PriceHistoryChartProps {
  productId: string;
  product?: {
    id: string;
    title: string;
    brand?: string;
    modelIdentifier?: string;
    affiliateUrl?: string;
    productUrl?: string;
    store?: string;
    price?: string;
    currentPrice?: number;
    originalPrice?: string;
    mrp?: string;
    category?: string;
    description?: string;
  };
  currentPrice?: number;
  currency?: string;
  onAdminUpdateClick?: () => void;
  isAdmin?: boolean;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  productId,
  product,
  currentPrice,
  currency = '₹',
  onAdminUpdateClick,
  isAdmin = false,
}) => {
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isResearching, setIsResearching] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'all'>('all');
  const [intelligence, setIntelligence] = useState<PriceIntelligenceData | null>(() => {
    const cached = getCachedPriceIntelligence(productId);
    if (cached && cached.productId === productId && cached.isHistoricalDataAvailable) return cached;
    return null;
  });
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    snapshot: PriceSnapshot;
  } | null>(null);

  // Autonomous background price research trigger (runs automatically without user action)
  const runBackgroundPriceFetch = useCallback(async () => {
    if (!productId) return;
    setRefreshing(true);
    setIsResearching(true);

    try {
      const response = await fetch('/api/price-history/research-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          title: product?.title,
          brand: product?.brand,
          modelIdentifier: product?.modelIdentifier,
          store: product?.store,
          currentPrice: currentPrice || product?.currentPrice,
        }),
      });
      const ct = response.headers.get('content-type') || '';
      if (response.ok && ct.includes('application/json')) {
        const json = await response.json();
        if (json && json.success && json.data) {
          setIntelligence(json.data);
          const points = Array.isArray(json.data.priceHistory) ? json.data.priceHistory : [];
          if (points.length > 0) {
            const snaps: PriceSnapshot[] = points.map((p: any, idx: number) => {
              const dateObj = new Date(p.date);
              const timeStamp = isNaN(dateObj.getTime()) ? idx * 86400000 : dateObj.getTime();
              const isoRecorded = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
              return {
                id: `snap_hist_${productId}_${idx}_${timeStamp}`,
                productId,
                price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
                recordedAt: isoRecorded,
                source: String(p.source || 'verified_intelligence').slice(0, 200),
                sourceUrl: p.sourceUrl ? String(p.sourceUrl).slice(0, 2500) : undefined,
                evidence: p.evidence ? String(p.evidence).slice(0, 1500) : undefined,
                note: p.note ? String(p.note).slice(0, 800) : 'Recorded verified price',
                dropPercentage: p.dropPercentage,
                isLowest: p.isLowest,
                isHighest: p.isHighest,
              };
            });
            setSnapshots(snaps);
            db.savePriceHistoryBatch(productId, snaps);
            saveCachedPriceIntelligence(productId, json.data);
            window.dispatchEvent(
              new CustomEvent('pickasap:price_snapshot_added', {
                detail: { productId, snapshots: snaps },
              })
            );
            return;
          }
        }
      }

      // Direct client fallback
      if (product) {
        const intel = await fetchBackgroundPriceHistory(product);
        if (intel) {
          setIntelligence(intel);
        }
      }
    } catch (err) {
      console.warn('Background price research notice:', err);
      if (product) {
        try {
          const intel = await fetchBackgroundPriceHistory(product);
          if (intel) setIntelligence(intel);
        } catch {}
      }
    } finally {
      setRefreshing(false);
      setIsResearching(false);
    }
  }, [productId, product, currentPrice]);

  // Completely Automatic: If product has no historical points yet, auto-research in background!
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (loading || hasAutoFetchedRef.current || !productId) return;
    const hasHistory =
      snapshots.length > 1 ||
      (intelligence?.isHistoricalDataAvailable && (intelligence.priceHistory?.length ?? 0) > 1);

    if (!hasHistory) {
      hasAutoFetchedRef.current = true;
      runBackgroundPriceFetch();
    }
  }, [loading, productId, snapshots.length, intelligence, runBackgroundPriceFetch]);

  // Real-time listener for price history snapshots of this product from Firestore
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const unsubscribe = db.subscribeToPriceHistory(productId, (data) => {
      if (isMounted) {
        setSnapshots(data);
        setLoading(false);
      }
    });

    // Listen to local optimistic snapshot events
    const handleSnapshotAdded = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; snapshots: PriceSnapshot[] }>;
      if (customEvent.detail && customEvent.detail.productId === productId && isMounted) {
        setSnapshots(customEvent.detail.snapshots);
      }
    };

    // Listen to intelligence update event
    const handleIntelUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; intelligence: PriceIntelligenceData }>;
      if (customEvent.detail && customEvent.detail.productId === productId && isMounted) {
        setIntelligence(customEvent.detail.intelligence);
      }
    };

    window.addEventListener('pickasap:price_snapshot_added', handleSnapshotAdded);
    window.addEventListener('pickasap:price_intel_updated', handleIntelUpdated);

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('pickasap:price_snapshot_added', handleSnapshotAdded);
      window.removeEventListener('pickasap:price_intel_updated', handleIntelUpdated);
    };
  }, [productId, product?.title, product?.price]);

  // Sort snapshots chronologically
  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }, [snapshots]);

  // Determine effective snapshots strictly from THIS product's verified dataset
  // NEVER use a shared template or fabricated wave curve; data must be current till today's date
  const effectiveSnapshots = useMemo(() => {
    const intel = intelligence || getCachedPriceIntelligence(productId);
    const activeCurrentPrice =
      typeof currentPrice === 'number' && currentPrice > 0
        ? currentPrice
        : product?.currentPrice || (product?.price ? parseFloat(String(product.price).replace(/[^0-9.]/g, '')) : 0) || 0;

    const todayIso = new Date().toISOString();
    const todayDateStr = todayIso.split('T')[0];

    let rawSnaps: PriceSnapshot[] = [];

    // 1. If Gemini price intelligence has verified historical points for THIS specific product:
    const intelPoints = intel?.priceHistory;
    if (intel?.isHistoricalDataAvailable && Array.isArray(intelPoints) && intelPoints.length > 0) {
      rawSnaps = intelPoints
        .filter((m: any) => m && m.price > 0 && m.date)
        .map((m: any, idx: number) => ({
          id: `snap_hist_${productId}_${idx}_${new Date(m.date).getTime()}`,
          productId,
          price: m.price,
          recordedAt: new Date(m.date).toISOString(),
          source: m.source || 'verified_intelligence',
          sourceUrl: m.sourceUrl,
          evidence: m.evidence,
          note: m.note || 'Recorded verified price',
          dropPercentage: m.dropPercentage,
          isLowest: m.isLowest,
          isHighest: m.isHighest,
        }));
    } else if (Array.isArray(snapshots) && snapshots.length > 0) {
      // 2. Otherwise check snapshots from Firestore for THIS exact productId
      rawSnaps = snapshots
        .filter((s) => !s.productId || s.productId === productId)
        .filter((s) => s && s.price > 0 && s.recordedAt)
        .map((s) => ({
          ...s,
          evidence: s.evidence,
        }));
    }

    // Sort chronologically
    rawSnaps.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    // CRITICAL: Ensure dataset is completely up to date till today's date!
    // The active listing price must represent today's observation on the graph.
    if (activeCurrentPrice > 0) {
      if (rawSnaps.length === 0) {
        rawSnaps.push({
          id: `snap_today_${productId}`,
          productId,
          price: activeCurrentPrice,
          recordedAt: todayIso,
          source: product?.store || 'Active Store Listing',
          note: 'Current listed price as of today',
          isLowest: true,
          isHighest: true,
        });
      } else {
        const lastSnap = rawSnaps[rawSnaps.length - 1];
        const lastSnapDateStr = new Date(lastSnap.recordedAt).toISOString().split('T')[0];

        // If the last observation is before today, append today's active listed price
        if (lastSnapDateStr !== todayDateStr) {
          rawSnaps.push({
            id: `snap_today_${productId}`,
            productId,
            price: activeCurrentPrice,
            recordedAt: todayIso,
            source: product?.store || 'Active Store Listing',
            note: 'Current listed price as of today',
            isLowest: activeCurrentPrice <= Math.min(...rawSnaps.map((s) => s.price)),
            isHighest: activeCurrentPrice >= Math.max(...rawSnaps.map((s) => s.price)),
          });
        }
      }
    }

    return rawSnaps.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }, [snapshots, intelligence, productId, currentPrice, product]);

  // Format date nicely
  const formatDate = (isoOrDateStr: string | number) => {
    try {
      const date = new Date(isoOrDateStr);
      if (isNaN(date.getTime())) return String(isoOrDateStr);
      return date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return String(isoOrDateStr);
    }
  };

  const formatDateTime = (isoStr: string | number) => {
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return String(isoStr);
      return date.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(isoStr);
    }
  };

  // Filter observations strictly based on selected timeRange (NO fake boundary points)
  const displaySnapshots = useMemo(() => {
    if (effectiveSnapshots.length === 0) return [];
    if (timeRange === 'all') return effectiveSnapshots;

    const lastTime = new Date(effectiveSnapshots[effectiveSnapshots.length - 1].recordedAt).getTime();
    const days = timeRange === '30d' ? 30 : 90;
    const cutoff = lastTime - days * 24 * 60 * 60 * 1000;
    const inRange = effectiveSnapshots.filter(
      (s) => new Date(s.recordedAt).getTime() >= cutoff
    );
    return inRange.length > 0 ? inRange : effectiveSnapshots;
  }, [effectiveSnapshots, timeRange]);

  // Compute period stats strictly from actual observations
  const periodStats = useMemo(() => {
    const rawCurrent =
      typeof currentPrice === 'number' && currentPrice > 0
        ? currentPrice
        : intelligence?.currentPrice || (effectiveSnapshots.length > 0 ? effectiveSnapshots[effectiveSnapshots.length - 1].price : 0);

    if (displaySnapshots.length === 0) {
      return {
        current: rawCurrent,
        lowest: rawCurrent,
        highest: rawCurrent,
        average: rawCurrent,
        specialOfferPrice: intelligence?.specialOfferPrice,
        lastUpdated: new Date().toISOString(),
      };
    }

    const prices = displaySnapshots.map((p) => p.price);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const average = Math.round(sum / prices.length);

    return {
      current: rawCurrent || displaySnapshots[displaySnapshots.length - 1].price,
      lowest,
      highest,
      average,
      specialOfferPrice: intelligence?.specialOfferPrice,
      lastUpdated: displaySnapshots[displaySnapshots.length - 1].recordedAt,
    };
  }, [displaySnapshots, currentPrice, intelligence, effectiveSnapshots]);

  const stats = periodStats;

  // SVG Chart Dimensions and Points
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 55;
  const paddingY = 35;

  // Chart renders authentic observations (0, 1, or 2+) without inventing synthetic points
  const chartData = useMemo(() => {
    const innerWidth = svgWidth - paddingX * 2;
    const innerHeight = svgHeight - paddingY * 2;

    // Case 0: No historical snapshots yet
    if (displaySnapshots.length === 0) {
      const basePrice = stats.current || 1000;
      const topP = Math.round(basePrice * 1.15);
      const botP = Math.round(basePrice * 0.85);
      const gridYValues = [
        { price: topP, y: paddingY + 15 },
        { price: basePrice, y: svgHeight / 2 },
        { price: botP, y: svgHeight - paddingY - 15 },
      ];
      return {
        type: 'empty' as const,
        points: [] as Array<{ x: number; y: number; snapshot: PriceSnapshot }>,
        pathD: '',
        areaD: '',
        gridYValues,
        minPrice: botP,
        maxPrice: topP,
        minTime: Date.now(),
        maxTime: Date.now(),
      };
    }

    // Case 1: Exactly 1 authentic observation (Initial Tracked Listing Price)
    if (displaySnapshots.length === 1) {
      const single = displaySnapshots[0];
      const pPrice = single.price;
      const time = new Date(single.recordedAt).getTime();
      const x = paddingX + innerWidth / 2;
      const y = svgHeight / 2;

      const topP = Math.round(pPrice * 1.15);
      const botP = Math.round(pPrice * 0.85);
      const gridYValues = [
        { price: topP, y: paddingY + 15 },
        { price: pPrice, y: svgHeight / 2 },
        { price: botP, y: svgHeight - paddingY - 15 },
      ];

      return {
        type: 'single' as const,
        points: [{ x, y, snapshot: single }],
        pathD: `M ${paddingX} ${y} L ${svgWidth - paddingX} ${y}`,
        areaD: '',
        gridYValues,
        minPrice: pPrice,
        maxPrice: pPrice,
        minTime: time,
        maxTime: time,
      };
    }

    // Case 2+: Multiple authentic verified observations
    const prices = displaySnapshots.map((s) => s.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const rawSpan = maxPrice - minPrice;
    const priceSpan = rawSpan === 0 ? (maxPrice > 0 ? maxPrice * 0.1 : 100) : rawSpan;

    // 14% padding top and bottom so dots never clip
    const yMin = Math.max(0, minPrice - priceSpan * 0.14);
    const yMax = maxPrice + priceSpan * 0.14;
    const yRange = yMax - yMin || 1;

    const times = displaySnapshots.map((s) => new Date(s.recordedAt).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeSpan = maxTime - minTime || 1;

    const points = displaySnapshots.map((s) => {
      const time = new Date(s.recordedAt).getTime();
      const x =
        timeSpan === 0
          ? paddingX + innerWidth / 2
          : paddingX + ((time - minTime) / timeSpan) * innerWidth;
      const y = svgHeight - paddingY - ((s.price - yMin) / yRange) * innerHeight;
      return { x, y, snapshot: s };
    });

    // Build SVG Path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Area closed path for subtle gradient fill
    const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${
      svgHeight - paddingY
    } Z`;

    // 3 horizontal price guideline rows
    const gridYValues = [
      { price: maxPrice, y: svgHeight - paddingY - ((maxPrice - yMin) / yRange) * innerHeight },
      {
        price: Math.round((maxPrice + minPrice) / 2),
        y: svgHeight - paddingY - (((maxPrice + minPrice) / 2 - yMin) / yRange) * innerHeight,
      },
      { price: minPrice, y: svgHeight - paddingY - ((minPrice - yMin) / yRange) * innerHeight },
    ];

    return { type: 'multi' as const, points, pathD, areaD, gridYValues, minPrice, maxPrice, minTime, maxTime };
  }, [displaySnapshots, stats.current]);

  // All recorded milestones for THIS specific product
  const allMilestones: PriceMilestone[] = useMemo(() => {
    if (effectiveSnapshots.length > 0) {
      const highestPrice = Math.max(...effectiveSnapshots.map((s) => s.price));
      const lowestPrice = Math.min(...effectiveSnapshots.map((s) => s.price));

      return [...effectiveSnapshots]
        .reverse()
        .map((s) => {
          const dropFromPeak =
            highestPrice > s.price
              ? `${Math.round(((highestPrice - s.price) / highestPrice) * 100)}% drop`
              : undefined;

          return {
            date: s.recordedAt.split('T')[0],
            price: s.price,
            formattedPrice: formatPriceDisplay(s.price, currency),
            source: s.source,
            sourceUrl: s.sourceUrl,
            note: s.note || 'Recorded verified price',
            dropPercentage: s.dropPercentage || dropFromPeak,
            isLowest: s.price === lowestPrice,
            isHighest: s.price === highestPrice,
          };
        });
    }

    return [];
  }, [effectiveSnapshots, currency]);

  // Filter milestones by active timeRange window
  const milestones: PriceMilestone[] = useMemo(() => {
    if (timeRange === 'all') return allMilestones;
    if (displaySnapshots.length === 0) return [];
    const validDates = new Set(displaySnapshots.map((s) => s.recordedAt.split('T')[0]));
    return allMilestones.filter((m) => validDates.has(m.date));
  }, [allMilestones, timeRange, displaySnapshots]);

  return (
    <div
      id="price-history-container"
      className="w-full bg-neutral-50 dark:bg-[#141416] rounded-2xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 transition-colors space-y-6"
    >
      {/* Header with Title, Tag, and Range Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <BarChart3 className="w-4 h-4 text-[#FF6E40]" />
            <h3 className="text-base sm:text-lg font-serif font-bold text-neutral-900 dark:text-white tracking-tight">
              Verified Price History & Milestones
            </h3>
            {intelligence?.isHistoricalDataAvailable && (intelligence.priceHistory?.length || 0) > 1 ? (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                Gemini AI Researched
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#FF6E40] shrink-0" />
                Independent Tracking
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Independent price history dataset tracked specifically for Product ID: <span className="font-mono text-neutral-600 dark:text-neutral-300">{productId}</span>
          </p>
        </div>

        {/* Action buttons & Range Filters */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            id="refresh-price-intel-btn"
            onClick={runBackgroundPriceFetch}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
            title="Fetch latest verified price trends"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#FF6E40]' : 'text-neutral-500'}`} />
            <span>{refreshing ? 'Researching...' : 'Sync History'}</span>
          </button>

          {isAdmin && onAdminUpdateClick && (
            <button
              id="admin-update-price-btn"
              onClick={onAdminUpdateClick}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Update Price</span>
            </button>
          )}

          {/* Time range buttons */}
          {effectiveSnapshots.length > 1 && (
            <div className="inline-flex rounded-lg bg-neutral-200/70 dark:bg-neutral-800/80 p-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <button
                id="range-30d-btn"
                type="button"
                onClick={() => setTimeRange('30d')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  timeRange === '30d'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                    : 'hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                id="range-90d-btn"
                type="button"
                onClick={() => setTimeRange('90d')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  timeRange === '90d'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                    : 'hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                90 Days
              </button>
              <button
                id="range-all-btn"
                type="button"
                onClick={() => setTimeRange('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  timeRange === 'all'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                    : 'hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                All Time
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PRICE SUMMARY 4-CARD MATRIX (Current, Lowest, Highest, Average) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Current Listed Price */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Current Listed Price
            </span>
            <Tag className="w-3.5 h-3.5 text-[#FF6E40]" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mt-1">
            {intelligence?.formattedCurrentPrice || formatPriceDisplay(stats.current, currency)}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Active merchant listing</span>
          </div>
        </div>

        {/* 2. Lowest Price Recorded */}
        <div id="lowest-price-card" className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span
              id="lowest-price-badge-label"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100/90 dark:bg-emerald-900/50 border border-emerald-300/60 dark:border-emerald-700/60 shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {timeRange === 'all'
                  ? 'Lowest Price Recorded'
                  : timeRange === '30d'
                  ? 'Lowest (Last 30 Days)'
                  : 'Lowest (Last 90 Days)'}
              </span>
            </span>
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
            {formatPriceDisplay(
              timeRange === 'all' && intelligence?.lowestPrice
                ? Math.min(stats.lowest, intelligence.lowestPrice)
                : stats.lowest,
              currency
            )}
          </div>
          {stats.specialOfferPrice ? (
            <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
              <Award className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>With bank offers: {intelligence?.formattedSpecialOfferPrice || formatPriceDisplay(stats.specialOfferPrice, currency)}</span>
            </div>
          ) : (
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
              {timeRange === 'all'
                ? 'All-time record low'
                : `Lowest in selected ${timeRange === '30d' ? '30-day' : '90-day'} timeline`}
            </div>
          )}
        </div>

        {/* 3. Highest Price Recorded */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {timeRange === 'all'
                ? 'Highest Price Recorded'
                : timeRange === '30d'
                ? 'Highest (Last 30 Days)'
                : 'Highest (Last 90 Days)'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-800 dark:text-neutral-200 mt-1">
            {formatPriceDisplay(
              timeRange === 'all' && intelligence?.highestPrice
                ? Math.max(stats.highest, intelligence.highestPrice)
                : stats.highest,
              currency
            )}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1">
            {timeRange === 'all'
              ? 'Launch / peak benchmark'
              : `Peak in selected ${timeRange === '30d' ? '30-day' : '90-day'} timeline`}
          </div>
        </div>

        {/* 4. Average Price */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {timeRange === 'all'
                ? 'Average Price'
                : timeRange === '30d'
                ? 'Average (30 Days)'
                : 'Average (90 Days)'}
            </span>
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-800 dark:text-neutral-200 mt-1">
            ~{formatPriceDisplay(stats.average, currency)}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1">
            {timeRange === 'all'
              ? 'Standard historical benchmark'
              : `Mean across ${timeRange === '30d' ? '30-day' : '90-day'} period`}
          </div>
        </div>
      </div>

      {/* Non-blocking background research notice */}
      {isResearching && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-white dark:bg-neutral-900/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 px-3.5 py-2">
          <RefreshCw className="w-3.5 h-3.5 text-[#FF6E40] animate-spin shrink-0" />
          <span>Verifying external price history records...</span>
        </div>
      )}

      {/* Primary SVG Price-History Graph Container (Always present in UI) */}
      <div id="price-history-chart-canvas" className="relative bg-white dark:bg-neutral-900/80 rounded-xl border border-neutral-200 dark:border-neutral-800 p-2 sm:p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-44 sm:h-56 select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6E40" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#FF6E40" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines & price labels */}
          {chartData.gridYValues.map((grid, idx) => (
            <g key={`grid-${idx}`}>
              <line
                x1={paddingX}
                y1={grid.y}
                x2={svgWidth - paddingX}
                y2={grid.y}
                stroke="currentColor"
                className="text-neutral-200 dark:text-neutral-800"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingX - 8}
                y={grid.y + 3.5}
                textAnchor="end"
                className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-mono"
              >
                {formatPriceDisplay(grid.price, currency)}
              </text>
            </g>
          ))}

          {/* Gradient Area below curve (Only when 2+ points exist) */}
          {chartData.type === 'multi' && chartData.areaD && (
            <path d={chartData.areaD} fill="url(#priceGradient)" />
          )}

          {/* Primary Line curve (Multi-point trend line or single baseline) */}
          {chartData.type === 'multi' && chartData.pathD && (
            <path
              d={chartData.pathD}
              fill="none"
              stroke="#FF6E40"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {chartData.type === 'single' && chartData.pathD && (
            <path
              d={chartData.pathD}
              fill="none"
              stroke="#FF6E40"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeOpacity="0.45"
            />
          )}

          {/* Interactive Data Dots along the path */}
          {chartData.points.map((pt, idx) => {
            const isHovered = hoveredPoint?.snapshot.id === pt.snapshot.id;
            const isLowest = pt.snapshot.price === stats.lowest;
            return (
              <g key={`point-${pt.snapshot.id || idx}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onTouchStart={() => setHoveredPoint(pt)}
                />

                {chartData.type === 'single' && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="14"
                    fill="#FF6E40"
                    fillOpacity="0.18"
                    className="animate-pulse pointer-events-none"
                  />
                )}

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '6' : isLowest ? '5' : '4'}
                  fill={isLowest ? '#10B981' : '#FF6E40'}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? '2.5' : '2'}
                  className="transition-all duration-150 pointer-events-none drop-shadow-xs"
                />
              </g>
            );
          })}

          {/* Dedicated X-Axis Timeline Labels from genuine observations */}
          <g className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-sans select-none">
            {chartData.type === 'multi' && (
              <>
                <text x={paddingX} y={svgHeight - 10} textAnchor="start">
                  {formatDate(chartData.minTime)}
                </text>
                {chartData.minTime !== chartData.maxTime && (
                  <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle">
                    {formatDate((chartData.minTime + chartData.maxTime) / 2)}
                  </text>
                )}
                <text x={svgWidth - paddingX} y={svgHeight - 10} textAnchor="end">
                  {formatDate(chartData.maxTime)} (Today)
                </text>
              </>
            )}

            {chartData.type === 'single' && (
              <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle">
                Recorded: {formatDate(chartData.minTime)} (Today's Active Listing)
              </text>
            )}

            {chartData.type === 'empty' && (
              <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle">
                Real-Time Tracking Timeline Active
              </text>
            )}
          </g>
        </svg>

        {/* Empty state overlay when zero historical observations exist */}
        {chartData.type === 'empty' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xs">
            <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 mb-1.5 shadow-2xs">
              <Info className="w-4 h-4" />
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Historical price data unavailable
            </h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 max-w-sm">
              {intelligence?.uncertaintyNote ||
                'No verified historical price observations could be confirmed for this specific product listing. Real-time price tracking is active at the current listed price.'}
            </p>
          </div>
        )}

        {/* Floating Tooltip when hovering over a snapshot dot */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 px-3 py-2 rounded-lg shadow-xl text-xs backdrop-blur-xs border border-neutral-700 dark:border-neutral-200 transition-all duration-100 max-w-xs"
            style={{
              left: `${Math.min(
                Math.max(hoveredPoint.x * (100 / svgWidth) - 15, 5),
                72
              )}%`,
              top: `${Math.max(10, (hoveredPoint.y / svgHeight) * 100 - 35)}%`,
            }}
          >
            <div className="font-bold text-sm text-[#FF6E40]">
              {formatPriceDisplay(hoveredPoint.snapshot.price, currency)}
            </div>
            <div className="text-[11px] text-neutral-300 dark:text-neutral-600 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(hoveredPoint.snapshot.recordedAt)}
            </div>
            {hoveredPoint.snapshot.source && (
              <div className="text-[10px] text-emerald-400 dark:text-emerald-600 mt-0.5 font-medium flex items-center justify-between gap-1">
                <span>Source: {hoveredPoint.snapshot.source}</span>
                {hoveredPoint.snapshot.sourceUrl && (
                  <span className="text-[9px] text-[#FF6E40] underline font-sans">Verified</span>
                )}
              </div>
            )}
            {hoveredPoint.snapshot.evidence && (
              <div className="text-[10px] text-amber-300 dark:text-amber-600 mt-0.5 italic">
                Evidence: {hoveredPoint.snapshot.evidence}
              </div>
            )}
            {hoveredPoint.snapshot.note && (
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 italic mt-1 border-t border-neutral-700/60 dark:border-neutral-200/60 pt-1">
                "{hoveredPoint.snapshot.note}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Informational Sub-Banner according to observation count */}
      {chartData.type === 'single' && (
        <div
          id="single-snapshot-banner"
          className="p-3.5 sm:p-4 bg-white dark:bg-neutral-900/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                1 Verified Observation Recorded
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Initial listing benchmark tracked at{' '}
                <strong className="text-neutral-900 dark:text-white">
                  {formatPriceDisplay(effectiveSnapshots[0]?.price || stats.current, currency)}
                </strong>
                . A chronological trend curve will connect subsequent verified price adjustments.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md text-[11px] text-neutral-600 dark:text-neutral-300 font-mono">
            <Clock className="w-3 h-3 text-[#FF6E40]" />
            <span>Tracking active</span>
          </div>
        </div>
      )}

      {chartData.type === 'empty' && (
        <div
          id="no-history-banner"
          className="p-3.5 sm:p-4 bg-white dark:bg-neutral-900/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#FF6E40] shrink-0" />
            <div>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                Current Listed Price: {formatPriceDisplay(stats.current, currency)}
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Real-time price tracking is active. Historical observations will be added as price adjustments occur.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified Current Listing</span>
          </div>
        </div>
      )}

      {/* KEY PRICE HISTORY MILESTONES (As detailed in user's reference) */}
      {(allMilestones.length > 0 || milestones.length > 0) && (
        <div className="bg-white dark:bg-neutral-900/60 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#FF6E40]" />
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Key Price History Milestones {timeRange === 'all' ? '(All Time)' : timeRange === '30d' ? '(Last 30 Days)' : '(Last 90 Days)'}
              </h4>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {milestones.length} recorded {milestones.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {milestones.length === 0 ? (
            <div className="py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No major promotional milestone drops occurred during the selected {timeRange === '30d' ? '30-day' : '90-day'} period. Price remained steady.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {milestones.map((item, idx) => (
                <div
                  key={`milestone-${idx}`}
                  className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1">
                      {item.isLowest ? (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      ) : item.isHighest ? (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                      ) : (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-[#FF6E40]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                          {formatDate(item.date)}:
                        </span>
                        <span className="text-xs text-neutral-700 dark:text-neutral-300">
                          {item.note}
                        </span>
                        {item.dropPercentage && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                            {item.dropPercentage}
                          </span>
                        )}
                        {item.isLowest && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                            Lowest Price
                          </span>
                        )}
                        {item.isHighest && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            Launch Price
                          </span>
                        )}
                        {item.source && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700">
                            <span>Source: {item.source}</span>
                            {item.sourceUrl && (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#FF6E40] hover:underline font-bold"
                                title="View verified source listing"
                              >
                                ↗
                              </a>
                            )}
                          </span>
                        )}
                      </div>
                      {item.evidence && (
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 italic pl-1 border-l-2 border-emerald-500/50">
                          Evidence: {item.evidence}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right pl-5 sm:pl-0">
                    <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white font-mono">
                      {item.formattedPrice || formatPriceDisplay(item.price, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {intelligence?.summaryNote && (
            <div className="mt-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-300 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#FF6E40] shrink-0 mt-0.5" />
              <span>{intelligence.summaryNote}</span>
            </div>
          )}
        </div>
      )}

      {/* Editorial Transparency Footer */}
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-100/70 dark:bg-neutral-800/50 px-3.5 py-2 rounded-lg">
        <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span>
          <strong>Automated Price Tracking:</strong> Price snapshots and landmark drops are verified from merchant links and public product records.
        </span>
      </div>
    </div>
  );
};
