import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  MousePointerClick,
  Package,
  ExternalLink,
  Copy,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import { Product, ClickRecord, UserProfile } from '../types';
import { database as db } from '../lib/firebase';

interface DashboardViewProps {
  user: UserProfile;
  products: Product[];
  onOpenUploadModal: () => void;
  onDeleteProduct: (productId: string) => void;
  onSwitchToMagazine: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  products,
  onOpenUploadModal,
  onDeleteProduct,
  onSwitchToMagazine,
}) => {
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);

  // Load initial clicks
  useEffect(() => {
    db.getClicks().then(setClicks);

    // Listen for live click events
    const handleLiveClick = (e: CustomEvent<{ product: Product; record: ClickRecord }>) => {
      if (e.detail?.record) {
        setClicks((prev) => [e.detail.record, ...prev]);
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 2000);
      }
    };

    window.addEventListener('pickasap:click_recorded', handleLiveClick as EventListener);
    return () => {
      window.removeEventListener('pickasap:click_recorded', handleLiveClick as EventListener);
    };
  }, []);

  // Filter products for this creator (or all if creator wants overview)
  const myProducts = products.filter(
    (p) => p.uploaderId === user.id || user.role === 'admin' || !p.uploaderId
  );

  const totalClicks = myProducts.reduce((acc, p) => acc + (p.clicksCount || 0), 0);
  const topProduct = [...myProducts].sort((a, b) => (b.clicksCount || 0) - (a.clicksCount || 0))[0];
  const uniqueStores = Array.from(new Set(myProducts.map((p) => p.store)));

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTestClick = async (product: Product) => {
    await db.recordClick(product);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Dashboard Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-600 dark:text-amber-400 font-semibold">
              Live Affiliate Telemetry
            </span>
            {livePulse && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                New Click Received!
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white mt-1">
            Creator Dashboard
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Logged in as <span className="font-semibold text-neutral-800 dark:text-neutral-200">{user.name}</span> ({user.email})
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            id="dashboard-new-product-btn"
            onClick={onOpenUploadModal}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-2 transition-all shadow cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#FF6E40]" />
            <span>Upload New Link</span>
          </button>

          <button
            id="view-magazine-from-dashboard-btn"
            onClick={onSwitchToMagazine}
            className="px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer"
          >
            Preview Magazine
          </button>
        </div>
      </div>

      {/* Real-time Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
        {/* Total Clicks */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Clicks</span>
            <MousePointerClick className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              {totalClicks}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Live Active
            </span>
          </div>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-2">
            Tracked across all published affiliate links
          </p>
          {livePulse && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 animate-pulse" />
          )}
        </div>

        {/* Active Products */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Links</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              {myProducts.length}
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">Published</span>
          </div>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-2">
            Live on PickASAP Curated Magazine
          </p>
        </div>

        {/* Top Performer */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Top Product</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div className="truncate">
            <span className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white block truncate">
              {topProduct ? topProduct.title : 'No data yet'}
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              {topProduct ? `${topProduct.clicksCount} clicks` : 'Upload to start'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-2">
            Highest engagement conversion
          </p>
        </div>

        {/* Partner Stores */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Partner Stores</span>
            <ShoppingBag className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              {uniqueStores.length}
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">Platforms</span>
          </div>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-2 truncate">
            {uniqueStores.length > 0 ? uniqueStores.join(', ') : 'Amazon, Flipkart, Myntra'}
          </p>
        </div>
      </div>

      {/* Main Grid: Products Table + Live Click Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Your Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Your Affiliate Products ({myProducts.length})</span>
            </h2>
            <button
              onClick={onOpenUploadModal}
              className="text-xs text-[#FF6E40] hover:underline font-medium cursor-pointer"
            >
              + Add Another Product
            </button>
          </div>

          {myProducts.length === 0 ? (
            <div className="p-12 rounded-3xl bg-neutral-50 dark:bg-[#13151b] border border-dashed border-neutral-300 dark:border-neutral-800 text-center">
              <Package className="w-10 h-10 mx-auto text-neutral-400 mb-3" />
              <h3 className="font-serif-editorial text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                You haven&apos;t uploaded any affiliate products yet
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1 mb-6">
                Click the + icon in the header or the button below to upload your first product image and affiliate link.
              </p>
              <button
                id="empty-dashboard-upload-btn"
                onClick={onOpenUploadModal}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Upload First Affiliate Link</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-14 h-14 object-cover rounded-xl bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 border border-neutral-200/60 dark:border-neutral-700/60"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {product.store}
                        </span>
                        <span className="text-[11px] text-neutral-400">{product.category}</span>
                      </div>
                      <h4 className="font-serif-editorial font-bold text-sm text-neutral-900 dark:text-white truncate mt-0.5">
                        {product.title}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                        {product.price}
                      </p>
                    </div>
                  </div>

                  {/* Real-time Click Badge & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800">
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-xs font-semibold">
                        <MousePointerClick className="w-3 h-3 text-amber-600" />
                        <span>{product.clicksCount || 0} clicks</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        id={`test-click-${product.id}`}
                        onClick={() => handleTestClick(product)}
                        title="Simulate / Record a real click"
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer transition-colors"
                      >
                        Test Click
                      </button>

                      <button
                        id={`copy-link-${product.id}`}
                        onClick={() => handleCopyLink(product.affiliateUrl, product.id)}
                        title="Copy Affiliate Link"
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        {copiedId === product.id ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <a
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Affiliate Destination"
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <button
                        id={`delete-product-${product.id}`}
                        onClick={() => onDeleteProduct(product.id)}
                        title="Remove product"
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Real-Time Click Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>Real-Time Click Stream</span>
            </h2>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm max-h-[500px] overflow-y-auto space-y-3">
            {clicks.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No clicks recorded yet. When website visitors click on your product recommendations, they will appear here in real time.
              </div>
            ) : (
              clicks.slice(0, 15).map((click) => (
                <div
                  key={click.id}
                  className="p-3 rounded-xl bg-neutral-50/60 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 text-xs flex items-start justify-between gap-3 animate-fade-in"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {click.productTitle}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1 flex items-center gap-2">
                      <span>Store: {click.store}</span>
                      <span>•</span>
                      <span>{new Date(click.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex-shrink-0">
                    +1 Click
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
