import React, { useEffect } from 'react';
import { LegalNavHeader } from './LegalNavHeader';
import { AppView } from '../../types';
import { RotateCcw, Clock, AlertCircle, CheckCircle2, CreditCard, ShoppingCart } from 'lucide-react';

interface CancellationRefundPageProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const CancellationRefundPage: React.FC<CancellationRefundPageProps> = ({
  currentView,
  setCurrentView,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Cancellation and Refund Policy | PickASAP';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0d] text-neutral-800 dark:text-neutral-200">
      <LegalNavHeader
        currentView={currentView}
        setCurrentView={setCurrentView}
        title="Cancellation and Refund Policy"
        subtitle="Transparent terms regarding subscription cancellation, refund eligibility, processing windows, and merchant affiliate return handling."
        lastUpdated="September 2026"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 leading-relaxed text-sm">
        {/* Core Policy Summary */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
            <RotateCcw className="w-4 h-4 text-[#FF6E40]" />
            <span>Policy Summary at a Glance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-white dark:bg-[#1c1f2b] border border-neutral-200/70 dark:border-neutral-800/70 space-y-1">
              <span className="font-semibold text-neutral-900 dark:text-white block">
                Platform Fees (Digital Access)
              </span>
              <p className="text-neutral-500 dark:text-neutral-400">
                Cancel any time before the next billing cycle. Duplicate or erroneous charges are refunded in full within 5–7 working days to the original payment source.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-[#1c1f2b] border border-neutral-200/70 dark:border-neutral-800/70 space-y-1">
              <span className="font-semibold text-neutral-900 dark:text-white block">
                Retail Products (Flipkart, Amazon, Myntra)
              </span>
              <p className="text-neutral-500 dark:text-neutral-400">
                Returns and refunds for physical goods are processed directly through the respective retailer where the order was placed according to their return policy.
              </p>
            </div>
          </div>
        </section>

        {/* Section 1: Creator Platform Fee Cancellations */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <span>1. Creator Platform Fee Subscriptions &amp; Cancellations</span>
          </h2>
          <p>
            PickASAP charges tiered monthly platform fees (e.g., Growth Tier ₹499/mo, Pro Tier ₹999/mo, Elite Tier ₹1,999/mo) to affiliate creators whose published links generate over 10,000 monthly clicks.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-white">Cancellation of Renewal:</strong> Creators may choose not to renew their platform fee for the subsequent calendar month at any time. Once an active month concludes, your link upload privileges will revert to the standard threshold unless renewed.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Immediate Effect:</strong> There are no long-term lock-in contracts or cancellation penalties.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Active Period Access:</strong> If you cancel renewal, your link upload privileges remain valid through the final day of the already-paid month.
            </li>
          </ul>
        </section>

        {/* Section 2: Refund Policy for Platform Fees */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            2. Refund Eligibility &amp; Processing Windows
          </h2>
          <p>
            Because monthly platform fees unlock instant digital upload and indexing rights, fees are generally non-refundable once digital services have been provisioned. However, refunds will be approved under the following conditions:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/60 dark:border-neutral-800/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-semibold text-neutral-900 dark:text-white block">
                  Duplicate / Multiple Charges
                </strong>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  If an accidental double payment occurs due to a gateway timeout or network drop, the duplicate amount will be refunded 100% automatically or upon request.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/60 dark:border-neutral-800/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-semibold text-neutral-900 dark:text-white block">
                  System Outage or Failure to Activate Privileges
                </strong>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  If your payment is debited by Razorpay but our system fails to unlock your upload access within 24 hours, you are entitled to a full refund upon verification.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <h3 className="font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider mb-2">
              Refund Timeline &amp; Method
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-600 dark:text-neutral-400 text-xs">
              <li>
                Approved refunds are processed via Razorpay within <strong>24 to 48 hours</strong> of verification.
              </li>
              <li>
                The refunded funds reflect in the user&rsquo;s original payment method (Bank Account, Credit/Debit Card, or UPI ID) within <strong>5 to 7 business days</strong>, subject to your issuing bank&rsquo;s clearing cycle.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: Physical Merchandise Purchases */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#FF6E40]" />
            <span>3. Physical Products Purchased on Retailer Websites</span>
          </h2>
          <p>
            When purchasing physical products (electronics, apparel, lifestyle goods) featured on PickASAP via outbound links:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              You complete payment directly on the retailer&rsquo;s platform (e.g. Amazon.in, Flipkart.com, Myntra.com).
            </li>
            <li>
              Cancellations, returns, damaged product claims, or courier delays must be raised directly through that merchant&rsquo;s order management dashboard:
              <ul className="list-circle pl-5 mt-1.5 space-y-1 text-xs">
                <li><strong>Amazon:</strong> Go to &ldquo;Your Orders&rdquo; &rarr; Select Item &rarr; &ldquo;Return or Replace Items&rdquo;.</li>
                <li><strong>Flipkart:</strong> Go to &ldquo;My Orders&rdquo; &rarr; Select Order &rarr; &ldquo;Return&rdquo;.</li>
                <li><strong>Myntra:</strong> Go to &ldquo;Orders&rdquo; &rarr; Select Item &rarr; &ldquo;Return/Exchange&rdquo;.</li>
              </ul>
            </li>
            <li>
              PickASAP does not process merchant refunds, hold custody of funds for physical goods, or intervene in retail dispute resolution.
            </li>
          </ul>
        </section>

        {/* Section 4: How to Request a Refund */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
          <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
            How to Submit a Platform Fee Refund Request
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            To request assistance or report a billing discrepancy for a PickASAP platform fee:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            <li>Email our support desk at <strong className="text-neutral-900 dark:text-white">support@pickasap.com</strong> or use our <button onClick={() => setCurrentView('contact')} className="text-[#FF6E40] hover:underline font-semibold cursor-pointer">Contact Us form</button>.</li>
            <li>Include your <strong>Razorpay Payment ID</strong> (e.g., <code className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px]">pay_...</code>) from your payment confirmation.</li>
            <li>Our billing support team will review and respond within 24 hours.</li>
          </ol>
        </section>
      </main>
    </div>
  );
};
