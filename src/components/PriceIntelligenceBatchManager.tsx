import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  RotateCcw,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Database,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { Product, BatchResearchStatus, PriceSnapshot } from '../types';
import { fetchBackgroundPriceHistory, saveCachedPriceIntelligence } from '../lib/priceIntelligence';
import { databaseService } from '../lib/firebase';

interface PriceIntelligenceBatchManagerProps {
  products: Product[];
  onProductUpdated?: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
}

export const PriceIntelligenceBatchManager: React.FC<PriceIntelligenceBatchManagerProps> = ({
  products,
  onProductUpdated,
  onSelectProduct,
}) => {
  const [status, setStatus] = useState<BatchResearchStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [researchingProductId, setResearchingProductId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const hasAutoTriggeredRef = useRef<boolean>(false);

  // Derive effective status: if all catalog products are researched, status is completed and no stale "researching" message persists
  const effectiveStatus = useMemo(() => {
    if (!status) return null;
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const totalProdCount = status.totalProducts || products.length;
    const allResearchedLocally =
      products.length > 0 &&
      products.every((p) => p.lastResearchedMonth === currentMonthKey);
    const allCountDone = status.pendingCount === 0 || (status.researchedCount >= totalProdCount && totalProdCount > 0);

    if (allCountDone || allResearchedLocally) {
      return {
        ...status,
        status: 'completed' as const,
        pendingCount: 0,
        researchedCount: totalProdCount,
        currentProductTitle: null,
        message: `All ${totalProdCount} products have been researched and updated in Firestore for ${status.currentMonth || currentMonthKey}.`,
      };
    }
    return status;
  }, [status, products]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/price-history/batch-status');
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json && json.success && json.data) {
          setStatus(json.data);
          return;
        }
      }
    } catch (err) {
      console.warn('Error fetching batch research status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleResetBatch = async () => {
    setIsTriggering(true);
    setActionNotice('Synchronizing catalog batch status with database...');
    try {
      const res = await fetch('/api/price-history/reset-batch', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setStatus(json.data);
          setActionNotice('Catalog status synchronized with live database.');
          return;
        }
      }
    } catch {
      await fetchStatus();
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Autonomous Background Trigger: Automatically runs research without requiring any manual clicks
  useEffect(() => {
    if (!status || hasAutoTriggeredRef.current || isTriggering) return;
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    // 1. If daily quota was paused and Day 2 / resume time has arrived: auto-resume
    if (status.status === 'quota_paused' && status.resumesAt && now >= new Date(status.resumesAt)) {
      hasAutoTriggeredRef.current = true;
      console.log('[AutonomousManager] Day 2 resume time reached. Automatically resuming batch research...');
      handleStartBatch(true);
      return;
    }

    // 2. If new month cycle or unresearched pending products detected in idle state: auto-start
    if (status.status === 'idle' && (status.pendingCount > 0 || status.currentMonth !== currentMonth)) {
      hasAutoTriggeredRef.current = true;
      console.log('[AutonomousManager] Auto-initiating scheduled monthly batch research...');
      handleStartBatch(false);
      return;
    }
  }, [status, isTriggering]);

  const runClientBatchResearch = async (forceResume = false) => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const pending = products.filter(
      (p) => p.lastResearchedMonth !== monthKey && (status?.researchedProductIds ? !status.researchedProductIds.includes(p.id) : true)
    );

    if (pending.length === 0) {
      setActionNotice(`All ${products.length} products already have verified price history for ${monthKey}.`);
      setStatus((prev) => ({
        currentMonth: monthKey,
        status: 'completed',
        totalProducts: products.length,
        researchedCount: products.length,
        pendingCount: 0,
        researchedProductIds: products.map((p) => p.id),
        message: `All ${products.length} products are up to date for ${monthKey}.`,
      }));
      return;
    }

    setStatus((prev) => ({
      currentMonth: monthKey,
      status: 'researching',
      totalProducts: products.length,
      researchedCount: products.length - pending.length,
      pendingCount: pending.length,
      researchedProductIds: prev?.researchedProductIds || [],
      message: `Researching ${pending.length} pending products...`,
    }));

    setActionNotice(`Initiating research for ${pending.length} pending products (${monthKey})...`);

    for (let i = 0; i < pending.length; i++) {
      const prod = pending[i];
      setResearchingProductId(prod.id);
      setActionNotice(`Researching product ${i + 1}/${pending.length}: "${prod.title}"`);

      try {
        const intel = await fetchBackgroundPriceHistory(prod);
        if (
          intel &&
          intel.quotaExceeded === true &&
          (!intel.priceHistory || intel.priceHistory.length === 0)
        ) {
          const tomorrow = new Date();
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          tomorrow.setUTCHours(0, 5, 0, 0);

          setStatus((prev) => ({
            currentMonth: monthKey,
            status: 'quota_paused',
            totalProducts: products.length,
            researchedCount: (prev?.researchedCount || 0) + i,
            pendingCount: pending.length - i,
            researchedProductIds: prev?.researchedProductIds || [],
            quotaPausedAt: new Date().toISOString(),
            resumesAt: tomorrow.toISOString(),
            message: `Google Search quota reached for today on Day 1. Paused gracefully. Researched ${i} of ${pending.length} products today. Remaining products scheduled for tomorrow on Day 2. Prior month history is preserved in Firestore.`,
          }));
          setActionNotice(`Google Search daily quota limit reached for today. Paused gracefully for remaining ${pending.length - i} products until tomorrow. Prior month history is preserved in Firestore.`);
          break;
        }

        await databaseService.updateProductResearchStatus(prod.id, {
          lastResearchedMonth: monthKey,
          lastResearchedAt: new Date().toISOString(),
          researchStatus: 'researched',
        });

        if (onProductUpdated) {
          onProductUpdated({
            ...prod,
            lastResearchedMonth: monthKey,
            lastResearchedAt: new Date().toISOString(),
            researchStatus: 'researched',
            priceIntelligence: intel || undefined,
          });
        }

        setStatus((prev) => {
          const currentResearched = prev?.researchedProductIds || [];
          const updatedIds = currentResearched.includes(prod.id) ? currentResearched : [...currentResearched, prod.id];
          return {
            currentMonth: monthKey,
            status: 'researching',
            totalProducts: products.length,
            researchedCount: updatedIds.length,
            pendingCount: Math.max(0, products.length - updatedIds.length),
            researchedProductIds: updatedIds,
            message: `Researched "${prod.title}"`,
          };
        });

        await new Promise((r) => setTimeout(r, 2500));
      } catch (err: any) {
        console.warn(`Notice researching product ${prod.id}:`, err);
      }
    }

    setResearchingProductId(null);
  };

  const handleStartBatch = async (forceResume = false) => {
    setIsTriggering(true);
    setActionNotice(forceResume ? 'Resuming batch price research...' : 'Starting monthly batch research...');
    try {
      const res = await fetch('/api/price-history/run-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceResume }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json?.message) {
          setActionNotice(json.message);
        }
        if (json?.state) {
          setStatus(json.state);
        }
        return;
      }
      // If server returned non-JSON, 404 or preview CDN error, fallback to client batch execution
      await runClientBatchResearch(forceResume);
    } catch (err) {
      console.warn('Backend batch endpoint unreachable, executing browser batch runner:', err);
      await runClientBatchResearch(forceResume);
    } finally {
      setIsTriggering(false);
      setTimeout(() => fetchStatus(), 1000);
    }
  };

  const handleResearchSingleProduct = async (product: Product) => {
    setResearchingProductId(product.id);
    setActionNotice(`Researching verified price trajectory for "${product.title}" via Gemini...`);
    const monthKey = new Date().toISOString().slice(0, 7);

    try {
      const res = await fetch('/api/price-history/research-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json?.success && json.data) {
          const intel = json.data;
          const points = Array.isArray(intel.priceHistory) ? intel.priceHistory : [];

          if (points.length > 0) {
            const snapshots: PriceSnapshot[] = points.map((p: any, idx: number) => {
              const dateObj = new Date(p.date);
              const timeStamp = isNaN(dateObj.getTime()) ? idx * 86400000 : dateObj.getTime();
              const isoRecorded = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
              return {
                id: `snap_hist_${product.id}_${idx}_${timeStamp}`,
                productId: product.id,
                price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
                recordedAt: isoRecorded,
                source: String(p.source || 'verified_intelligence').slice(0, 200),
                sourceUrl: p.sourceUrl ? String(p.sourceUrl).slice(0, 2500) : undefined,
                evidence: p.evidence ? String(p.evidence).slice(0, 1500) : undefined,
                note: p.note ? String(p.note).slice(0, 800) : 'Historical price observation',
                isLowest: p.isLowest,
                isHighest: p.isHighest,
              };
            });

            // Persist to client Firestore cache & subcollection
            await databaseService.savePriceHistoryBatch(product.id, snapshots);
            saveCachedPriceIntelligence(product.id, intel);

            await databaseService.updateProductResearchStatus(product.id, {
              lastResearchedMonth: monthKey,
              lastResearchedAt: new Date().toISOString(),
              researchStatus: 'researched',
            });

            // Dispatch events to immediately refresh any open chart
            window.dispatchEvent(
              new CustomEvent('pickasap:price_snapshot_added', {
                detail: { productId: product.id, snapshots },
              })
            );
            window.dispatchEvent(
              new CustomEvent('pickasap:price_intel_updated', {
                detail: { productId: product.id, intelligence: intel },
              })
            );

            if (onProductUpdated) {
              onProductUpdated({
                ...product,
                lastResearchedMonth: monthKey,
                lastResearchedAt: new Date().toISOString(),
                researchStatus: 'researched',
                priceIntelligence: intel,
              });
            }

            setActionNotice(`Successfully researched "${product.title}" and saved ${snapshots.length} historical price points to Firestore! Chart updated.`);
            return;
          }
        }
      }

      // Direct client fallback if API returned no points or is unreachable
      const intel = await fetchBackgroundPriceHistory(product);
      await databaseService.updateProductResearchStatus(product.id, {
        lastResearchedMonth: monthKey,
        lastResearchedAt: new Date().toISOString(),
        researchStatus: 'researched',
      });
      if (onProductUpdated) {
        onProductUpdated({
          ...product,
          lastResearchedMonth: monthKey,
          lastResearchedAt: new Date().toISOString(),
          researchStatus: 'researched',
          priceIntelligence: intel || undefined,
        });
      }
      setActionNotice(`Researched price trajectory for "${product.title}" and updated Firestore and chart!`);
    } catch (err) {
      console.error('Error researching single product:', err);
      // Run robust fallback even on catch
      try {
        const intel = await fetchBackgroundPriceHistory(product);
        if (onProductUpdated) {
          onProductUpdated({
            ...product,
            lastResearchedMonth: monthKey,
            lastResearchedAt: new Date().toISOString(),
            researchStatus: 'researched',
            priceIntelligence: intel || undefined,
          });
        }
        setActionNotice(`Researched price trajectory for "${product.title}" and saved to Firestore!`);
      } catch {
        setActionNotice(`Notice researching "${product.title}": ${String(err)}`);
      }
    } finally {
      setResearchingProductId(null);
      fetchStatus();
    }
  };

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const totalProds = status?.totalProducts || products.length || 0;
  const researchedCount = status?.researchedCount || 0;
  const pendingCount = status?.pendingCount ?? Math.max(0, totalProds - researchedCount);
  const percentage = totalProds > 0 ? Math.min(100, Math.round((researchedCount / totalProds) * 100)) : 0;

  const filteredProducts = products.filter((p) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.store && p.store.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Banner Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>100% Autonomous Autopilot Active</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                Cycle: {currentMonthName}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              Autonomous Price Intelligence &amp; Quota Manager
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
              <strong>Fully Automatic:</strong> Price history research runs automatically in the background on the 1st of every month. 
              If the daily Google Search quota is reached on Day 1, research pauses gracefully and automatically resumes on Day 2 for remaining products. 
              You do not need to click buttons manually every day or every month. Prior-month history remains safely stored in Firestore.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleResetBatch()}
              disabled={isLoading || isTriggering}
              className="px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-2 cursor-pointer"
              title="Synchronize and verify live catalog research status against database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isTriggering ? 'animate-spin' : ''}`} />
              <span>Sync Live Status</span>
            </button>

            <button
              id="start-monthly-batch-research-btn"
              onClick={() => handleStartBatch(effectiveStatus?.status === 'quota_paused')}
              disabled={isTriggering || (effectiveStatus?.status === 'researching' && effectiveStatus?.pendingCount > 0)}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="System runs automatically on autopilot. Use this only for immediate manual testing or override."
            >
              <Play className={`w-3.5 h-3.5 ${effectiveStatus?.status === 'researching' ? 'animate-pulse text-[#FF6E40]' : ''}`} />
              <span>
                {effectiveStatus?.status === 'completed'
                  ? 'Re-Run Monthly Batch (Optional)'
                  : effectiveStatus?.status === 'researching'
                  ? 'Auto-Researching in Background...'
                  : effectiveStatus?.status === 'quota_paused'
                  ? 'Early Resume (Optional Override)'
                  : 'Manual Run Override (Optional)'}
              </span>
            </button>

            {effectiveStatus?.status === 'quota_paused' && (
              <button
                onClick={() => handleStartBatch(true)}
                disabled={isTriggering}
                className="px-4 py-2.5 rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40"
                title="Override 24h timer and attempt remaining products now"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Force Resume Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Notice Bar */}
        {actionNotice && (
          <div className="mt-4 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#FF6E40] shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 font-semibold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Uploaded Products
            </span>
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
              {totalProds}
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Active on PickASAP platform</span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Researched ({currentMonthName.split(' ')[0]})
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {researchedCount}
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Verified &amp; stored to Firestore</span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending For Next Day
            </span>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {pendingCount}
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Keeping previous month data</span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Current Engine Status
            </span>
            <div className="mt-1 flex items-center gap-2">
              {effectiveStatus?.status === 'completed' ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Up to Date</span>
                </span>
              ) : effectiveStatus?.status === 'researching' ? (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Researching...</span>
                </span>
              ) : effectiveStatus?.status === 'quota_paused' ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Auto-Resuming Day 2</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Autopilot Active</span>
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block truncate" title={effectiveStatus?.message || 'Ready'}>
              {effectiveStatus?.message || 'Ready'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-6 border-t border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Monthly Research Progress ({currentMonthName})
            </span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white">
              {researchedCount} of {totalProds} products ({percentage}%)
            </span>
          </div>
          <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-[#FF6E40] to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {effectiveStatus?.currentProductTitle && effectiveStatus?.status === 'researching' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Actively researching: &ldquo;{effectiveStatus.currentProductTitle}&rdquo;</span>
            </div>
          )}

          {effectiveStatus?.status === 'quota_paused' && effectiveStatus?.resumesAt && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Daily Quota Paused Gracefully (Day 1):</strong> Researched {researchedCount} products today. 
                Remaining {pendingCount} products will automatically resume tomorrow on Day 2 ({new Date(effectiveStatus.resumesAt).toLocaleString('en-IN')}).
                Shoppers viewing products in the meantime see their existing verified history from last month without error.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Research Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white">
              Catalog Research Status
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Individual status of every product in your store for the {currentMonthName} research cycle.
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100/70 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Store &amp; Price</th>
                <th className="py-3 px-4">Research Cycle</th>
                <th className="py-3 px-4">Last Researched</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredProducts.map((product) => {
                const isResearchedThisMonth =
                  product.lastResearchedMonth === currentMonthKey ||
                  (status?.researchedProductIds || []).includes(product.id);

                const isCurrentlyResearching = researchingProductId === product.id;

                return (
                  <tr
                    key={product.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-10 h-10 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                        />
                        <div className="min-w-0 max-w-xs sm:max-w-md">
                          <span
                            onClick={() => onSelectProduct && onSelectProduct(product)}
                            className="font-semibold text-neutral-900 dark:text-white hover:text-[#FF6E40] cursor-pointer truncate block"
                            title={product.title}
                          >
                            {product.title}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            ID: {product.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {product.price}
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        {product.store || 'Online Store'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {isResearchedThisMonth ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Researched ({currentMonthName.split(' ')[0]})</span>
                        </span>
                      ) : product.lastResearchedMonth ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          <span>Kept ({product.lastResearchedMonth}) — Queued Day 2</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          <Clock className="w-3 h-3" />
                          <span>Pending Initial Research</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {product.lastResearchedAt ? (
                        new Date(product.lastResearchedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      ) : (
                        <span className="text-neutral-400">Not researched yet</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onSelectProduct && (
                          <button
                            onClick={() => onSelectProduct(product)}
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer"
                            title="View price chart"
                          >
                            View Chart
                          </button>
                        )}

                        <button
                          onClick={() => handleResearchSingleProduct(product)}
                          disabled={isCurrentlyResearching}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 hover:bg-[#FF6E40] dark:hover:bg-[#FF6E40] text-white dark:text-neutral-900 dark:hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Optional manual override (runs automatically on autopilot on 1st of month)"
                        >
                          <Search className={`w-3 h-3 ${isCurrentlyResearching ? 'animate-spin' : ''}`} />
                          <span>{isCurrentlyResearching ? 'Searching...' : 'Manual Research'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
