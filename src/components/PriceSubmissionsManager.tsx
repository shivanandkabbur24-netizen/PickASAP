import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  UserX,
  MessageSquare,
  Search,
  Filter,
  TrendingDown,
  TrendingUp,
  Tag,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { PriceSubmission, UserProfile, SubmissionStatus, RiskLevel } from '../types';
import { database as db, formatPriceDisplay } from '../lib/firebase';

interface PriceSubmissionsManagerProps {
  currentUser: UserProfile;
  onProductClick?: (productId: string) => void;
}

export const PriceSubmissionsManager: React.FC<PriceSubmissionsManagerProps> = ({
  currentUser,
  onProductClick,
}) => {
  const [submissions, setSubmissions] = useState<PriceSubmission[]>(() => db.getSubmissions());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'high_risk' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [activeRejectModalId, setActiveRejectModalId] = useState<string | null>(null);

  // Real-time subscription to submissions
  useEffect(() => {
    const unsub = db.subscribeToSubmissions((items) => {
      setSubmissions(items);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const highRiskCount = submissions.filter((s) => s.status === 'pending' && s.riskLevel === 'high').length;

  const filteredSubmissions = submissions.filter((sub) => {
    if (statusFilter === 'pending') {
      if (sub.status !== 'pending') return false;
    } else if (statusFilter === 'high_risk') {
      if (sub.status !== 'pending' || sub.riskLevel !== 'high') return false;
    } else if (statusFilter === 'approved') {
      if (sub.status !== 'approved') return false;
    } else if (statusFilter === 'rejected') {
      if (sub.status !== 'rejected') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (sub.productTitle || '').toLowerCase().includes(q);
      const matchSubmitter = (sub.submittedByName || '').toLowerCase().includes(q);
      const matchStore = (sub.productStore || '').toLowerCase().includes(q);
      return matchTitle || matchSubmitter || matchStore;
    }

    return true;
  });

  const handleApprove = async (sub: PriceSubmission) => {
    setActionLoading((prev) => ({ ...prev, [sub.id]: true }));
    try {
      const note = adminNotes[sub.id];
      await db.approveSubmissionByAdmin(sub.id, currentUser, note);
    } catch (e) {
      console.error('Approval failed:', e);
    } finally {
      setActionLoading((prev) => ({ ...prev, [sub.id]: false }));
    }
  };

  const handleReject = async (sub: PriceSubmission) => {
    setActionLoading((prev) => ({ ...prev, [sub.id]: true }));
    try {
      const reason = rejectReasons[sub.id];
      await db.rejectSubmissionByAdmin(sub.id, currentUser, reason);
      setActiveRejectModalId(null);
    } catch (e) {
      console.error('Rejection failed:', e);
    } finally {
      setActionLoading((prev) => ({ ...prev, [sub.id]: false }));
    }
  };

  const handleToggleTrusted = async (userId: string, currentlyTrusted?: boolean) => {
    await db.setUserTrustedStatus(userId, !currentlyTrusted, currentUser);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#FF6E40] font-semibold">
              Hybrid Approval Protocol
            </span>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {pendingCount} Awaiting Review
              </span>
            )}
            {highRiskCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse">
                {highRiskCount} High Risk
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-editorial text-neutral-900 dark:text-white mt-1">
            Price Update Submissions
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Normal updates (within 20%) are approved automatically. Review flagged and unusual community submissions below.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('high_risk')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'high_risk'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-rose-600 dark:text-rose-400 hover:bg-neutral-200'
            }`}
          >
            High Risk ({highRiskCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#FF6E40] text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
          >
            All ({submissions.length})
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search submissions by product title, submitter name, or store..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141a] text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
        />
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-[#12141a] border border-neutral-200/80 dark:border-neutral-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800 dark:text-white">
            No Submissions Found in this Queue
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
            {statusFilter === 'pending'
              ? 'All normal price updates are auto-approved. There are no submissions currently requiring admin attention.'
              : 'Try changing the filter or search query.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => {
            const isLoading = actionLoading[sub.id];
            const isHighRisk = sub.riskLevel === 'high';
            const isMediumRisk = sub.riskLevel === 'medium';
            const diff = sub.submittedPrice - sub.previousApprovedPrice;
            const isDrop = diff < 0;

            return (
              <div
                key={sub.id}
                id={`submission-row-${sub.id}`}
                className={`p-5 rounded-3xl bg-white dark:bg-[#12141a] border transition-all ${
                  sub.status === 'pending' && isHighRisk
                    ? 'border-rose-300 dark:border-rose-900/80 ring-2 ring-rose-500/10 shadow-sm'
                    : sub.status === 'pending'
                    ? 'border-amber-300 dark:border-amber-900/80 shadow-xs'
                    : 'border-neutral-200/80 dark:border-neutral-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Product Info & Thumb */}
                  <div className="flex items-start gap-4 flex-1">
                    {sub.productImageUrl && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-900 overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-800">
                        <img
                          src={sub.productImageUrl}
                          alt={sub.productTitle}
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6E40]/10 text-[#FF6E40] border border-[#FF6E40]/20">
                          {sub.productStore}
                        </span>

                        {/* Status Badge */}
                        {sub.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Approved ({sub.approvalMethod || 'auto'})
                          </span>
                        ) : sub.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Pending Review
                          </span>
                        )}

                        {/* Risk Indicator */}
                        {isHighRisk ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            High Risk (&gt;50% change)
                          </span>
                        ) : isMediumRisk ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Medium Risk (&gt;20% change)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            Low Risk (&le;20% change)
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <h4
                        onClick={() => onProductClick && onProductClick(sub.productId)}
                        className="font-bold text-sm text-neutral-900 dark:text-white hover:text-[#FF6E40] transition-colors cursor-pointer line-clamp-2"
                      >
                        {sub.productTitle}
                      </h4>

                      {/* Price Shift Comparison Block */}
                      <div className="flex items-baseline gap-3 flex-wrap pt-1 font-mono text-xs">
                        <span className="text-neutral-500 dark:text-neutral-400">
                          Previous: <strong className="text-neutral-700 dark:text-neutral-200">{formatPriceDisplay(sub.previousApprovedPrice)}</strong>
                        </span>
                        <ArrowRight className="w-3 h-3 text-neutral-400" />
                        <span className="text-neutral-900 dark:text-white font-bold text-sm">
                          Submitted: <span className="text-[#FF6E40]">{formatPriceDisplay(sub.submittedPrice)}</span>
                        </span>
                        <span
                          className={`font-semibold flex items-center gap-0.5 ${
                            isDrop ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isDrop ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                          {Math.abs(sub.priceChangePercentage)}% {isDrop ? 'Drop' : 'Increase'}
                        </span>
                      </div>

                      {/* Context / Submitter Notes */}
                      {sub.note && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200">Note: </span>
                          {sub.note}
                        </p>
                      )}

                      {sub.rejectionReason && (
                        <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl border border-rose-200/60 dark:border-rose-900">
                          <span className="font-semibold">Rejection Reason: </span>
                          {sub.rejectionReason}
                        </p>
                      )}

                      {/* Submitter Details & Trust Control */}
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-neutral-400 pt-1">
                        <span>Submitted by <strong className="text-neutral-700 dark:text-neutral-300">{sub.submittedByName}</strong></span>
                        <span>•</span>
                        <span>{new Date(sub.submittedAt).toLocaleString()}</span>
                        {sub.source && (
                          <>
                            <span>•</span>
                            <span>Source: {sub.source}</span>
                          </>
                        )}
                        {/* Inline Trust Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleTrusted(sub.submittedBy, sub.submitterIsTrusted)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${
                            sub.submitterIsTrusted
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300'
                          }`}
                          title="Click to toggle user's trusted contributor status"
                        >
                          {sub.submitterIsTrusted ? (
                            <>
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span>Trusted Contributor</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3 text-neutral-500" />
                              <span>Make Trusted</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column (When Pending) */}
                  {sub.status === 'pending' && (
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 lg:w-48 pt-2 lg:pt-0">
                      <input
                        type="text"
                        placeholder="Admin note (optional)..."
                        value={adminNotes[sub.id] || ''}
                        onChange={(e) => setAdminNotes({ ...adminNotes, [sub.id]: e.target.value })}
                        className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF6E40]"
                      />
                      <button
                        onClick={() => handleApprove(sub)}
                        disabled={isLoading}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Price</span>
                      </button>
                      <button
                        onClick={() => setActiveRejectModalId(sub.id)}
                        disabled={isLoading}
                        className="w-full py-2 px-3 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {/* Rejection Modal/Popup */}
                  {activeRejectModalId === sub.id && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2.5 w-full">
                      <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
                        Provide Rejection Reason
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Price was for a refurbished unit, out of stock, etc."
                        value={rejectReasons[sub.id] || ''}
                        onChange={(e) => setRejectReasons({ ...rejectReasons, [sub.id]: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActiveRejectModalId(null)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReject(sub)}
                          className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
