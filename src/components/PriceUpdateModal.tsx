import React, { useState } from 'react';
import {
  X,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Tag,
  Info,
  Sparkles,
} from 'lucide-react';
import { Product, UserProfile, SubmissionStatus, ApprovalMethod, RiskLevel } from '../types';
import { database as db, formatPriceDisplay, parsePriceToNumber } from '../lib/firebase';
import { fetchBackgroundPriceHistory } from '../lib/priceIntelligence';
import { RefreshCw } from 'lucide-react';

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  currentUser: UserProfile | null;
  onSuccess?: () => void;
}

export const PriceUpdateModal: React.FC<PriceUpdateModalProps> = ({
  isOpen,
  onClose,
  product,
  currentUser,
  onSuccess,
}) => {
  const [newPrice, setNewPrice] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAutoFetching, setIsAutoFetching] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'pending' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  const handleAutoFetchPrice = async () => {
    if (!product) return;
    setIsAutoFetching(true);
    try {
      const intel = await fetchBackgroundPriceHistory(product);
      if (intel && intel.currentPrice > 0) {
        setNewPrice(String(intel.currentPrice));
        if (intel.summaryNote && !note) {
          setNote(intel.summaryNote);
        }
      }
    } catch (err) {
      console.warn('Auto-fetch price error:', err);
    } finally {
      setIsAutoFetching(false);
    }
  };

  if (!isOpen || !product) return null;

  const currentPriceNum = product.currentPrice ?? parsePriceToNumber(product.price);
  const enteredPriceNum = parsePriceToNumber(newPrice);
  const priceDiff = enteredPriceNum > 0 && currentPriceNum > 0 ? enteredPriceNum - currentPriceNum : 0;
  const percentChange =
    currentPriceNum > 0 && enteredPriceNum > 0
      ? Math.abs(enteredPriceNum - currentPriceNum) / currentPriceNum * 100
      : 0;

  const isTrustedUser = Boolean(
    currentUser?.isTrustedContributor ||
    currentUser?.role === 'admin' ||
    ((currentUser?.approvedSubmissionCount || 0) >= 5 && (currentUser?.rejectedSubmissionCount || 0) === 0)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // 1. Validation check
    if (!enteredPriceNum || enteredPriceNum <= 0 || isNaN(enteredPriceNum)) {
      setFeedback({
        type: 'error',
        message: 'This price update could not be accepted.',
        details: 'Price must be a valid number greater than ₹0.',
      });
      return;
    }

    // Determine acting user
    const actingUser: UserProfile = currentUser || {
      id: 'guest_' + (guestEmail ? guestEmail.replace(/[^a-zA-Z0-9]/g, '_') : Date.now()),
      name: guestName.trim() || 'Community Member',
      email: guestEmail.trim() || 'community@pickasap.com',
      role: 'user',
      isTrustedContributor: false,
      approvedSubmissionCount: 0,
      rejectedSubmissionCount: 0,
      trustScore: 50,
    };

    setIsSubmitting(true);
    try {
      const result = await db.submitPriceUpdate({
        productId: product.id,
        submittedPrice: enteredPriceNum,
        note: note.trim() || undefined,
        source: source.trim() || product.store,
        user: actingUser,
      });

      if (result.status === 'approved') {
        setFeedback({
          type: 'success',
          message: result.message,
          details: `The price was updated to ${formatPriceDisplay(enteredPriceNum)}. The price history chart has been refreshed.`,
        });
      } else {
        setFeedback({
          type: 'pending',
          message: result.message,
          details:
            result.riskLevel === 'high'
              ? 'This submission shows an unusual price difference (>50%) and has been prioritized for editorial safety audit.'
              : 'Updates differing by more than 20% from the verified price are routed for rapid administrator approval.',
        });
      }

      if (onSuccess) {
        onSuccess();
      }

      // Reset form after 3 seconds if successfully approved, or allow user to dismiss
      setTimeout(() => {
        if (result.status === 'approved') {
          onClose();
          setFeedback(null);
          setNewPrice('');
          setNote('');
        }
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'This price update could not be accepted.';
      setFeedback({
        type: 'error',
        message: 'This price update could not be accepted.',
        details: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="price-update-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="price-update-modal-card"
        className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6E40] uppercase tracking-wider">
              <TrendingDown className="w-4 h-4" />
              <span>Community Price Intelligence</span>
            </div>
            <h2 className="font-heading-editorial text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mt-1">
              Submit Updated Price
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
              {product.title}
            </p>
          </div>
          <button
            id="price-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Verified Price Banner */}
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block">
              Current Approved Price on {product.store}
            </span>
            <span className="font-mono text-2xl font-bold text-neutral-900 dark:text-white">
              {formatPriceDisplay(currentPriceNum)}
            </span>
          </div>
          {isTrustedUser && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Trusted Contributor
            </span>
          )}
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            id="price-submission-feedback"
            className={`p-4 rounded-2xl text-xs space-y-1 animate-fade-in border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : feedback.type === 'pending'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {feedback.type === 'pending' && <Clock className="w-4 h-4 text-amber-600" />}
              {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{feedback.message}</span>
            </div>
            {feedback.details && <p className="leading-relaxed pl-6">{feedback.details}</p>}
          </div>
        )}

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Price Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                New Observed Price (₹ Rupee) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoFetchPrice}
                disabled={isAutoFetching}
                className="text-[11px] font-semibold text-[#FF6E40] hover:text-[#e05b30] flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isAutoFetching ? 'animate-spin' : ''}`} />
                <span>{isAutoFetching ? 'Fetching price...' : 'Auto-fetch from link'}</span>
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-bold font-mono text-base">
                ₹
              </span>
              <input
                id="input-new-price"
                type="number"
                step="any"
                min="1"
                required
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={`e.g. ${currentPriceNum ? Math.round(currentPriceNum * 0.95) : '4999'}`}
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181a22] text-neutral-900 dark:text-white font-mono text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
              />
            </div>

            {/* Real-time Difference Preview */}
            {enteredPriceNum > 0 && currentPriceNum > 0 && (
              <div className="mt-2 text-xs flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1 font-semibold">
                  {priceDiff < 0 ? (
                    <>
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatPriceDisplay(Math.abs(priceDiff))} drop ({percentChange.toFixed(1)}% drop)
                      </span>
                    </>
                  ) : priceDiff > 0 ? (
                    <>
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">
                        +{formatPriceDisplay(priceDiff)} increase (+{percentChange.toFixed(1)}%)
                      </span>
                    </>
                  ) : (
                    <span>Price is identical to current listing</span>
                  )}
                </span>
                <span className="text-[11px]">
                  {percentChange <= 20 ? (
                    <span className="text-emerald-600 font-semibold">✓ Normal change (Auto-approvable)</span>
                  ) : percentChange <= 50 ? (
                    <span className="text-amber-600 font-semibold">⚠ &gt;20% change (Admin review required)</span>
                  ) : (
                    <span className="text-rose-600 font-semibold">⚠ &gt;50% unusual drop (High-risk review)</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Source / Store Reference */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Price Source or Store Reference (Optional)
            </label>
            <input
              id="input-price-source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={`e.g. ${product.store} Deal of the Day, Cart Instant Discount`}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181a22] text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
            />
          </div>

          {/* Note or Proof */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Deal Note or Verification Context (Optional)
            </label>
            <textarea
              id="input-price-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Includes ₹500 bank discount coupon applied at cart checkout"
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181a22] text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6E40] resize-none"
            />
          </div>

          {/* Guest Identity Fields if Not Logged In */}
          {!currentUser && (
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 block">
                Contributor Identification (Optional, helps build reputation)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181a22] text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181a22] text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                />
              </div>
            </div>
          )}

          {/* Approval Rules Disclosure */}
          <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
              <Info className="w-3.5 h-3.5 text-amber-500" />
              <span>Hybrid Approval Policy:</span>
            </div>
            <p>
              • Updates within <strong>20%</strong> of the previous approved price are validated and published automatically.
            </p>
            <p>
              • <strong>Trusted Contributors</strong> enjoy instant clearance and priority standing.
            </p>
            <p>
              • Larger price shifts (&gt;20%) or anomalous reports (&gt;50%) enter rapid admin review to prevent misinformation.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              id="price-modal-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="price-modal-submit-btn"
              disabled={isSubmitting || !newPrice}
              className="px-5 py-2.5 rounded-xl bg-[#FF6E40] hover:bg-[#e05b30] active:scale-98 text-white text-xs font-bold shadow-md shadow-[#FF6E40]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating Update...</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4" />
                  <span>Submit Price Update</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
