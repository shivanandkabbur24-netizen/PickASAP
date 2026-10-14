import React, { useState, useEffect, useMemo } from 'react';
import {
  ListFilter,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  Plus,
  RefreshCw,
  Upload,
  Download,
  Edit2,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
  ChevronRight,
  Save,
  X,
  PlayCircle
} from 'lucide-react';
import { TrackingQueueItem, TrackingStatus, Product, UserProfile } from '../types';
import { database as db, getStoredTrackingQueue } from '../lib/firebase';
import { BrowserAssistedWorkflowModal } from './BrowserAssistedWorkflowModal';

interface ProductTrackingQueueProps {
  user: UserProfile;
  products: Product[];
  onOpenImportForProduct?: (productId: string) => void;
  onOpenDirectCsvImport?: () => void;
}

const STATUS_CONFIG: Record<
  TrackingStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-700 dark:text-neutral-300',
    border: 'border-neutral-300 dark:border-neutral-700',
    icon: <Clock className="w-3.5 h-3.5 text-neutral-500" />,
  },
  in_review: {
    label: 'In Review',
    bg: 'bg-amber-500/10 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-500/30 dark:border-amber-800',
    icon: <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />,
  },
  approved: {
    label: 'Approved',
    bg: 'bg-blue-500/10 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30 dark:border-blue-800',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />,
  },
  imported: {
    label: 'Imported',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  },
  needs_review: {
    label: 'Needs Review',
    bg: 'bg-purple-500/10 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30 dark:border-purple-800',
    icon: <AlertCircle className="w-3.5 h-3.5 text-purple-500" />,
  },
  unavailable: {
    label: 'Unavailable',
    bg: 'bg-rose-500/10 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30 dark:border-rose-800',
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-500" />,
  },
};

export const ProductTrackingQueue: React.FC<ProductTrackingQueueProps> = ({
  user,
  products,
  onOpenImportForProduct,
  onOpenDirectCsvImport,
}) => {
  // Always declare all hooks at the very top (Rules of Hooks)
  const [queueItems, setQueueItems] = useState<TrackingQueueItem[]>(() => {
    const cached = getStoredTrackingQueue();
    return Array.isArray(cached) ? cached : [];
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingItem, setEditingItem] = useState<TrackingQueueItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Browser-assisted workflow modal states
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState<boolean>(false);
  const [workflowActiveItem, setWorkflowActiveItem] = useState<TrackingQueueItem | null>(null);

  // Subscribe to real-time changes
  useEffect(() => {
    const unsubscribe = db.subscribeToTrackingQueue((live) => {
      if (Array.isArray(live)) {
        setQueueItems(live);
      }
    });
    db.getTrackingQueue()
      .then((items) => {
        if (Array.isArray(items)) {
          setQueueItems(items);
        }
      })
      .catch((err) => console.warn('Failed to load tracking queue:', err));
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const safeQueueItems = Array.isArray(queueItems) ? queueItems : [];

  // Filtered queue items
  const filteredItems = useMemo(() => {
    return safeQueueItems.filter((item) => {
      if (filterStatus !== 'all' && item.trackingStatus !== filterStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (item.productName || '').toLowerCase().includes(q);
        const matchesId = (item.productId || '').toLowerCase().includes(q);
        const matchesMarketplace = (item.marketplace || '').toLowerCase().includes(q);
        const matchesVariant = (item.exactModelVariant || '').toLowerCase().includes(q);
        return matchesName || matchesId || matchesMarketplace || matchesVariant;
      }
      return true;
    });
  }, [safeQueueItems, filterStatus, searchQuery]);

  // Counts by status
  const counts = useMemo(() => {
    const res: Record<string, number> = {
      all: safeQueueItems.length,
      pending: 0,
      in_review: 0,
      approved: 0,
      imported: 0,
      needs_review: 0,
      unavailable: 0,
    };
    safeQueueItems.forEach((it) => {
      if (res[it.trackingStatus] !== undefined) {
        res[it.trackingStatus]++;
      }
    });
    return res;
  }, [safeQueueItems]);

  // Find first unfinished item in the queue (Requirements 1 & 2)
  const firstUnfinishedItem = useMemo(() => {
    return safeQueueItems.find((it) =>
      ['pending', 'in_review', 'needs_review'].includes(it.trackingStatus)
    );
  }, [safeQueueItems]);

  // Security check: Administrator only
  const isOwnerAdmin =
    user?.role === 'admin' ||
    user?.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' ||
    user?.email?.toLowerCase().trim() === 'shivanandkabbur24@gmail.com' ||
    user?.email?.toLowerCase().includes('admin');

  if (!isOwnerAdmin) {
    return (
      <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-3xl">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Admin Access Required</h3>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
          The Product Tracking Queue is strictly restricted to authorized administrators.
        </p>
      </div>
    );
  }

  // 1. Action: Process Next Product (Requirement 1 & 2)
  const handleProcessNextProduct = () => {
    const targetItem = firstUnfinishedItem || safeQueueItems[0] || null;
    if (targetItem) {
      setWorkflowActiveItem(targetItem);
      setIsWorkflowModalOpen(true);
    } else {
      setSaveToast('All products in tracking queue are finished!');
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  // Action: Launch workflow for specific item
  const handleStartWorkflowForProduct = (item: TrackingQueueItem) => {
    setWorkflowActiveItem(item);
    setIsWorkflowModalOpen(true);
  };

  // Action: Advance to next unfinished product from within workflow modal (Requirement 7)
  const handleSelectNextProductFromModal = () => {
    const currentId = workflowActiveItem?.id || workflowActiveItem?.productId;
    const remaining = safeQueueItems.filter(
      (it) =>
        ['pending', 'in_review', 'needs_review'].includes(it.trackingStatus) &&
        it.id !== currentId &&
        it.productId !== currentId
    );

    if (remaining.length > 0) {
      setWorkflowActiveItem(remaining[0]);
    } else {
      setIsWorkflowModalOpen(false);
      setWorkflowActiveItem(null);
      setSaveToast('Queue complete: All unfinished products have been audited!');
      setTimeout(() => setSaveToast(null), 3500);
    }
  };

  // Action: Update queue item in local list and trigger UI refresh
  const handleQueueItemUpdated = (updated: TrackingQueueItem) => {
    setQueueItems((prev) => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      const idx = copy.findIndex((q) => q.id === updated.id || q.productId === updated.productId);
      if (idx !== -1) {
        copy[idx] = updated;
      } else {
        copy.push(updated);
      }
      return copy;
    });
  };

  // Status update handler (immediate persistence)
  const handleUpdateStatus = async (item: TrackingQueueItem, newStatus: TrackingStatus) => {
    try {
      const updated: TrackingQueueItem = {
        ...item,
        trackingStatus: newStatus,
        lastProcessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveTrackingQueueItem(updated);
      handleQueueItemUpdated(updated);
      setSaveToast(`Status updated to ${STATUS_CONFIG[newStatus].label} for ${item.productName.slice(0, 24)}...`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      console.error('Error updating status:', err);
    }
  };

  // Save edit modal
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const updated: TrackingQueueItem = {
        ...editingItem,
        lastProcessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveTrackingQueueItem(updated);
      handleQueueItemUpdated(updated);
      setEditingItem(null);
      setSaveToast(`Saved details for ${updated.productName.slice(0, 24)}...`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      console.error('Save edit error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Sync catalog to queue
  const handleSyncCatalog = async () => {
    setIsRefreshing(true);
    try {
      const current = await db.getTrackingQueue();
      const existingIds = new Set(current.map((q) => q.productId));
      let added = 0;
      for (const p of products) {
        if (!existingIds.has(p.id)) {
          const hasHist = Array.isArray(p.priceHistory) && p.priceHistory.length > 0;
          const newItem: TrackingQueueItem = {
            id: p.id,
            productId: p.id,
            productName: p.title,
            officialProductUrl: p.productUrl || p.affiliateUrl || '',
            marketplace: p.marketplace || p.store || 'Amazon',
            exactModelVariant: p.modelIdentifier || p.brand || 'Standard Variant',
            trackingStatus: hasHist ? 'imported' : 'pending',
            lastProcessedAt: new Date().toISOString(),
            reviewNotes: hasHist ? 'Verified initial catalog baseline' : 'Awaiting historical observations import',
            errorDetails: '',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await db.saveTrackingQueueItem(newItem);
          added++;
        }
      }
      setSaveToast(`Synchronized queue with catalog (${added} new items enrolled)`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error('Sync catalog error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sampleProduct = safeQueueItems[0] || { productId: 'prod_1789196748190_ji01p' };
    const csvContent =
      `product_id,observation_date,price,currency,source_name,source_url,source_observed_at,verification_method,review_status\n` +
      `${sampleProduct.productId},2024-05-15,49990,INR,Official Launch,https://flipkart.com,2024-05-15T10:00:00Z,official_store_archive,approved\n` +
      `${sampleProduct.productId},2024-09-28,38990,INR,Flipkart Big Billion Days,https://flipkart.com,2024-09-28T04:00:00Z,retailer_invoice,approved\n` +
      `${sampleProduct.productId},2026-02-15,49990,INR,Post-Holiday Retail List,https://flipkart.com,2026-02-15T09:00:00Z,admin_audit,approved\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pickasap_sample_price_import.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {saveToast && (
        <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl px-4 py-2.5 shadow-sm transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header with Title and Quick Actions */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/20">
              Admin Product Queue
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Persistent &bull; Immediate Cloud Sync
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-editorial text-neutral-900 dark:text-white mt-1">
            Price History Tracking Queue
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
            Semi-automatic workflow to track official URLs, marketplace models, audit price history data, and resume unfinished items across browser reloads.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Requirement 1: Clear "Process Next Product" button */}
          <button
            onClick={handleProcessNextProduct}
            className="px-4 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#ff5722] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Process next unfinished product in tracking queue"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Process Next Product</span>
            {firstUnfinishedItem && (
              <span className="hidden xl:inline text-white/80 font-normal">
                ({firstUnfinishedItem.productName.slice(0, 16)}...)
              </span>
            )}
          </button>

          <button
            onClick={onOpenDirectCsvImport}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#FF6E40]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleDownloadSampleCsv}
            className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download CSV format template"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sample CSV</span>
          </button>

          <button
            onClick={handleSyncCatalog}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Synchronize all catalog products into queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF6E40]' : 'text-neutral-500'}`} />
            <span>Sync Catalog</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_review', label: 'In Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'imported', label: 'Imported' },
            { id: 'needs_review', label: 'Needs Review' },
            { id: 'unavailable', label: 'Unavailable' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                filterStatus === tab.id
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filterStatus === tab.id
                    ? 'bg-white/20 dark:bg-neutral-900/20 text-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                {counts[tab.id] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product, model, or ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#FF6E40]"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850/50 text-[11px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                <th className="py-3 px-4">Product &amp; Model</th>
                <th className="py-3 px-3">Marketplace</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Last Processed</th>
                <th className="py-3 px-4">Review Notes &amp; Errors</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const statusInfo = STATUS_CONFIG[item.trackingStatus] || STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={item.id || item.productId}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 transition-colors"
                    >
                      {/* Product Name & ID */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-neutral-900 dark:text-white truncate" title={item.productName}>
                          {item.productName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400 font-mono">
                          <span>{item.productId}</span>
                          <span>&bull;</span>
                          <span className="text-neutral-600 dark:text-neutral-300">{item.exactModelVariant}</span>
                        </div>
                      </td>

                      {/* Marketplace & Link */}
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium text-[11px]">
                          <span>{item.marketplace}</span>
                          {item.officialProductUrl && (
                            <a
                              href={item.officialProductUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-400 hover:text-[#FF6E40]"
                              title="Open official URL"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Status Dropdown */}
                      <td className="py-3 px-3">
                        <div className="relative inline-block">
                          <select
                            value={item.trackingStatus}
                            onChange={(e) => handleUpdateStatus(item, e.target.value as TrackingStatus)}
                            className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-colors cursor-pointer appearance-none pr-6 ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_review">In Review</option>
                            <option value="approved">Approved</option>
                            <option value="imported">Imported</option>
                            <option value="needs_review">Needs Review</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-neutral-500">
                            ▼
                          </div>
                        </div>
                      </td>

                      {/* Last Processed */}
                      <td className="py-3 px-3 text-[11px] text-neutral-500 font-mono">
                        {item.lastProcessedAt
                          ? new Date(item.lastProcessedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                            })
                          : 'Never'}
                      </td>

                      {/* Review Notes & Errors */}
                      <td className="py-3 px-4 max-w-sm">
                        {item.reviewNotes && (
                          <div className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate" title={item.reviewNotes}>
                            {item.reviewNotes}
                          </div>
                        )}
                        {item.errorDetails && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate mt-0.5" title={item.errorDetails}>
                            ⚠️ {item.errorDetails}
                          </div>
                        )}
                        {!item.reviewNotes && !item.errorDetails && (
                          <span className="text-[10px] text-neutral-400 italic">No notes</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartWorkflowForProduct(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF6E40]/10 hover:bg-[#FF6E40] text-[#FF6E40] hover:text-white transition-all font-semibold text-[11px] cursor-pointer"
                            title="Open browser-assisted price audit workflow for this product"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Workflow</span>
                          </button>

                          <button
                            onClick={() => {
                              if (onOpenImportForProduct) {
                                onOpenImportForProduct(item.productId);
                              } else if (onOpenDirectCsvImport) {
                                onOpenDirectCsvImport();
                              }
                            }}
                            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#FF6E40] transition-colors cursor-pointer"
                            title="Import CSV price observations for this product"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Edit notes, model variant, or error details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                  Edit Tracking Queue Item
                </h3>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  Product ID: {editingItem.productId}
                </p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Product Title
                </label>
                <input
                  type="text"
                  value={editingItem.productName}
                  onChange={(e) => setEditingItem({ ...editingItem, productName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Marketplace
                  </label>
                  <input
                    type="text"
                    value={editingItem.marketplace}
                    onChange={(e) => setEditingItem({ ...editingItem, marketplace: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Exact Model / Variant
                  </label>
                  <input
                    type="text"
                    value={editingItem.exactModelVariant}
                    onChange={(e) => setEditingItem({ ...editingItem, exactModelVariant: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Official Product URL
                </label>
                <input
                  type="url"
                  value={editingItem.officialProductUrl}
                  onChange={(e) => setEditingItem({ ...editingItem, officialProductUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Tracking Status
                </label>
                <select
                  value={editingItem.trackingStatus}
                  onChange={(e) => setEditingItem({ ...editingItem, trackingStatus: e.target.value as TrackingStatus })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                  <option value="imported">Imported</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Review Notes
                </label>
                <textarea
                  rows={2}
                  value={editingItem.reviewNotes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, reviewNotes: e.target.value })}
                  placeholder="e.g. Launch price verified via official retailer invoice"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Error Details (if flagged)
                </label>
                <textarea
                  rows={2}
                  value={editingItem.errorDetails || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, errorDetails: e.target.value })}
                  placeholder="e.g. Discontinued variant or URL redirect mismatch"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#ff5722] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save & Persist'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browser-Assisted Price-History Workflow Modal */}
      {isWorkflowModalOpen && (
        <BrowserAssistedWorkflowModal
          isOpen={isWorkflowModalOpen}
          onClose={() => {
            setIsWorkflowModalOpen(false);
            setWorkflowActiveItem(null);
          }}
          user={user}
          products={products}
          queueItems={safeQueueItems}
          activeItem={workflowActiveItem}
          onSelectNextProduct={handleSelectNextProductFromModal}
          onQueueItemUpdated={handleQueueItemUpdated}
        />
      )}
    </div>
  );
};
