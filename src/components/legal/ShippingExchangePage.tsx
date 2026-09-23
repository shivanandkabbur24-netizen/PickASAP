import React, { useEffect } from 'react';
import { LegalNavHeader } from './LegalNavHeader';
import { AppView } from '../../types';
import { Truck, RefreshCw, Zap, PackageCheck, AlertCircle, ShoppingBag } from 'lucide-react';

interface ShippingExchangePageProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const ShippingExchangePage: React.FC<ShippingExchangePageProps> = ({
  currentView,
  setCurrentView,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Shipping and Exchange Policy | PickASAP';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0d] text-neutral-800 dark:text-neutral-200">
      <LegalNavHeader
        currentView={currentView}
        setCurrentView={setCurrentView}
        title="Shipping and Exchange Policy"
        subtitle="Information on instant digital service fulfillment for PickASAP creators, and shipping and exchange guidelines for products purchased through affiliate partners."
        lastUpdated="September 2026"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 leading-relaxed text-sm">
        {/* Core Summary */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
            <Truck className="w-4 h-4 text-[#FF6E40]" />
            <span>Fulfillment Overview</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            PickASAP delivers digital creator services instantly online upon payment verification. Physical merchandise discovered on our curated magazine is shipped, delivered, and exchanged directly by verified partner merchants (such as Amazon, Flipkart, Myntra).
          </p>
        </section>

        {/* Section 1: Digital Services Shipping & Fulfillment */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>1. PickASAP Direct Services — Instant Digital Delivery</span>
          </h2>
          <p>
            When an affiliate creator pays a monthly platform tier fee (e.g. Growth, Pro, or Elite) on PickASAP via Razorpay:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-white">Delivery Mode:</strong> 100% digital access. No physical goods or packages are shipped.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Delivery Timeline:</strong> Access privileges to upload and feature affiliate links are activated <strong>immediately upon successful transaction confirmation</strong> (typically within 0 to 5 minutes).
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Proof of Delivery:</strong> You will receive an immediate on-screen payment receipt displaying your Razorpay Payment ID, along with an automated transaction confirmation to your registered email address.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Shipping Charges:</strong> Zero (₹0). There are no shipping, handling, or logistics fees for digital platform services.
            </li>
          </ul>
        </section>

        {/* Section 2: Physical Products Purchased from Affiliate Partners */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#FF6E40]" />
            <span>2. Physical Merchandise — Retailer Shipping Timelines</span>
          </h2>
          <p>
            For consumer products discovered on PickASAP and purchased from third-party retailers:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-white">Shipping Carriers:</strong> Orders are dispatched via the retailer&rsquo;s logistics network (e.g., Amazon Transportation, Ekart Logistics, BlueDart, Delhivery, Shadowfax).
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Estimated Delivery Time:</strong> Standard delivery usually takes <strong>2 to 7 business days</strong> across most pin codes in India. Express/Same-Day delivery options (e.g., Amazon Prime, Flipkart Minutes) are available depending on your location and merchant tier.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Order Tracking:</strong> Tracking numbers (AWB) and live status updates are provided directly by the merchant via SMS, email, and their official app/website.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Shipping Fees:</strong> Shipping costs, if applicable, are determined by the respective retailer at checkout (often free above minimum order values).
            </li>
          </ul>
        </section>

        {/* Section 3: Exchange Policy for Physical Goods */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-500" />
            <span>3. Product Exchange Policy &amp; Guidelines</span>
          </h2>
          <p>
            If you receive a product from a retail partner that is damaged, defective, or the incorrect size/color:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/60 dark:border-neutral-800/60 text-xs space-y-2">
              <span className="font-semibold text-neutral-900 dark:text-white block">
                Standard Merchant Exchange Windows:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-neutral-600 dark:text-neutral-400">
                <li><strong>Fashion &amp; Apparel (Myntra / Flipkart):</strong> Usually eligible for size/color exchange within 7 to 14 days of delivery.</li>
                <li><strong>Electronics &amp; Gadgets (Amazon / Flipkart):</strong> Replacement or technician visit provided within 7 days for transit damage or manufacturing defects.</li>
                <li><strong>Home &amp; Lifestyle:</strong> 7-day replacement window for defective or mismatched items.</li>
              </ul>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              To initiate an exchange, log into the retailer account where you placed the order, locate the specific item under your recent orders, and select &ldquo;Exchange / Replace&rdquo;. PickASAP does not warehouse stock and cannot process physical package exchanges.
            </p>
          </div>
        </section>

        {/* Section 4: Assistance */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
          <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
            Need Help with a Digital Delivery or Receipt?
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            If you have questions about your PickASAP creator platform subscription delivery or invoice receipt, please reach out through our{' '}
            <button
              onClick={() => setCurrentView('contact')}
              className="text-[#FF6E40] hover:underline font-semibold cursor-pointer"
            >
              Contact Us page
            </button>{' '}
            or email us at{' '}
            <strong className="text-neutral-900 dark:text-white">support@pickasap.com</strong>.
          </p>
        </section>
      </main>
    </div>
  );
};
