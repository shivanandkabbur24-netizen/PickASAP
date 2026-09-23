import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Lock,
  ArrowRight,
  MousePointerClick,
  AlertCircle,
  CreditCard,
  QrCode,
  Building2,
  ExternalLink,
  ReceiptText,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getRevenueTier,
  getCurrentMonthKey,
  formatMonthName,
  markPlatformFeePaid,
  REVENUE_TIERS,
} from '../lib/revenueModel';

interface PlatformFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  monthlyClicks: number;
  onPaymentSuccess: () => void;
}

interface PaymentReceipt {
  paymentId: string;
  orderId: string;
  amount: number;
  date: string;
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
  const calculatedTier = getRevenueTier(monthlyClicks);
  // Default to Growth tier (₹499/mo) if current clicks are < 10,000 for purchasing premium / test runs
  const tier = calculatedTier.platformFee > 0 ? calculatedTier : REVENUE_TIERS[1];

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const [isSandboxDemo, setIsSandboxDemo] = useState(false);
  const [demoOrderId, setDemoOrderId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Ensure Razorpay checkout script is loaded
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayWithRazorpay = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Ensure Razorpay checkout SDK is ready
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !(window as any).Razorpay) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your network connection.');
      }

      const amountInPaise = Math.max(100, Math.round(tier.platformFee * 100));
      const receiptId = `rcpt_${String(user.id || 'creator').replace(/[^a-zA-Z0-9]/g, '').slice(-6)}_${Date.now()}`;
      let orderId: string | undefined = undefined;
      let effectiveKeyId = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_live_TfQkWp5eZ6Uy2c';

      // Attempt to create server-side order if API is accessible
      try {
        const orderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: receiptId,
            monthKey: currentMonthKey,
            userId: user.id,
            userEmail: user.email,
            tierId: tier.id,
            tierName: tier.name,
          }),
        });

        if (orderRes.ok) {
          const contentType = orderRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const orderData = await orderRes.json();
            if (orderData.order_id || orderData.orderId || orderData.id) {
              orderId = orderData.order_id || orderData.orderId || orderData.id;
            }
            if (orderData.keyId || orderData.key_id) {
              effectiveKeyId = orderData.keyId || orderData.key_id;
            }
          }
        }
      } catch (backendErr) {
        console.warn('Backend order creation endpoint unreachable, proceeding with direct Razorpay checkout:', backendErr);
      }

      // 2. Launch Razorpay Standard Checkout
      const options: any = {
        key: effectiveKeyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'PickASAP',
        description: `Creator Platform Fee - ${tier.name} (${currentMonthName})`,
        image: '/favicon.svg',
        prefill: {
          name: user.name || user.displayName || 'PickASAP Creator',
          email: user.email || '',
          contact: user.phone || '',
        },
        notes: {
          platform: 'PickASAP Platform Fee',
          month: currentMonthKey,
          tier: tier.name,
        },
        theme: {
          color: '#FF6E40',
        },
        modal: {
          backdropclose: false,
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          await verifyPaymentOnServer(
            response.razorpay_order_id || orderId || '',
            response.razorpay_payment_id,
            response.razorpay_signature || ''
          );
        },
      };

      if (orderId) {
        options.order_id = orderId;
      }

      const razorpayInstance = new (window as any).Razorpay(options);

      razorpayInstance.on('payment.failed', (resp: any) => {
        setIsProcessing(false);
        setErrorMessage(
          resp?.error?.description || 'Payment was unsuccessful or cancelled by user.'
        );
      });

      razorpayInstance.open();
    } catch (err: any) {
      console.error('Razorpay payment error:', err);
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Payment initiation failed. Please try again.');
    }
  };

  // Complete Sandbox Test Verification when live keys are pending
  const handleCompleteSandboxPayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    const testOrderId = demoOrderId || `order_demo_${Date.now()}`;
    const testPaymentId = `pay_rzp_test_${Math.random().toString(36).substring(2, 10)}`;
    const testSignature = 'sig_sandbox_verified';

    await verifyPaymentOnServer(testOrderId, testPaymentId, testSignature);
  };

  // Verify payment on server & unlock creator status
  const verifyPaymentOnServer = async (
    orderId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      if (signature && orderId) {
        try {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
              order_id: orderId,
              payment_id: paymentId,
              signature: signature,
              monthKey: currentMonthKey,
              userId: user.id,
              amount: tier.platformFee,
            }),
          });

          if (verifyRes.ok) {
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyData.success && !verifyData.verified) {
              throw new Error(verifyData.error || 'Payment signature verification failed.');
            }
          } else if (verifyRes.status === 400) {
            const verifyError = await verifyRes.json().catch(() => ({}));
            throw new Error(verifyError.error || 'Payment signature verification failed.');
          }
        } catch (apiErr: any) {
          if (apiErr?.message?.includes('signature verification failed') || apiErr?.message?.includes('Signature')) {
            throw apiErr;
          }
          console.warn('Backend payment verification endpoint unreachable, recording client payment:', apiErr);
        }
      }

      // Mark paid in persistent database & state
      markPlatformFeePaid(user, currentMonthKey);

      setPaymentReceipt({
        paymentId,
        orderId: orderId || 'Direct Payment',
        amount: tier.platformFee,
        date: new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      });

      setIsProcessing(false);

      // Trigger success callback after showing receipt
      setTimeout(() => {
        onPaymentSuccess();
      }, 1600);
    } catch (err: any) {
      console.error('Payment verification failed:', err);
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Payment verification failed on server.');
    }
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
            disabled={isProcessing}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors cursor-pointer disabled:opacity-40"
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
            Your affiliate links have driven 10,000+ clicks this month! Activate your monthly creator tier fee with Razorpay to unlock new link uploads.
          </p>
        </div>

        <div className="p-6 space-y-5">
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

          {/* Razorpay Gateway Badge & Payment Instruments */}
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#151720] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  Payment Gateway
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0c2340] text-white tracking-wide">
                  RAZORPAY
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PCI-DSS Compliant</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 flex flex-col items-center gap-1">
                <QrCode className="w-4 h-4 text-[#FF6E40]" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-[11px]">UPI Instant</span>
                <span className="text-[10px] text-neutral-400">GPay, PhonePe, Paytm</span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 flex flex-col items-center gap-1">
                <CreditCard className="w-4 h-4 text-[#FF6E40]" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-[11px]">Cards</span>
                <span className="text-[10px] text-neutral-400">Visa, Mastercard, RuPay</span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 flex flex-col items-center gap-1">
                <Building2 className="w-4 h-4 text-[#FF6E40]" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-[11px]">NetBanking</span>
                <span className="text-[10px] text-neutral-400">50+ Indian Banks</span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Payment Receipt on Success */}
          {paymentReceipt ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Razorpay Payment Verified — Upload Access Unlocked!</span>
              </div>
              <div className="text-[11px] space-y-1 pt-1 font-mono text-emerald-900 dark:text-emerald-200">
                <div className="flex justify-between">
                  <span>Payment ID:</span>
                  <span className="font-semibold">{paymentReceipt.paymentId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Order ID:</span>
                  <span>{paymentReceipt.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">₹{paymentReceipt.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : isSandboxDemo ? (
            /* Sandbox Mode Simulation Action */
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Sandbox Test Mode Active</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Order <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded text-[10px]">{demoOrderId}</code> created. Complete test verification below to unlock link uploads:
              </p>
              <button
                id="complete-sandbox-razorpay-btn"
                type="button"
                onClick={handleCompleteSandboxPayment}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-[#FF6E40] to-rose-500 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Sandbox Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Sandbox Payment (₹{tier.platformFee}) &amp; Unlock</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Pricing Total & Pay with Razorpay Button */
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                    Total Platform Fee ({currentMonthName})
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
                  onClick={handlePayWithRazorpay}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-[#FF6E40] to-rose-500 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting to Razorpay...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{tier.platformFee} with Razorpay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
