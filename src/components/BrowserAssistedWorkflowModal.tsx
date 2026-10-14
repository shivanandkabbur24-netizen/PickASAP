import React, { useState, useId, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Check,
  X,
  PlayCircle,
  Eye,
  Trash2,
  ShieldCheck,
  Plus,
  FileText,
  RotateCcw,
  AlertTriangle,
  Info,
  CornerDownRight,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import {
  TrackingQueueItem,
  TrackingStatus,
  Product,
  UserProfile,
  VerificationMethod,
  HistoricalPriceObservation,
  CsvValidationRow,
  CsvImportResult
} from '../types';
import { database as db } from '../lib/firebase';

interface BrowserAssistedWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  products: Product[];
  queueItems: TrackingQueueItem[];
  activeItem: TrackingQueueItem | null;
  onSelectNextProduct: () => void;
  onQueueItemUpdated: (updated: TrackingQueueItem) => void;
}

interface ObservationEntryRow {
  id: string;
  observationDate: string;
  price: string;
  currency: string;
  sourceName: string;
  sourceUrl: string;
  verificationMethod: VerificationMethod;
}

const VERIFICATION_METHODS: Array<{ value: VerificationMethod; label: string; description: string }> = [
  {
    value: 'official_store_archive',
    label: 'Official Store Archive',
    description: 'Verified historical snapshot from official store catalog/archive',
  },
  {
    value: 'retailer_invoice',
    label: 'Retailer Invoice / Receipt',
    description: 'Tax invoice or verified retailer billing receipt',
  },
  {
    value: 'admin_audit',
    label: 'Admin Audit & Store Check',
    description: 'Direct manual audit on official merchant portal',
  },
  {
    value: 'web_archive',
    label: 'Authorized Web Archive',
    description: 'Archived snapshot from authorized historical web archives',
  },
  {
    value: 'manual_receipt',
    label: 'Manual Receipt Verification',
    description: 'Manual verification against documented point-of-sale record',
  },
];

export const BrowserAssistedWorkflowModal: React.FC<BrowserAssistedWorkflowModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <BrowserAssistedWorkflowModalContent {...props} />;
};

const BrowserAssistedWorkflowModalContent: React.FC<BrowserAssistedWorkflowModalProps> = ({
  onClose,
  user,
  products,
  queueItems,
  activeItem,
  onSelectNextProduct,
  onQueueItemUpdated,
}) => {
  // Always declare all hooks at the very top
  const baseId = useId();

  // Workflow steps: 1: 'inspect_and_open' | 2: 'enter_observations' | 3: 'preview_and_approve' | 4: 'import_complete'
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [inputTab, setInputTab] = useState<'form' | 'paste'>('form');

  // Input states - NEVER pre-filled with invented numbers (Requirement 5 & 10)
  const [entryRows, setEntryRows] = useState<ObservationEntryRow[]>([
    {
      id: 'row-1',
      observationDate: '',
      price: '',
      currency: 'INR',
      sourceName: '',
      sourceUrl: '',
      verificationMethod: 'admin_audit',
    },
  ]);
  const [pastedContent, setPastedContent] = useState<string>('');

  // Status and database mutation feedback
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Preview & Approval states
  const [previewRows, setPreviewRows] = useState<CsvValidationRow[]>([]);
  const [approvedIndices, setApprovedIndices] = useState<Set<number>>(new Set());
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<CsvImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable product URL if official URL is missing or needs fine-tuning
  const [editingUrl, setEditingUrl] = useState<string>('');

  // Sync active item when it changes
  useEffect(() => {
    if (activeItem) {
      setEditingUrl(activeItem.officialProductUrl || '');
      setCurrentStep(1);
      setImportSummary(null);
      setErrorMessage(null);
      setStatusFeedback(null);
      // Reset observation rows to a clean single empty row
      setEntryRows([
        {
          id: 'row-' + Date.now(),
          observationDate: '',
          price: '',
          currency: 'INR',
          sourceName: '',
          sourceUrl: activeItem.officialProductUrl || '',
          verificationMethod: 'admin_audit',
        },
      ]);
      setPastedContent('');
      setPreviewRows([]);
      setApprovedIndices(new Set());
    }
  }, [activeItem?.id, activeItem?.productId]);

  // Determine remaining unfinished products count
  const unfinishedCount = useMemo(() => {
    return (queueItems || []).filter(
      (item) => ['pending', 'in_review', 'needs_review'].includes(item.trackingStatus) && item.id !== activeItem?.id
    ).length;
  }, [queueItems, activeItem?.id]);

  const nextAvailableUnfinishedItem = useMemo(() => {
    return (queueItems || []).find(
      (item) => ['pending', 'in_review', 'needs_review'].includes(item.trackingStatus) && item.id !== activeItem?.id
    );
  }, [queueItems, activeItem?.id]);

  // Security check: Admin only
  const isOwnerAdmin =
    user?.role === 'admin' ||
    user?.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' ||
    user?.email?.toLowerCase().trim() === 'shivanandkabbur24@gmail.com' ||
    user?.email?.toLowerCase().includes('admin');

  if (!isOwnerAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Admin Access Restricted</h3>
          <p className="text-xs text-neutral-500">
            The browser-assisted price-history workflow is strictly reserved for authorized administrators.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!activeItem) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">All Products Processed</h3>
          <p className="text-xs text-neutral-500">
            No unfinished products are pending in the tracking queue. All products have been either imported, verified, or marked unavailable.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Return to Queue
          </button>
        </div>
      </div>
    );
  }

  // 1. Action: Open Product Page in New Browser Tab (Requirement 3)
  const handleOpenProductPage = () => {
    const url = editingUrl.trim() || activeItem.officialProductUrl;
    if (!url) {
      setErrorMessage('No official product URL specified. Please enter a valid URL below first.');
      return;
    }
    // Open in a new browser tab with security rels
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 2. Action: Mark Ready for Review (Requirement 4)
  const handleMarkReadyForReview = async () => {
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    try {
      const updatedItem: TrackingQueueItem = {
        ...activeItem,
        officialProductUrl: editingUrl.trim() || activeItem.officialProductUrl,
        trackingStatus: 'in_review',
        lastProcessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewNotes: 'Verified official product page opened; administrator audit in review.',
      };

      // Persist to database & trigger real-time updates
      await db.saveTrackingQueueItem(updatedItem);
      onQueueItemUpdated(updatedItem);

      // Also notify backend server
      fetch('/api/price-history/tracking-queue/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
          'x-admin-user-id': user.id,
          'x-admin-email': user.email,
        },
        body: JSON.stringify(updatedItem),
      }).catch((e) => console.warn('Backend tracking queue update notice:', e));

      setStatusFeedback('Product status updated to "In Review" and saved to database.');
      setTimeout(() => setStatusFeedback(null), 3500);
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Error marking ready for review:', err);
      setErrorMessage('Failed to update tracking status to In Review.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Action: Mark Product as Unavailable (Requirement 10)
  const handleMarkUnavailable = async () => {
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    try {
      const updatedItem: TrackingQueueItem = {
        ...activeItem,
        officialProductUrl: editingUrl.trim() || activeItem.officialProductUrl,
        trackingStatus: 'unavailable',
        lastProcessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewNotes: 'Marked unavailable: No permitted official archive or historical records found.',
      };

      await db.saveTrackingQueueItem(updatedItem);
      onQueueItemUpdated(updatedItem);

      fetch('/api/price-history/tracking-queue/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
          'x-admin-user-id': user.id,
          'x-admin-email': user.email,
        },
        body: JSON.stringify(updatedItem),
      }).catch(() => {});

      setStatusFeedback('Marked as Unavailable in database.');
      // Auto advance to next unfinished product
      if (nextAvailableUnfinishedItem) {
        setTimeout(() => {
          onSelectNextProduct();
        }, 1200);
      } else {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Error marking unavailable:', err);
      setErrorMessage('Failed to update status to Unavailable.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Action: Leave as Pending (Requirement 10)
  const handleLeavePending = async () => {
    setIsUpdatingStatus(true);
    try {
      const updatedItem: TrackingQueueItem = {
        ...activeItem,
        officialProductUrl: editingUrl.trim() || activeItem.officialProductUrl,
        trackingStatus: 'pending',
        lastProcessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewNotes: 'Left pending for future audit.',
      };

      await db.saveTrackingQueueItem(updatedItem);
      onQueueItemUpdated(updatedItem);

      if (nextAvailableUnfinishedItem) {
        onSelectNextProduct();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Error leaving pending:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Helper: Add Observation Entry Row
  const handleAddEntryRow = () => {
    setEntryRows((prev) => [
      ...prev,
      {
        id: 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        observationDate: '',
        price: '',
        currency: 'INR',
        sourceName: '',
        sourceUrl: activeItem.officialProductUrl || '',
        verificationMethod: 'admin_audit',
      },
    ]);
  };

  // Helper: Remove Entry Row
  const handleRemoveEntryRow = (id: string) => {
    setEntryRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  // Helper: Update Entry Row Field
  const handleUpdateEntryRow = (id: string, field: keyof ObservationEntryRow, val: string) => {
    setEntryRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  // Helper: Parse pasted text or form into standard rows
  const generateParsedRowsToValidate = (): Array<Record<string, string>> => {
    if (inputTab === 'paste') {
      const lines = pastedContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const parsed: Array<Record<string, string>> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.toLowerCase().includes('observation_date') || line.toLowerCase().includes('price'))) {
          continue;
        }

        // Support comma or tab separated values
        const delimiter = line.includes('\t') ? '\t' : ',';
        const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));

        if (cols.length >= 2) {
          // Columns: [0]: date, [1]: price, [2]: source_name (optional), [3]: verification_method (optional), [4]: source_url (optional)
          parsed.push({
            product_id: activeItem.productId,
            observation_date: cols[0] || '',
            price: cols[1] || '',
            currency: 'INR',
            source_name: cols[2] || `${activeItem.marketplace} Official Observation`,
            source_url: cols[4] || activeItem.officialProductUrl || '',
            source_observed_at: new Date().toISOString(),
            verification_method: cols[3] || 'admin_audit',
            review_status: 'approved',
          });
        }
      }
      return parsed;
    } else {
      // From manual form rows
      return entryRows
        .filter((r) => r.observationDate.trim() && r.price.trim())
        .map((r) => ({
          product_id: activeItem.productId,
          observation_date: r.observationDate.trim(),
          price: r.price.trim(),
          currency: r.currency || 'INR',
          source_name: r.sourceName.trim() || `${activeItem.marketplace} Store Listing`,
          source_url: r.sourceUrl.trim() || activeItem.officialProductUrl || '',
          source_observed_at: new Date().toISOString(),
          verification_method: r.verificationMethod || 'admin_audit',
          review_status: 'approved',
        }));
    }
  };

  // 3. Action: Preview & Validate Records (Requirement 6)
  const handlePreviewAndValidate = async () => {
    setErrorMessage(null);
    const candidateRows = generateParsedRowsToValidate();

    if (candidateRows.length === 0) {
      setErrorMessage(
        'Please enter at least one valid observation date and price before previewing. Empty records cannot be imported.'
      );
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch('/api/price-history/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
          'x-admin-user-id': user.id,
          'x-admin-email': user.email,
        },
        body: JSON.stringify({ rows: candidateRows }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Server validation failed');
      }

      const rows: CsvValidationRow[] = json.data?.rows || [];
      setPreviewRows(rows);

      // Default to approving all valid non-duplicate rows
      const initialApproved = new Set<number>();
      rows.forEach((r, idx) => {
        if (r.isValid && !r.isDuplicate) {
          initialApproved.add(idx);
        }
      });
      setApprovedIndices(initialApproved);
      setCurrentStep(3);
    } catch (err: any) {
      console.error('Validation error:', err);
      setErrorMessage(err?.message || 'Error occurred while validating price observations.');
    } finally {
      setIsValidating(false);
    }
  };

  // Toggle individual row approval
  const handleToggleRowApproval = (index: number) => {
    setApprovedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 4. Action: Confirm & Import Approved Records (Requirement 7)
  const handleConfirmImport = async () => {
    if (approvedIndices.size === 0) {
      setErrorMessage('No records selected for import. Please approve at least one record.');
      return;
    }

    const observationsToImport: HistoricalPriceObservation[] = [];
    approvedIndices.forEach((idx) => {
      const row = previewRows[idx];
      if (row && row.parsedData) {
        observationsToImport.push(row.parsedData);
      }
    });

    if (observationsToImport.length === 0) {
      setErrorMessage('None of the selected rows contain valid parsed observation data.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      // Send to server import endpoint
      const res = await fetch('/api/price-history/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
          'x-admin-user-id': user.id,
          'x-admin-email': user.email,
        },
        body: JSON.stringify({ observations: observationsToImport }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Import failed on server');
      }

      const result: CsvImportResult = json.data;
      setImportSummary(result);

      // Mark the product as 'imported' in the database (Requirement 7 & 8)
      const updatedItem: TrackingQueueItem = {
        ...activeItem,
        trackingStatus: 'imported',
        lastProcessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewNotes: `Successfully imported ${result.successful} verified historical price record(s).`,
      };

      await db.saveTrackingQueueItem(updatedItem);
      onQueueItemUpdated(updatedItem);

      // Broadcast update to product views and charts
      window.dispatchEvent(
        new CustomEvent('pickasap:price_snapshot_added', {
          detail: { productId: activeItem.productId, importedCount: result.successful },
        })
      );

      setCurrentStep(4);
    } catch (err: any) {
      console.error('Import execution error:', err);
      setErrorMessage(err?.message || 'Error occurred while importing price records.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 rounded-3xl w-full max-w-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6E40]/10 flex items-center justify-center text-[#FF6E40] border border-[#FF6E40]/20">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF6E40]/10 text-[#FF6E40]">
                  Browser-Assisted Workflow
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  {unfinishedCount} other unfinished in queue
                </span>
              </div>
              <h2 className="text-lg font-bold font-serif-editorial text-neutral-900 dark:text-white mt-0.5">
                Price-History Audit &amp; Verification
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close workflow"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Step Indicator */}
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141a] flex items-center justify-between text-xs font-medium text-neutral-500">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep >= 1 ? 'bg-[#FF6E40] text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}
            >
              1
            </span>
            <span className={currentStep === 1 ? 'text-neutral-900 dark:text-white font-bold' : ''}>
              Product &amp; URL
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-700" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep >= 2 ? 'bg-[#FF6E40] text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}
            >
              2
            </span>
            <span className={currentStep === 2 ? 'text-neutral-900 dark:text-white font-bold' : ''}>
              Enter Observations
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-700" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep >= 3 ? 'bg-[#FF6E40] text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}
            >
              3
            </span>
            <span className={currentStep === 3 ? 'text-neutral-900 dark:text-white font-bold' : ''}>
              Preview &amp; Approve
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-700" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep >= 4 ? 'bg-emerald-500 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}
            >
              4
            </span>
            <span className={currentStep === 4 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
              Imported
            </span>
          </div>
        </div>

        {/* Feedback / Error notifications */}
        {statusFeedback && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Active Product Details Card */}
          <div className="p-4.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                    {activeItem.marketplace || 'Marketplace'}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
                    ID: {activeItem.productId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      activeItem.trackingStatus === 'imported'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : activeItem.trackingStatus === 'in_review'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        : activeItem.trackingStatus === 'unavailable'
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    Status: {activeItem.trackingStatus}
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-1">
                  {activeItem.productName}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Exact Variant:</span>{' '}
                  {activeItem.exactModelVariant || 'Standard Model / Baseline'}
                </p>
              </div>

              {/* Action Buttons for Official URL & Review Status */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenProductPage}
                  className="px-3.5 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#ff5722] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Open official URL in a new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Product Page</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkReadyForReview}
                  disabled={isUpdatingStatus}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="Update queue status to in_review and save to database"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Mark Ready for Review</span>
                </button>
              </div>
            </div>

            {/* Official Product URL Field */}
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Official Product URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={editingUrl}
                  onChange={(e) => setEditingUrl(e.target.value)}
                  placeholder="https://www.amazon.in/dp/... or https://www.flipkart.com/..."
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#FF6E40]"
                />
                <button
                  type="button"
                  onClick={handleOpenProductPage}
                  className="p-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 text-xs cursor-pointer"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Compliance & Policy Banner (Requirements 9 & 10) */}
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[11px] uppercase tracking-wider text-blue-800 dark:text-blue-200">
                Data Integrity &amp; Responsible Sourcing Policy
              </p>
              <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                Observe prices directly on the official product tab. Enter only authentic observations backed by retailer invoices, official launch archives, or verified store checks. <span className="font-semibold">Do not scrape BuyHatke, bypass restrictions, or fabricate unverified prices.</span>
              </p>
            </div>
          </div>

          {/* STEP 1: Ready to proceed */}
          {currentStep === 1 && (
            <div className="p-6 text-center space-y-4 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-3xl bg-neutral-50/50 dark:bg-neutral-900/50">
              <ExternalLink className="w-10 h-10 text-[#FF6E40] mx-auto opacity-80" />
              <div className="max-w-md mx-auto">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                  Step 1: Open Official URL &amp; Review Listing
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Click "Open Product Page" to examine the live pricing, model variant, and available purchase records in a new browser tab.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenProductPage}
                  className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Official Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#ff5722] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Proceed to Observations Entry</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Enter or Paste Observations (Requirements 5 & 10) */}
          {(currentStep === 2 || currentStep === 3) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span>Historical Observations Data</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                      Never Auto-Generated
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Enter or paste verified dates, prices, and verification methods observed from the retailer.
                  </p>
                </div>

                {/* Input Mode Switch */}
                <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setInputTab('form')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      inputTab === 'form'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Form Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTab('paste')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      inputTab === 'paste'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Paste Raw / CSV
                  </button>
                </div>
              </div>

              {/* Mode A: Form Entry Rows */}
              {inputTab === 'form' && (
                <div className="space-y-3">
                  {entryRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500">
                        <span>Observation Record #{idx + 1}</span>
                        {entryRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEntryRow(row.id)}
                            className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        {/* Observation Date */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                            Observation Date *
                          </label>
                          <input
                            type="date"
                            value={row.observationDate}
                            onChange={(e) => handleUpdateEntryRow(row.id, 'observationDate', e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                          />
                        </div>

                        {/* Price (INR) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                            Price (₹ INR) *
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="e.g. 49990"
                            value={row.price}
                            onChange={(e) => handleUpdateEntryRow(row.id, 'price', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono"
                          />
                        </div>

                        {/* Verification Method */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                            Verification Method *
                          </label>
                          <select
                            value={row.verificationMethod}
                            onChange={(e) =>
                              handleUpdateEntryRow(row.id, 'verificationMethod', e.target.value as VerificationMethod)
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white cursor-pointer"
                          >
                            {VERIFICATION_METHODS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {/* Source Name */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                            Source Name / Context *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Official Launch Event, Festive Sale, Retail Invoice"
                            value={row.sourceName}
                            onChange={(e) => handleUpdateEntryRow(row.id, 'sourceName', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                          />
                        </div>

                        {/* Source URL (optional) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                            Source / Proof URL (Optional)
                          </label>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={row.sourceUrl}
                            onChange={(e) => handleUpdateEntryRow(row.id, 'sourceUrl', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddEntryRow}
                    className="w-full py-2.5 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-[#FF6E40] text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-[#FF6E40] flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-white dark:bg-neutral-900"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Historical Observation Row</span>
                  </button>
                </div>
              )}

              {/* Mode B: Paste CSV / Lines */}
              {inputTab === 'paste' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>Format: date, price, source_name, verification_method, source_url</span>
                  </div>
                  <textarea
                    rows={6}
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder={`2024-05-15, 49990, Official Launch, official_store_archive, https://...\n2024-10-08, 39999, Festival Promotion, retailer_invoice, https://...`}
                    className="w-full p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 font-mono text-xs text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#FF6E40]"
                  />
                </div>
              )}

              {/* Alternative Actions: If no permitted source is available (Requirement 10) */}
              <div className="p-3.5 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    No verified historical data available?
                  </span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Never invent prices. Mark product unavailable or leave pending for subsequent audit.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkUnavailable}
                    disabled={isUpdatingStatus}
                    className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-semibold text-xs cursor-pointer disabled:opacity-50"
                  >
                    Mark Unavailable
                  </button>
                  <button
                    type="button"
                    onClick={handleLeavePending}
                    disabled={isUpdatingStatus}
                    className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs cursor-pointer"
                  >
                    Leave Pending
                  </button>
                </div>
              </div>

              {/* Action to proceed to Preview */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePreviewAndValidate}
                  disabled={isValidating}
                  className="px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Eye className="w-4 h-4 text-[#FF6E40]" />
                  <span>{isValidating ? 'Validating...' : 'Preview & Review Records'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview, Review & Individual Approval/Rejection (Requirement 6) */}
          {currentStep === 3 && previewRows.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Step 3: Preview &amp; Approve Records
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Review each observation carefully. You can approve or reject individual records prior to import.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allValid = new Set<number>();
                      previewRows.forEach((r, idx) => {
                        if (r.isValid) allValid.add(idx);
                      });
                      setApprovedIndices(allValid);
                    }}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-200 cursor-pointer"
                  >
                    Select All Valid
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovedIndices(new Set())}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-200 cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Table of Preview Records */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase font-bold text-neutral-500">
                      <th className="py-2.5 px-3 w-10 text-center">Approve</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3">Source &amp; Method</th>
                      <th className="py-2.5 px-3 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                    {previewRows.map((row, idx) => {
                      const isApproved = approvedIndices.has(idx);
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isApproved
                              ? 'bg-emerald-50/20 dark:bg-emerald-950/20'
                              : 'bg-neutral-50/40 dark:bg-neutral-900/40 opacity-70'
                          }`}
                        >
                          {/* Checkbox / Toggle */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isApproved}
                              disabled={!row.isValid}
                              onChange={() => handleToggleRowApproval(idx)}
                              className="rounded border-neutral-300 text-[#FF6E40] focus:ring-[#FF6E40] cursor-pointer"
                            />
                          </td>

                          {/* Date */}
                          <td className="py-2.5 px-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                            {row.parsedData?.observation_date ? row.parsedData.observation_date.split('T')[0] : '—'}
                          </td>

                          {/* Price */}
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                            ₹{row.parsedData?.price?.toLocaleString('en-IN') || '—'}
                          </td>

                          {/* Source & Method */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-xs">
                              {row.parsedData?.source_name}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              {row.parsedData?.verification_method}
                            </div>
                          </td>

                          {/* Validation Status */}
                          <td className="py-2.5 px-3 text-right">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Check className="w-3.5 h-3.5" />
                                <span>Valid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500" title={row.errors.join(', ')}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Invalid</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  &larr; Back to Edit
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 font-medium">
                    {approvedIndices.size} record(s) approved
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting || approvedIndices.size === 0}
                    className="px-5 py-2.5 rounded-xl bg-[#FF6E40] hover:bg-[#ff5722] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isImporting ? 'Importing...' : `Import ${approvedIndices.size} Record(s)`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Import Complete & Process Next Product (Requirement 7) */}
          {currentStep === 4 && importSummary && (
            <div className="p-8 text-center space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold font-serif-editorial text-neutral-900 dark:text-white">
                  Price History Successfully Imported
                </h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  {importSummary.successful} observation record(s) have been verified, recorded, and saved to the PickASAP database for <span className="font-semibold text-neutral-800 dark:text-neutral-200">"{activeItem.productName}"</span>.
                </p>
                <div className="pt-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    Queue Status: Imported
                  </span>
                </div>
              </div>

              {/* Next Product Button (Requirement 1 & 7) */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                {nextAvailableUnfinishedItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectNextProduct();
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#FF6E40] hover:bg-[#ff5722] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Process Next Product ({nextAvailableUnfinishedItem.productName.slice(0, 20)}...) &rarr;</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold cursor-pointer"
                  >
                    Return to Queue (All Finished!)
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Close Workflow
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
