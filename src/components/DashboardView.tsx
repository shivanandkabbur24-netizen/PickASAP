import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  MousePointerClick,
  Package,
  ExternalLink,
  Copy,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  Plus,
  ShoppingBag,
  ShieldCheck,
  Tag,
  Clock,
  Edit3,
  Users,
  FileCheck,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  DollarSign,
  ArrowRight,
  BarChart3,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { Product, ClickRecord, UserProfile, PriceSubmission } from '../types';
import { database as db } from '../lib/firebase';
import { AdminPriceUpdateModal } from './AdminPriceUpdateModal';
import { PriceSubmissionsManager } from './PriceSubmissionsManager';
import { TrustedUsersManager } from './TrustedUsersManager';
import { PlatformFeeModal } from './PlatformFeeModal';
import {
  getRevenueTier,
  getCurrentMonthKey,
  formatMonthName,
  getAvailableMonthKeys,
  getMonthlyClicksForUser,
  isPlatformFeePaidForMonth,
  markPlatformFeePaid,
  REVENUE_TIERS,
} from '../lib/revenueModel';

interface DashboardViewProps {
  user: UserProfile;
  products: Product[];
  onOpenUploadModal: () => void;
  onDeleteProduct: (productId: string) => void;
  onSwitchToMagazine: () => void;
  onProductUpdated?: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  products,
  onOpenUploadModal,
  onDeleteProduct,
  onSwitchToMagazine,
  onProductUpdated,
  onSelectProduct,
}) => {
  // Super admin / Owner check
  const isOwnerAdmin =
    user.role === 'admin' ||
    user.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' ||
    user.email?.toLowerCase().trim() === 'shivanandkabbur24@gmail.com' ||
    user.email?.toLowerCase().includes('admin');

  const [activeTab, setActiveTab] = useState<'catalog' | 'clicks' | 'submissions' | 'contributors'>('catalog');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [currentUserState, setCurrentUserState] = useState<UserProfile>(user);
  const [isPlatformFeeModalOpen, setIsPlatformFeeModalOpen] = useState(false);

  useEffect(() => {
    setCurrentUserState(user);
  }, [user]);

  const [clicks, setClicks] = useState<ClickRecord[]>(() => db.getStoredClicks());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(() =>
    db.getSubmissions().filter((s) => s.status === 'pending').length
  );

  // If a non-owner user attempts to switch to restricted tabs, force back to catalog
  useEffect(() => {
    if (!isOwnerAdmin && (activeTab === 'submissions' || activeTab === 'contributors')) {
      setActiveTab('catalog');
    }
  }, [isOwnerAdmin, activeTab]);

  // Load and subscribe to clicks and submissions
  useEffect(() => {
    const unsubscribeClicks = db.subscribeToClicks((liveClicks) => {
      setClicks(liveClicks);
    });

    const unsubscribeSubmissions = db.subscribeToSubmissions((subs) => {
      setPendingCount(subs.filter((s) => s.status === 'pending').length);
    });

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
      unsubscribeClicks();
      if (typeof unsubscribeSubmissions === 'function') unsubscribeSubmissions();
      window.removeEventListener('pickasap:click_recorded', handleLiveClick as EventListener);
    };
  }, []);

  // Creator and Admin catalog scoping
  const [adminCatalogScope, setAdminCatalogScope] = useState<'my' | 'all'>('my');
  const [resettingProductId, setResettingProductId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Filter products for this creator:
  // - Verified creators see their own uploaded products
  // - Admin/Owner can toggle between their uploads and the entire curated catalog
  const myProducts = products.filter((p) => {
    if (isOwnerAdmin && adminCatalogScope === 'all') {
      return true;
    }
    if (p.uploaderId === user.id) return true;
    if (isOwnerAdmin && (p.uploaderId === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' || !p.uploaderId)) return true;
    return false;
  });

  const myProductIds = new Set(myProducts.map((p) => p.id));
  
  // Calculate total authentic clicks for this creator from actual outbound telemetry records
  const getProductAllTimeClicks = (prod: Product): number => {
    return clicks.filter((c) => c.productId === prod.id).length;
  };

  const getProductClicksInMonth = (prod: Product, monthKey: string): number => {
    return clicks.filter(
      (c) => c.productId === prod.id && (c.timestamp || '').startsWith(monthKey)
    ).length;
  };

  const totalClicks = myProducts.reduce((acc, p) => acc + getProductAllTimeClicks(p), 0);
  const topProduct = [...myProducts].sort((a, b) => getProductAllTimeClicks(b) - getProductAllTimeClicks(a))[0];
  const uniqueStores = Array.from(new Set(myProducts.map((p) => p.store)));

  const currentMonthKey = getCurrentMonthKey();
  const currentMonthName = formatMonthName(currentMonthKey);
  const selectedMonthName = formatMonthName(selectedMonthKey);
  const availableMonthKeys = getAvailableMonthKeys();

  // Current Month Authentic Clicks (strictly from real ClickRecords or simulated for tier testing)
  const currentMonthClicks = getMonthlyClicksForUser(
    myProducts,
    clicks,
    currentMonthKey,
    currentUserState
  );

  // Selected Month Authentic Clicks (strictly from real ClickRecords or simulated for tier testing)
  const selectedMonthClicks = getMonthlyClicksForUser(
    myProducts,
    clicks,
    selectedMonthKey,
    currentUserState
  );

  // Filter individual click records matching the selected month and products in scope
  const selectedMonthRecords = clicks.filter((c) => {
    const inScope = myProductIds.has(c.productId);
    const inMonth = (c.timestamp || '').startsWith(selectedMonthKey);
    return inScope && inMonth;
  });

  const currentTier = getRevenueTier(currentMonthClicks);
  const selectedTier = getRevenueTier(selectedMonthClicks);
  const isFeePaid = isOwnerAdmin || isPlatformFeePaidForMonth(currentUserState, currentMonthKey);

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetProductClicks = async (productId: string) => {
    setIsResetting(true);
    try {
      await db.resetProductClicks(productId);
    } catch (err) {
      console.error('Failed to reset clicks for product:', err);
    } finally {
      setIsResetting(false);
      setResettingProductId(null);
    }
  };

  const handleDeleteIndividualClick = async (clickId: string) => {
    try {
      await db.deleteClick(clickId);
    } catch (err) {
      console.error('Failed to delete click record:', err);
    }
  };

  const handleResetFeePaid = () => {
    const currentPaid = (currentUserState.platformFeePaidMonths || []).filter(
      (m) => m !== currentMonthKey
    );
    const updated: UserProfile = { ...currentUserState, platformFeePaidMonths: currentPaid };
    db.saveUserProfile(updated);
    db.setCurrentUser(updated);
    setCurrentUserState(updated);
  };

  const handleInitiateUpload = () => {
    if (!isOwnerAdmin && currentTier.platformFee > 0 && !isFeePaid) {
      setIsPlatformFeeModalOpen(true);
    } else {
      onOpenUploadModal();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Back Navigation: Back to Magazine / Home Page */}
      <div className="mb-5">
        <button
          id="dashboard-back-to-magazine-btn"
          onClick={onSwitchToMagazine}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition-colors shadow-2xs cursor-pointer group"
          title="Back to products / home magazine"
        >
          <ArrowLeft className="w-4 h-4 text-neutral-500 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Magazine</span>
        </button>
      </div>

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
        <div className="flex items-center gap-2.5 flex-wrap">
          {isOwnerAdmin && (
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/90 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs">
              <button
                onClick={() => setAdminCatalogScope('my')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  adminCatalogScope === 'my'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                My Curations ({products.filter((p) => p.uploaderId === user.id || p.uploaderId === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' || !p.uploaderId).length})
              </button>
              <button
                onClick={() => setAdminCatalogScope('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  adminCatalogScope === 'all'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                All Platform Catalog ({products.length})
              </button>
            </div>
          )}

          <button
            id="dashboard-admin-price-mgr-btn"
            onClick={() => {
              setPriceModalProduct(myProducts[0] || products[0] || null);
              setIsPriceModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 text-[#FF6E40]" />
            <span>Verify & Update Prices</span>
          </button>

          <button
            id="dashboard-new-product-btn"
            onClick={handleInitiateUpload}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-2 transition-all shadow cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#FF6E40]" />
            <span>Upload New Link</span>
            {currentTier.platformFee > 0 && !isFeePaid && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-white font-bold">
                Fee Due
              </span>
            )}
          </button>

          {/* Small button on the right side of Upload New Link to purchase premium tier (Test Run) */}
          <button
            id="dashboard-purchase-premium-btn"
            onClick={() => setIsPlatformFeeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-[#FF6E40] to-rose-500 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
            title="Purchase Premium Tier (Test Run)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-100" />
            <span>Purchase Premium</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 pt-6 mb-8 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <button
          id="dashboard-tab-catalog"
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'catalog'
              ? 'border-[#FF6E40] text-[#FF6E40]'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Affiliate Products ({myProducts.length})</span>
        </button>

        {/* Tab 2: Clicks & Analytics */}
        <button
          id="dashboard-tab-clicks"
          onClick={() => setActiveTab('clicks')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'clicks'
              ? 'border-[#FF6E40] text-[#FF6E40]'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <MousePointerClick className="w-4 h-4" />
          <span>Clicks &amp; Analytics</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            {currentMonthClicks.toLocaleString('en-IN')} in {new Date().toLocaleDateString('en-US', { month: 'short' })}
          </span>
        </button>

        {/* Price Review Queue: Only visible to shivanandkabbur24@gmail.com */}
        {isOwnerAdmin && (
          <button
            id="dashboard-tab-submissions"
            onClick={() => setActiveTab('submissions')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'submissions'
                ? 'border-[#FF6E40] text-[#FF6E40]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Price Review Queue</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {/* Trusted Contributors: Only visible to shivanandkabbur24@gmail.com */}
        {isOwnerAdmin && (
          <button
            id="dashboard-tab-contributors"
            onClick={() => setActiveTab('contributors')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'contributors'
                ? 'border-[#FF6E40] text-[#FF6E40]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Trusted Contributors</span>
            {user.isTrustedContributor && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                Trusted
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab 1: Catalog & Telemetry */}
      {activeTab === 'catalog' && (
        <>
          {/* Real-time Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Clicks in Current Month (e.g. September) */}
        <div
          id="dashboard-card-month-clicks"
          onClick={() => setActiveTab('clicks')}
          className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm relative overflow-hidden cursor-pointer hover:border-[#FF6E40] transition-all group"
          title={`Click to view total clicks & monthly breakdown in the Clicks tab`}
        >
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider group-hover:text-[#FF6E40] transition-colors">
              Clicks in {new Date().toLocaleDateString('en-US', { month: 'long' })}
            </span>
            <MousePointerClick className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
              {currentMonthClicks.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {currentMonthName}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px]">
            <span className="text-neutral-500 dark:text-neutral-400 truncate">
              {currentTier.platformFee > 0
                ? isFeePaid
                  ? `✓ ${currentTier.name} (Fee Active)`
                  : `⚠️ ${currentTier.name} (₹${currentTier.platformFee}/mo Due)`
                : 'Free Tier (Under 10k clicks)'}
            </span>
            <span className="text-[10px] text-[#FF6E40] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
              Clicks Tab &rarr;
            </span>
          </div>
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
              {topProduct && getProductAllTimeClicks(topProduct) > 0
                ? `${getProductAllTimeClicks(topProduct)} clicks`
                : 'Upload & share links to start'}
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

      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Your Affiliate Products ({myProducts.length})</span>
          </h2>
          <button
            onClick={handleInitiateUpload}
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
              onClick={handleInitiateUpload}
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
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    onClick={() => onSelectProduct && onSelectProduct(product)}
                    className={`w-16 h-16 object-cover rounded-xl bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs ${
                      onSelectProduct ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {product.store}
                      </span>
                      <span className="text-[11px] text-neutral-400">{product.category}</span>
                    </div>
                    <h4
                      onClick={() => onSelectProduct && onSelectProduct(product)}
                      className={`font-serif-editorial font-bold text-sm sm:text-base text-neutral-900 dark:text-white truncate mt-0.5 ${
                        onSelectProduct ? 'cursor-pointer hover:text-[#FF6E40] transition-colors' : ''
                      }`}
                    >
                      {product.title}
                    </h4>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                        {product.price}
                      </span>
                      {(product.mrp || product.originalPrice) && (product.mrp || product.originalPrice) !== product.price && (
                        <span className="text-[11px] text-neutral-400 line-through font-mono">
                          {product.mrp || product.originalPrice}
                        </span>
                      )}
                      {(product.discount || product.discountPercent) && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {product.discount || product.discountPercent}% off
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        product.dealStatus === 'verified' || !product.dealStatus
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : product.dealStatus === 'pending'
                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        {product.dealStatus === 'verified' || !product.dealStatus ? '✓ Verified Deal' : product.dealStatus === 'pending' ? '⏳ Review Pending' : 'Deal Expired'}
                      </span>
                      {product.lastUpdated && (
                        <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(product.lastUpdated).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Real-time Click Badge & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800 flex-wrap">
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-xs font-semibold">
                      <MousePointerClick className="w-3.5 h-3.5 text-amber-600" />
                      <span>{getProductAllTimeClicks(product)} clicks</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Admin Price Update Button */}
                    <button
                      id={`price-update-${product.id}`}
                      onClick={() => {
                        setPriceModalProduct(product);
                        setIsPriceModalOpen(true);
                      }}
                      title="Update Price & Offer terms"
                      className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-[#FF6E40] hover:text-white dark:hover:bg-[#FF6E40] text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Update Price</span>
                    </button>

                    <button
                      id={`copy-link-${product.id}`}
                      onClick={() => handleCopyLink(product.affiliateUrl, product.id)}
                      title="Copy Affiliate Link"
                      className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
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
                      className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      id={`delete-product-${product.id}`}
                      onClick={() => setProductToDelete(product)}
                      title="Remove product"
                      className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-900/60 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 active:scale-95 cursor-pointer transition-all duration-200 flex items-center justify-center shadow-2xs"
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
      </>
      )}

      {/* Tab 2: Clicks & Analytics (Requested by User) */}
      {activeTab === 'clicks' && (
        <div className="space-y-8 animate-fade-in">
          {/* Key Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Clicks (All Time) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Clicks (All Time)</span>
                <MousePointerClick className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  {totalClicks.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-neutral-400 font-medium">
                  Cumulative
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                Total clicks across all published links
              </p>
            </div>

            {/* Current Month Clicks */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Clicks in {new Date().toLocaleDateString('en-US', { month: 'long' })}</span>
                <Calendar className="w-4 h-4 text-[#FF6E40]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  {currentMonthClicks.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {currentMonthName}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                Active monthly billing period
              </p>
            </div>

            {/* Creator Revenue Tier */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
              <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Active Revenue Tier</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  {currentTier.name}
                </span>
                <span className="text-[11px] font-semibold text-[#FF6E40]">
                  {currentTier.platformFee === 0 ? '₹0/mo' : `₹${currentTier.platformFee}/mo`}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 truncate">
                {currentTier.description}
              </p>
            </div>

            {/* Platform Fee Status */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Upload Permission</span>
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex items-center gap-2">
                  {isOwnerAdmin ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> Admin Exemption: Unlimited Uploads
                    </span>
                  ) : currentTier.platformFee === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> Free Uploads Unlocked
                    </span>
                  ) : isFeePaid ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> Platform Fee Active (Paid)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" /> Fee Required to Upload
                    </span>
                  )}
                </div>
              </div>

              {currentTier.platformFee > 0 && !isFeePaid && (
                <button
                  id="clicks-tab-pay-platform-fee-btn"
                  onClick={() => setIsPlatformFeeModalOpen(true)}
                  className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-[#FF6E40] to-rose-500 text-white text-[11px] font-bold shadow hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-98"
                >
                  <span>Pay ₹{currentTier.platformFee} with Razorpay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Interactive Monthly Breakdown Section */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#13151b] border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF6E40]" />
                  <h3 className="font-serif-editorial text-xl font-bold text-neutral-900 dark:text-white">
                    Clicks in a Particular Month
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Select any month to inspect historical click metrics, tier status, and product conversion breakdowns.
                </p>
              </div>

              {/* Month Selector Dropdown */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  Select Month:
                </label>
                <select
                  id="select-month-dropdown"
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white cursor-pointer focus:outline-none focus:border-[#FF6E40]"
                >
                  {availableMonthKeys.map((key) => (
                    <option key={key} value={key}>
                      {formatMonthName(key)} {key === currentMonthKey ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Pill Selector for Quick Month Switching */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] text-neutral-400 shrink-0">Quick View:</span>
              {availableMonthKeys.slice(0, 6).map((key) => {
                const isSelected = selectedMonthKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedMonthKey(key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#FF6E40] text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {formatMonthName(key, true)} {key === currentMonthKey ? '• Current' : ''}
                  </button>
                );
              })}
            </div>

            {/* Selected Month Highlight Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5 rounded-2xl bg-neutral-50 dark:bg-[#181a24] border border-neutral-200/60 dark:border-neutral-800/60">
              <div className="lg:col-span-2 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {selectedMonthName} Traffic Summary
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
                    {selectedMonthClicks.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Clicks received in {selectedMonthName}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {selectedMonthClicks >= 10000
                    ? `Eligible for ${selectedTier.name} (Fee: ₹${selectedTier.platformFee}/mo). Affiliate earnings unlocked.`
                    : 'Free Tier tier threshold (< 10,000 clicks). No platform fee required for link uploads.'}
                </p>
              </div>

              {/* Store distribution for selected month */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400 block mb-2">
                  Store Attribution ({selectedMonthName})
                </span>
                <div className="space-y-2 text-xs">
                  {['Amazon', 'Flipkart', 'Myntra'].map((storeName) => {
                    const storeClicks = myProducts
                      .filter((p) => p.store === storeName)
                      .reduce((sum, p) => sum + getProductClicksInMonth(p, selectedMonthKey), 0);
                    const pct = selectedMonthClicks > 0 ? Math.round((storeClicks / selectedMonthClicks) * 100) : 0;
                    return (
                      <div key={storeName} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">{storeName}</span>
                          <span className="font-semibold text-neutral-900 dark:text-white">{storeClicks} clicks ({pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              storeName === 'Flipkart'
                                ? 'bg-blue-500'
                                : storeName === 'Amazon'
                                ? 'bg-amber-500'
                                : 'bg-pink-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Product Performance Table for the Selected Month */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center justify-between">
                <span>Product Click Breakdown in {selectedMonthName}</span>
                <span className="text-xs font-normal text-neutral-500">
                  {myProducts.length} published products
                </span>
              </h4>

              {myProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No products published yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Store</th>
                        <th className="py-3 px-4">Verified Price</th>
                        <th className="py-3 px-4 text-right">Clicks in {selectedMonthName}</th>
                        <th className="py-3 px-4 text-right">All-Time Clicks</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {myProducts.map((p) => {
                        const monthCount = getProductClicksInMonth(p, selectedMonthKey);
                        const allTimeCount = getProductAllTimeClicks(p);
                        return (
                          <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={p.imageUrl}
                                  alt={p.title}
                                  className="w-9 h-9 rounded-lg object-cover border border-neutral-200 dark:border-neutral-800 shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <div className="min-w-0 max-w-xs">
                                  <span className="font-semibold text-neutral-900 dark:text-white block truncate">
                                    {p.title}
                                  </span>
                                  <span className="text-[11px] text-neutral-400">{p.category}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                {p.store}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-neutral-800 dark:text-neutral-200">
                              {p.price}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300">
                                {monthCount.toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-neutral-500">
                              {allTimeCount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                <button
                                  onClick={() => handleCopyLink(p.affiliateUrl, p.id)}
                                  className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer inline-flex items-center gap-1"
                                  title="Copy Affiliate Link"
                                >
                                  {copiedId === p.id ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => setResettingProductId(p.id)}
                                  className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer inline-flex items-center gap-1"
                                  title="Reset / Clear all clicks for this product"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Authentic Outbound Store Clicks Activity Stream */}
            <div className="space-y-3 pt-4 border-t border-neutral-200/80 dark:border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Authentic Outbound Store Clicks Stream</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {selectedMonthRecords.length}
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Live chronological log of shoppers who clicked through to external merchant store websites during {selectedMonthName}.
                  </p>
                </div>
              </div>

              {selectedMonthRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                  No outbound store clicks recorded in {selectedMonthName} yet. Clicks register automatically in real-time when shoppers click &ldquo;Shop Now&rdquo;.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Product Clicked</th>
                        <th className="py-3 px-4">Destination Merchant</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {selectedMonthRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                            {new Date(rec.timestamp).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-neutral-900 dark:text-white block max-w-xs truncate">
                              {rec.productTitle}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                rec.store === 'Amazon'
                                  ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                  : rec.store === 'Flipkart'
                                  ? 'bg-blue-500/10 text-blue-800 dark:text-blue-300'
                                  : 'bg-pink-500/10 text-pink-800 dark:text-pink-300'
                              }`}
                            >
                              {rec.store}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteIndividualClick(rec.id)}
                              className="p-1 rounded text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors"
                              title="Delete this click record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Price Submissions & Approvals (Only visible to shivanandkabbur24@gmail.com) */}
      {isOwnerAdmin && activeTab === 'submissions' && (
        <PriceSubmissionsManager
          currentUser={user}
          onProductClick={(prodId) => {
            const found = products.find((p) => p.id === prodId);
            if (found && onSelectProduct) {
              onSelectProduct(found);
            }
          }}
        />
      )}

      {/* Tab 3: Trusted Contributors & User Trust Management (Only visible to shivanandkabbur24@gmail.com) */}
      {isOwnerAdmin && activeTab === 'contributors' && (
        <TrustedUsersManager currentUser={user} />
      )}

      {/* In-App Delete Confirmation Modal (Bypasses iframe alert/confirm restrictions) */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 rounded-3xl w-full max-w-md border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center flex-shrink-0 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  Remove Product?
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-neutral-800 dark:text-neutral-200">"{productToDelete.title}"</span>? This will permanently delete it from both your magazine catalog and analytics stream.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-product-btn"
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteProduct(productToDelete.id);
                    setProductToDelete(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Removing...' : 'Yes, Remove Product'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Product Clicks Confirmation Modal */}
      {resettingProductId && (() => {
        const prod = products.find((p) => p.id === resettingProductId);
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 rounded-3xl w-full max-w-md border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white">
                    Reset Product Clicks to 0?
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    This will permanently clear and delete all historical outbound telemetry click records for <span className="font-semibold text-neutral-800 dark:text-neutral-200">&ldquo;{prod?.title}&rdquo;</span>.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResettingProductId(null)}
                  disabled={isResetting}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="confirm-reset-clicks-btn"
                  type="button"
                  onClick={() => handleResetProductClicks(resettingProductId)}
                  disabled={isResetting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Clearing...' : 'Yes, Reset Clicks to 0'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin Price & Offer Update Modal */}
      <AdminPriceUpdateModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        selectedProduct={priceModalProduct}
        allProducts={products}
        onProductSelect={(prod) => setPriceModalProduct(prod)}
        onUpdateSuccess={(updatedProd) => {
          if (onProductUpdated) {
            onProductUpdated(updatedProd);
          }
        }}
      />

      {/* Creator Platform Fee Modal */}
      <PlatformFeeModal
        isOpen={isPlatformFeeModalOpen}
        onClose={() => setIsPlatformFeeModalOpen(false)}
        user={currentUserState}
        monthlyClicks={currentMonthClicks}
        onPaymentSuccess={() => {
          setIsPlatformFeeModalOpen(false);
          const updatedMonths = [
            ...(currentUserState.platformFeePaidMonths || []),
            currentMonthKey,
          ];
          const updatedUser: UserProfile = {
            ...currentUserState,
            platformFeePaidMonths: updatedMonths,
          };
          setCurrentUserState(updatedUser);
          onOpenUploadModal();
        }}
      />
    </div>
  );
};
