import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Shield,
  UserCheck,
  UserX,
  Award,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Info,
} from 'lucide-react';
import { UserProfile } from '../types';
import { database as db } from '../lib/firebase';

interface TrustedUsersManagerProps {
  currentUser: UserProfile;
}

export const TrustedUsersManager: React.FC<TrustedUsersManagerProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserProfile[]>(() => db.getAllUsers());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'trusted' | 'eligible' | 'standard'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = db.subscribeToUsers((liveUsers) => {
      setUsers(liveUsers);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleToggleTrusted = async (user: UserProfile) => {
    setUpdatingId(user.id);
    try {
      await db.setUserTrustedStatus(user.id, !user.isTrustedContributor, currentUser);
    } catch (e) {
      console.error('Failed to toggle trusted status:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const approved = u.approvedSubmissionCount || 0;
    const rejected = u.rejectedSubmissionCount || 0;
    const isAutoEligible = approved >= 5 && rejected === 0;

    if (filter === 'trusted' && !u.isTrustedContributor) return false;
    if (filter === 'eligible' && (!isAutoEligible || u.isTrustedContributor)) return false;
    if (filter === 'standard' && u.isTrustedContributor) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Policy Explanation Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-[#FF6E40]/10 to-amber-500/10 border border-emerald-500/20 dark:border-emerald-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Trust Hierarchy & Contributor Safeguards</span>
            </div>
            <h3 className="text-lg font-bold font-serif-editorial text-neutral-900 dark:text-white">
              Trusted Contributor Acceleration Rules
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 max-w-2xl leading-relaxed">
              Trusted contributors help keep product pricing up-to-date across Amazon, Flipkart, and Myntra.
              Their reasonable updates (&le;20%) are approved automatically. Automatic qualification triggers at{' '}
              <strong>5 approved submissions with 0 rejections</strong>, or via direct editorial promotion below.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 rounded-2xl bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 text-center min-w-[100px]">
              <span className="text-xs font-semibold text-neutral-400 block">Trusted</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {users.filter((u) => u.isTrustedContributor).length}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 text-center min-w-[100px]">
              <span className="text-xs font-semibold text-neutral-400 block">Total Users</span>
              <span className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                {users.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contributors by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141a] text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            All Contributors
          </button>
          <button
            onClick={() => setFilter('trusted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              filter === 'trusted'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Trusted Only
          </button>
          <button
            onClick={() => setFilter('eligible')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              filter === 'eligible'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Auto-Eligible (5+ Approvals)
          </button>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredUsers.map((u) => {
          const approved = u.approvedSubmissionCount || 0;
          const rejected = u.rejectedSubmissionCount || 0;
          const total = approved + rejected;
          const isEligible = approved >= 5 && rejected === 0;
          const isUpdating = updatingId === u.id;

          return (
            <div
              key={u.id}
              id={`contributor-card-${u.id}`}
              className={`p-5 rounded-3xl bg-white dark:bg-[#12141a] border transition-all ${
                u.isTrustedContributor
                  ? 'border-emerald-300/80 dark:border-emerald-900/60 shadow-xs'
                  : isEligible
                  ? 'border-amber-300 dark:border-amber-900/60'
                  : 'border-neutral-200/80 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt={u.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-base text-neutral-700 dark:text-neutral-200">
                      {(u.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                        {u.name || 'Community Member'}
                      </h4>
                      {u.role === 'admin' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 truncate max-w-[200px]">
                      {u.email || 'No email provided'}
                    </p>
                  </div>
                </div>

                {/* Trust Status Badge */}
                {u.isTrustedContributor ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Trusted
                  </span>
                ) : isEligible ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Auto-Eligible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 shrink-0">
                    <Shield className="w-3 h-3 text-neutral-400" />
                    Standard
                  </span>
                )}
              </div>

              {/* Stats & Trust Meter */}
              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60">
                    <span className="text-[10px] text-neutral-400 block">Approved</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {approved}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60">
                    <span className="text-[10px] text-neutral-400 block">Rejected</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm">
                      {rejected}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60">
                    <span className="text-[10px] text-neutral-400 block">Trust Score</span>
                    <strong className="text-[#FF6E40] font-mono text-sm">
                      {u.trustScore ?? 50}%
                    </strong>
                  </div>
                </div>

                {/* Trust Score Bar */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (u.trustScore ?? 50) >= 80
                          ? 'bg-emerald-500'
                          : (u.trustScore ?? 50) >= 60
                          ? 'bg-amber-500'
                          : 'bg-neutral-400'
                      }`}
                      style={{ width: `${Math.max(5, u.trustScore ?? 50)}%` }}
                    />
                  </div>
                </div>

                {/* Management Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-400">
                    {u.trustedSince ? (
                      <span>Trusted since {new Date(u.trustedSince).toLocaleDateString()}</span>
                    ) : isEligible ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Ready for trusted approval
                      </span>
                    ) : (
                      <span>Requires {Math.max(0, 5 - approved)} more approved updates</span>
                    )}
                  </span>

                  <button
                    onClick={() => handleToggleTrusted(u)}
                    disabled={isUpdating}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      u.isTrustedContributor
                        ? 'border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    {u.isTrustedContributor ? (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Revoke Trust</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Grant Trusted Status</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
