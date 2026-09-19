import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Sparkles,
  CreditCard,
  QrCode,
  Building2,
  Lock,
  ArrowRight,
  TrendingUp,
  MousePointerClick,
  Layers,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getRevenueTier,
  getCurrentMonthKey,
  formatMonthName,
  markPlatformFeePaid,
} from '../lib/revenueModel';

interface PlatformFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  monthlyClicks: number;
  onPaymentSuccess: () => void;
}

export const PlatformFeeModal: React.FC<PlatformFeeModalProps> = ({
  isOpen,
  onClose,
  user,
  monthlyClicks,
  onPaymentSuccess,
}) => {
  const currentMonthKey = getCurrentMonthKey();
  const currentMonthName = formatMonthName(currentMonthKey);
  const tier = getRevenueTier(monthlyClicks);

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('creator@okhdfcbank');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      markPlatformFeePaid(user, currentMonthKey);
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onPaymentSuccess();
      }, 1200);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 rounded-3xl w-full max-w-lg border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-500 via-[#FF6E40] to-rose-500 p-6 text-white relative">
          <button
            id="close-platform-fee-modal"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold tracking-wide uppercase">
              Creator Revenue Model
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium bg-black/20 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 text-amber-200" />
              {currentMonthName}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif-editorial font-bold leading-tight">
            Platform Fee Required to Upload
          </h2>
          <p className="text-xs text-white/90 mt-1 max-w-md leading-relaxed">
            Your affiliate links have driven exceptional traffic this month! To upload new links, please activate your monthly creator platform fee.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Traffic Milestone Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-[#FF6E40] flex items-center justify-center shrink-0">
                <MousePointerClick className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  {currentMonthName} Traffic
                </span>
                <span className="text-lg font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  {monthlyClicks.toLocaleString('en-IN')} Clicks
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FF6E40] text-white">
                {tier.name}
              </span>
              <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Fee: ₹{tier.platformFee}/mo
              </span>
            </div>
          </div>

          {/* Revenue Model Rule Explanation */}
          <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed bg-neutral-50 dark:bg-[#171922] p-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60">
            <h4 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-[#FF6E40]" />
              <span>PickASAP Creator Platform Fee Rules</span>
            </h4>
            <ul className="space-y-1.5 pt-1 text-[11px]">
              <li className="flex items-start gap-2">
                <span className="font-bold text-neutral-800 dark:text-neutral-200">• 10,000 to 50,000 clicks/mo:</span>
                <span>₹499 / month platform fee for uploading new links.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-neutral-800 dark:text-neutral-200">• 50,000+ to 1,00,000 clicks/mo:</span>
                <span>₹999 / month platform fee for uploading new links.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-neutral-800 dark:text-neutral-200">• 1,00,000+ clicks/mo:</span>
                <span>₹1,999 / month platform fee for uploading new links.</span>
              </li>
            </ul>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'border-[#FF6E40] bg-orange-50/50 dark:bg-orange-950/20 text-neutral-900 dark:text-white shadow-2xs'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <QrCode className={`w-4 h-4 ${paymentMethod === 'upi' ? 'text-[#FF6E40]' : ''}`} />
                <span className="text-xs font-semibold mt-2">Instant UPI</span>
                <span className="text-[10px] text-neutral-400">GPay / PhonePe</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'border-[#FF6E40] bg-orange-50/50 dark:bg-orange-950/20 text-neutral-900 dark:text-white shadow-2xs'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <CreditCard className={`w-4 h-4 ${paymentMethod === 'card' ? 'text-[#FF6E40]' : ''}`} />
                <span className="text-xs font-semibold mt-2">Card</span>
                <span className="text-[10px] text-neutral-400">Debit / Credit</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('netbanking')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === 'netbanking'
                    ? 'border-[#FF6E40] bg-orange-50/50 dark:bg-orange-950/20 text-neutral-900 dark:text-white shadow-2xs'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Building2 className={`w-4 h-4 ${paymentMethod === 'netbanking' ? 'text-[#FF6E40]' : ''}`} />
                <span className="text-xs font-semibold mt-2">NetBanking</span>
                <span className="text-[10px] text-neutral-400">All Indian Banks</span>
              </button>
            </div>

            {paymentMethod === 'upi' && (
              <div className="pt-2">
                <div className="relative">
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="Enter UPI ID (e.g. mobile@upi)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-[#FF6E40]"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Verified
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Pricing Total & Submit */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                  Total Monthly Platform Fee ({currentMonthName})
                </span>
                <span className="text-2xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  ₹{tier.platformFee.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-neutral-400 ml-1">/ month</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>256-Bit Encrypted</span>
              </div>
            </div>

            {isSuccess ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Payment of ₹{tier.platformFee} Successful! Unlocking upload form...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  id="submit-platform-fee-payment"
                  type="button"
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-[#FF6E40] to-rose-500 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{tier.platformFee} &amp; Unlock New Link Uploads</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
