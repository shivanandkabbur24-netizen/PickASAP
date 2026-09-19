import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { PriceSnapshot, PriceIntelligenceData, PriceMilestone } from '../types';
import { databaseService as db, formatPriceDisplay } from '../lib/firebase';
import {
  fetchBackgroundPriceHistory,
  getCachedPriceIntelligence,
} from '../lib/priceIntelligence';

interface PriceHistoryChartProps {
  productId: string;
  product?: {
    id: string;
    title: string;
    affiliateUrl?: string;
    productUrl?: string;
    store?: string;
    price?: string;
    currentPrice?: number;
    originalPrice?: string;
    mrp?: string;
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
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'all'>('all');
  const [intelligence, setIntelligence] = useState<PriceIntelligenceData | null>(() =>
    getCachedPriceIntelligence(productId)
  );
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    snapshot: PriceSnapshot;
  } | null>(null);

  // Background fetch trigger
  const runBackgroundPriceFetch = useCallback(async () => {
    if (!product && !productId) return;
    setRefreshing(true);
    const prodPayload = product || {
      id: productId,
      title: '',
      currentPrice: currentPrice,
    };

    try {
      const result = await fetchBackgroundPriceHistory(prodPayload);
      if (result) {
        setIntelligence(result);
      }
    } catch (err) {
      console.warn('Background price fetch notice:', err);
    } finally {
      setRefreshing(false);
    }
  }, [product, productId, currentPrice]);

  // Real-time listener for price history snapshots of this product
  useEffect(() => {
    setLoading(true);
    const unsubscribe = db.subscribeToPriceHistory(productId, (data) => {
      setSnapshots(data);
      setLoading(false);
    });

    // Run background fetch when mounting
    runBackgroundPriceFetch();

    // Listen to local optimistic snapshot events
    const handleSnapshotAdded = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; snapshots: PriceSnapshot[] }>;
      if (customEvent.detail && customEvent.detail.productId === productId) {
        setSnapshots(customEvent.detail.snapshots);
      }
    };

    // Listen to intelligence update event
    const handleIntelUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; intelligence: PriceIntelligenceData }>;
      if (customEvent.detail && customEvent.detail.productId === productId) {
        setIntelligence(customEvent.detail.intelligence);
      }
    };

    window.addEventListener('pickasap:price_snapshot_added', handleSnapshotAdded);
    window.addEventListener('pickasap:price_intel_updated', handleIntelUpdated);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('pickasap:price_snapshot_added', handleSnapshotAdded);
      window.removeEventListener('pickasap:price_intel_updated', handleIntelUpdated);
    };
  }, [productId, runBackgroundPriceFetch]);

  // Sort snapshots chronologically
  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }, [snapshots]);

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

  // Compute active timeline window, data points, and period stats based on selected timeRange
  const { timelinePoints, timeBounds, periodStats } = useMemo(() => {
    const rawCurrent =
      typeof currentPrice === 'number' && currentPrice > 0
        ? currentPrice
        : intelligence?.currentPrice || (sortedSnapshots.length > 0 ? sortedSnapshots[sortedSnapshots.length - 1].price : 0);

    const effectiveNow = sortedSnapshots.length > 0
      ? Math.max(Date.now(), new Date(sortedSnapshots[sortedSnapshots.length - 1].recordedAt).getTime())
      : Date.now();

    let rangeStart: number;
    const rangeEnd: number = effectiveNow;

    if (timeRange === '30d') {
      rangeStart = effectiveNow - 30 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '90d') {
      rangeStart = effectiveNow - 90 * 24 * 60 * 60 * 1000;
    } else {
      rangeStart = sortedSnapshots.length > 0
        ? new Date(sortedSnapshots[0].recordedAt).getTime()
        : effectiveNow - 180 * 24 * 60 * 60 * 1000;
    }

    // Determine baseline prevailing price right before or at rangeStart
    let openingPrice = rawCurrent;
    if (sortedSnapshots.length > 0) {
      const prior = sortedSnapshots.filter(
        (s) => new Date(s.recordedAt).getTime() <= rangeStart
      );
      if (prior.length > 0) {
        openingPrice = prior[prior.length - 1].price;
      } else {
        openingPrice = sortedSnapshots[0].price;
      }
    }

    // Snapshots inside the window (rangeStart, rangeEnd]
    const insideSnapshots = sortedSnapshots.filter((s) => {
      const t = new Date(s.recordedAt).getTime();
      return t > rangeStart && t <= rangeEnd;
    });

    const points: PriceSnapshot[] = [];

    // 1. Boundary opening point for the timeline window
    points.push({
      id: `bound-start-${timeRange}`,
      productId,
      price: openingPrice,
      recordedAt: new Date(rangeStart).toISOString(),
      source: 'automated',
      note: timeRange === 'all' ? (sortedSnapshots[0]?.note || 'Initial tracked launch price') : `Baseline price at start of ${timeRange === '30d' ? '30-day' : '90-day'} window`,
    });

    // 2. All snapshots falling in this window
    for (const s of insideSnapshots) {
      points.push(s);
    }

    // 3. Current closing point at rangeEnd (today)
    const latestPrice = sortedSnapshots.length > 0
      ? (typeof currentPrice === 'number' && currentPrice > 0 ? currentPrice : sortedSnapshots[sortedSnapshots.length - 1].price)
      : openingPrice;

    const lastPointTime = new Date(points[points.length - 1].recordedAt).getTime();
    if (Math.abs(rangeEnd - lastPointTime) > 60 * 60 * 1000) {
      points.push({
        id: `bound-end-${timeRange}`,
        productId,
        price: latestPrice,
        recordedAt: new Date(rangeEnd).toISOString(),
        source: 'automated',
        note: 'Active verified price',
      });
    }

    // Calculate period specific statistics
    const windowPrices = points.map((p) => p.price);
    const lowest = Math.min(...windowPrices);
    const highest = Math.max(...windowPrices);
    const sum = windowPrices.reduce((acc, p) => acc + p, 0);
    const average = Math.round(sum / windowPrices.length);

    return {
      timelinePoints: points,
      timeBounds: { start: rangeStart, end: rangeEnd },
      periodStats: {
        current: rawCurrent,
        lowest,
        highest,
        average,
        specialOfferPrice: intelligence?.specialOfferPrice,
        lastUpdated: sortedSnapshots.length > 0 ? sortedSnapshots[sortedSnapshots.length - 1].recordedAt : new Date().toISOString(),
      },
    };
  }, [sortedSnapshots, timeRange, currentPrice, intelligence, productId]);

  // Overall all-time stats reference
  const stats = periodStats;

  // SVG Chart Dimensions and Points
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 55;
  const paddingY = 35;

  const chartData = useMemo(() => {
    if (timelinePoints.length < 2) return null;

    const prices = timelinePoints.map((s) => s.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const rawSpan = maxPrice - minPrice;
    const priceSpan = rawSpan === 0 ? (maxPrice > 0 ? maxPrice * 0.1 : 100) : rawSpan;

    // Give 14% padding top and bottom to ensure curve doesn't clip
    const yMin = Math.max(0, minPrice - priceSpan * 0.14);
    const yMax = maxPrice + priceSpan * 0.14;
    const yRange = yMax - yMin || 1;

    const minTime = timeBounds.start;
    const maxTime = timeBounds.end;
    const timeSpan = maxTime - minTime || 1;

    const innerWidth = svgWidth - paddingX * 2;
    const innerHeight = svgHeight - paddingY * 2;

    const points = timelinePoints.map((s) => {
      const time = new Date(s.recordedAt).getTime();
      const clampedTime = Math.max(minTime, Math.min(maxTime, time));
      const x = paddingX + ((clampedTime - minTime) / timeSpan) * innerWidth;
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

    // Calculate grid lines (3 horizontal lines)
    const gridYValues = [
      { price: maxPrice, y: svgHeight - paddingY - ((maxPrice - yMin) / yRange) * innerHeight },
      {
        price: Math.round((maxPrice + minPrice) / 2),
        y: svgHeight - paddingY - (((maxPrice + minPrice) / 2 - yMin) / yRange) * innerHeight,
      },
      { price: minPrice, y: svgHeight - paddingY - ((minPrice - yMin) / yRange) * innerHeight },
    ];

    return { points, pathD, areaD, gridYValues, minPrice, maxPrice };
  }, [timelinePoints, timeBounds]);

  // All recorded milestones
  const allMilestones: PriceMilestone[] = useMemo(() => {
    if (intelligence?.milestones && intelligence.milestones.length > 0) {
      return intelligence.milestones;
    }

    if (sortedSnapshots.length > 0) {
      const highestPrice = Math.max(...sortedSnapshots.map((s) => s.price));
      const lowestPrice = Math.min(...sortedSnapshots.map((s) => s.price));

      return [...sortedSnapshots]
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
            note: s.note || 'Recorded verified price',
            dropPercentage: s.dropPercentage || dropFromPeak,
            isLowest: s.price === lowestPrice,
            isHighest: s.price === highestPrice,
          };
        });
    }

    return [];
  }, [intelligence, sortedSnapshots, currency]);

  // Filter milestones by active timeRange window
  const milestones: PriceMilestone[] = useMemo(() => {
    if (timeRange === 'all') return allMilestones;
    return allMilestones.filter((m) => {
      const t = new Date(m.date).getTime();
      return !isNaN(t) && t >= timeBounds.start && t <= timeBounds.end + 24 * 60 * 60 * 1000;
    });
  }, [allMilestones, timeRange, timeBounds]);

  return (
    <div
      id="price-history-container"
      className="w-full bg-neutral-50 dark:bg-[#141416] rounded-2xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 transition-colors space-y-6"
    >
      {/* Header with Title, Tag, and Range Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#FF6E40]" />
            <h3 className="text-base sm:text-lg font-serif font-bold text-neutral-900 dark:text-white tracking-tight">
              Verified Price History & Milestones
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/20">
              Live Intelligence
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Historical price observations and landmark deal drops tracked from merchant listings.
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
            <span>{refreshing ? 'Updating...' : 'Sync History'}</span>
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
          {(snapshots.length > 0 || (intelligence?.milestones && intelligence.milestones.length > 0)) && (
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
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {timeRange === 'all'
                ? 'Lowest Price Recorded'
                : timeRange === '30d'
                ? 'Lowest (Last 30 Days)'
                : 'Lowest (Last 90 Days)'}
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

      {/* Loading state */}
      {loading && snapshots.length === 0 && (
        <div className="h-48 flex items-center justify-center text-sm text-neutral-500">
          <div className="animate-spin w-5 h-5 border-2 border-[#FF6E40] border-t-transparent rounded-full mr-2" />
          Loading price history records...
        </div>
      )}

      {/* Case A: Single Snapshot / Baseline State */}
      {!loading && snapshots.length <= 1 && !chartData && (
        <div
          id="single-snapshot-state"
          className="p-5 sm:p-6 bg-white dark:bg-neutral-900/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 text-center"
        >
          <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h4 className="text-sm sm:text-base font-semibold text-neutral-800 dark:text-neutral-200">
            Price history will appear as more price updates are recorded.
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
            Currently tracking baseline price observation. Whenever an administrator or editor records a verified deal or price change, a chronological trend line will automatically populate here.
          </p>

          <div className="mt-4 inline-flex items-center gap-4 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#FF6E40]" />
              Initial Recorded Price:{' '}
              <strong className="text-neutral-900 dark:text-white">
                {formatPriceDisplay(stats.lowest, currency)}
              </strong>
            </span>
            <span className="hidden sm:inline text-neutral-300 dark:text-neutral-600">|</span>
            <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(stats.lastUpdated)}
            </span>
          </div>
        </div>
      )}

      {/* Case B: Multi-Snapshot Interactive Trend Chart */}
      {chartData && (
        <div className="relative bg-white dark:bg-neutral-900/80 rounded-xl border border-neutral-200 dark:border-neutral-800 p-2 sm:p-4 overflow-hidden">
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

            {/* Gradient Area below curve */}
            <path d={chartData.areaD} fill="url(#priceGradient)" />

            {/* Primary Line curve */}
            <path
              d={chartData.pathD}
              fill="none"
              stroke="#FF6E40"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

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

            {/* Dedicated X-Axis Timeline Labels */}
            <g className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-sans select-none">
              <text x={paddingX} y={svgHeight - 10} textAnchor="start">
                {formatDate(timeBounds.start)}
              </text>
              <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle">
                {formatDate((timeBounds.start + timeBounds.end) / 2)}
              </text>
              <text x={svgWidth - paddingX} y={svgHeight - 10} textAnchor="end">
                {timeRange === 'all' ? formatDate(timeBounds.end) : 'Today'}
              </text>
            </g>
          </svg>

          {/* Floating Tooltip when hovering over a snapshot dot */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 px-3 py-2 rounded-lg shadow-xl text-xs backdrop-blur-xs border border-neutral-700 dark:border-neutral-200 transition-all duration-100"
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
              {hoveredPoint.snapshot.note && (
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 italic mt-1 border-t border-neutral-700/60 dark:border-neutral-200/60 pt-1">
                  "{hoveredPoint.snapshot.note}"
                </div>
              )}
            </div>
          )}
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
                      </div>
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
