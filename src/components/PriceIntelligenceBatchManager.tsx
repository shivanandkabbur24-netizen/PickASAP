import React, { useState, useEffect, useCallback } from 'react';
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
import { Product, BatchResearchStatus } from '../types';

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

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/price-history/batch-status');
      const json = await res.json();
      if (json && json.success && json.data) {
        setStatus(json.data);
      }
    } catch (err) {
      console.warn('Error fetching batch research status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStartBatch = async (forceResume = false) => {
    setIsTriggering(true);
    setActionNotice(forceResume ? 'Forcing resume of batch research...' : 'Starting monthly batch research...');
    try {
      const res = await fetch('/api/price-history/run-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceResume }),
      });
      const json = await res.json();
      if (json?.message) {
        setActionNotice(json.message);
      }
      if (json?.state) {
        setStatus(json.state);
      }
    } catch (err) {
      console.error('Failed to trigger batch research:', err);
      setActionNotice('Failed to communicate with research engine.');
    } finally {
      setIsTriggering(false);
      setTimeout(() => fetchStatus(), 1000);
    }
  };

  const handleResearchSingleProduct = async (product: Product) => {
    setResearchingProductId(product.id);
    setActionNotice(`Initiating Google Search research for "${product.title}"...`);
    try {
      const res = await fetch('/api/price-history/research-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const json = await res.json();
      if (json?.success) {
        setActionNotice(`Successfully researched "${product.title}" and saved historical points to Firestore!`);
        if (json.data && onProductUpdated) {
          onProductUpdated({
            ...product,
            lastResearchedMonth: new Date().toISOString().slice(0, 7),
            lastResearchedAt: new Date().toISOString(),
            researchStatus: 'researched',
            priceIntelligence: json.data,
          });
        }
      } else {
        setActionNotice(`Research notice for "${product.title}": ${json?.error || 'Unable to retrieve data'}`);
      }
    } catch (err) {
      console.error('Error researching single product:', err);
      setActionNotice(`Error researching product: ${String(err)}`);
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
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-[#FF6E40] border border-[#FF6E40]/30 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Monthly Batch Price Intelligence</span>
              </span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Cycle: {currentMonthName}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              Scheduled Price Research &amp; Quota Manager
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
              Google Search grounding research runs in scheduled background batches for uploaded products once per month. 
              If the daily search quota is reached, research pauses gracefully for the day and automatically resumes on Day 2. 
              Store visitors read directly from Firestore, ensuring zero quota exhaustion during normal user browsing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchStatus()}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-2 cursor-pointer"
              title="Refresh live status from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>

            <button
              id="start-monthly-batch-research-btn"
              onClick={() => handleStartBatch(false)}
              disabled={isTriggering || status?.status === 'researching'}
              className="px-5 py-2.5 rounded-xl bg-[#FF6E40] hover:bg-[#e65c2e] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${status?.status === 'researching' ? 'animate-pulse' : ''}`} />
              <span>
                {status?.status === 'researching'
                  ? 'Researching in Background...'
                  : status?.status === 'quota_paused'
                  ? 'Resume Research Batch'
                  : 'Run Monthly Batch Now'}
              </span>
            </button>

            {status?.status === 'quota_paused' && (
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
              {status?.status === 'completed' ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Up to Date</span>
                </span>
              ) : status?.status === 'researching' ? (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Researching...</span>
                </span>
              ) : status?.status === 'quota_paused' ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Quota Paused</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-400 font-bold text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Idle</span>
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block truncate" title={status?.message || 'Ready'}>
              {status?.message || 'Ready'}
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

          {status?.currentProductTitle && status?.status === 'researching' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Actively researching with Google Search grounding: &ldquo;{status.currentProductTitle}&rdquo;</span>
            </div>
          )}

          {status?.status === 'quota_paused' && status?.resumesAt && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Daily Quota Paused Gracefully (Day 1):</strong> Researched {researchedCount} products today. 
                Remaining {pendingCount} products will automatically resume tomorrow on Day 2 ({new Date(status.resumesAt).toLocaleString('en-IN')}).
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
                          title="Run immediate Google Search research for this single product and store to Firestore"
                        >
                          <Search className={`w-3 h-3 ${isCurrentlyResearching ? 'animate-spin' : ''}`} />
                          <span>{isCurrentlyResearching ? 'Searching...' : 'Research Now'}</span>
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
