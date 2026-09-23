import React, { useEffect } from 'react';
import { LegalNavHeader } from './LegalNavHeader';
import { AppView } from '../../types';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Scale, ExternalLink } from 'lucide-react';

interface TermsPageProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ currentView, setCurrentView }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Terms and Conditions | PickASAP';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0d] text-neutral-800 dark:text-neutral-200">
      <LegalNavHeader
        currentView={currentView}
        setCurrentView={setCurrentView}
        title="Terms and Conditions"
        subtitle="Please read these terms and conditions carefully before accessing or using PickASAP's digital curated shopping publication, affiliate discovery links, or creator platform services."
        lastUpdated="September 2026"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 leading-relaxed text-sm">
        {/* Quick Summary Card */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
            <Scale className="w-4 h-4 text-[#FF6E40]" />
            <span>Essential Overview</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            PickASAP operates as an independent digital editorial publication and affiliate discovery service. We do not sell or warehouse physical products directly. Physical transactions occur exclusively on partner retailer sites (Amazon, Flipkart, Myntra, etc.). Subscriptions for creator link upload privileges are governed by our creator platform fee policy.
          </p>
        </section>

        {/* Section 1: Agreement to Terms */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            1. Agreement to Terms
          </h2>
          <p>
            By accessing or browsing the PickASAP platform (accessible via our website, domains, and web applications), or by registering an account as an affiliate creator, contributor, or reader, you agree to be bound by these Terms and Conditions (&ldquo;Terms&rdquo;) and all applicable laws and regulations of India and the Information Technology Act, 2000. If you do not agree with any part of these Terms, you must immediately discontinue use of the platform.
          </p>
        </section>

        {/* Section 2: Nature of Services */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            2. Nature of PickASAP Services &amp; Affiliate Disclosure
          </h2>
          <p>
            PickASAP is a curated product discovery magazine. We discover, review, compare, and catalog items from reputable online marketplaces such as Amazon, Flipkart, Myntra, and others.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-white">Affiliate Relationships:</strong> PickASAP participates in verified affiliate marketing programs. Clicking an outbound product link redirects you to third-party merchant sites. We may earn an affiliate commission on qualifying purchases at zero added cost to you.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Merchant Contracts:</strong> Any purchase contract, warranty, shipment, customer service, or product return is strictly between you and the respective third-party retailer. PickASAP is not a seller, agent, broker, or guarantor of any physical merchandise.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Pricing Accuracy:</strong> Prices, discounts, and stock availability fluctuate dynamically on partner retail platforms. While our system continuously tracks and verifies pricing, the actual price at retailer checkout governs.
            </li>
          </ul>
        </section>

        {/* Section 3: Creator Platform & Fees */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            3. Creator Accounts &amp; Monthly Platform Fees
          </h2>
          <p>
            Affiliate creators who curate and publish shopping recommendation links on PickASAP are subject to traffic thresholds and platform tiers:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-white">Free Allowance:</strong> New and emerging creators can publish links with up to 10,000 monthly clicks free of platform charges.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Traffic-Based Platform Fees:</strong> Accounts generating clicks in higher tiers (e.g. 10,000–50,000 clicks/mo, 50,000–100,000 clicks/mo, or 100,000+ clicks/mo) require an active monthly platform fee to unlock continued link uploads and priority indexing for that calendar month.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Payment Processing:</strong> Platform fee transactions are processed securely through certified payment gateways, including Razorpay. Fees are billed in Indian Rupees (INR) and are non-refundable once digital upload privileges are activated for that month, except as required by applicable law or in the event of double billing.
            </li>
          </ul>
        </section>

        {/* Section 4: User Conduct & Content Standards */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            4. User Conduct, Submissions &amp; Price Verification
          </h2>
          <p>
            Users and creators agree not to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-neutral-600 dark:text-neutral-400">
            <li>Submit fraudulent, deceptive, expired, or artificially inflated price update reports.</li>
            <li>Use automated bots, web spiders, or click farms to generate artificial traffic or manipulate platform click records.</li>
            <li>Upload links to counterfeit, prohibited, harmful, or illegal goods under the laws of India.</li>
            <li>Interfere with, compromise, or disrupt the integrity or security of PickASAP servers and databases.</li>
          </ul>
          <p className="text-xs text-neutral-500">
            Violation of these rules may result in immediate suspension of account privileges, revocation of trusted contributor status, and forfeiture of platform access.
          </p>
        </section>

        {/* Section 5: Intellectual Property */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            5. Intellectual Property Rights
          </h2>
          <p>
            The PickASAP name, logo, branding, magazine layout, user interface designs, custom graphics, and software codebase are protected by copyright, trademark, and other intellectual property laws. Third-party brand names, store marks (Amazon, Flipkart, Myntra), and product photography are the property of their respective trademark holders and are utilized for descriptive, comparative editorial purposes.
          </p>
        </section>

        {/* Section 6: Limitation of Liability */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            6. Disclaimer of Warranties &amp; Limitation of Liability
          </h2>
          <p>
            PickASAP is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind, either express or implied. To the maximum extent permitted by law, PickASAP and its operators shall not be liable for any direct, indirect, incidental, punitive, or consequential damages resulting from product defects, merchant shipping delays, retailer pricing discrepancies, or third-party merchant site availability.
          </p>
        </section>

        {/* Section 7: Governing Law */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            7. Governing Law &amp; Dispute Resolution
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any legal dispute, claim, or controversy arising out of or relating to these Terms or platform operations shall be subject to the exclusive jurisdiction of the competent courts in Karnataka, India.
          </p>
        </section>

        {/* Section 8: Contact */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
          <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
            Questions Regarding Terms?
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            For questions or legal inquiries regarding these Terms and Conditions, please contact us at{' '}
            <button
              onClick={() => setCurrentView('contact')}
              className="text-[#FF6E40] hover:underline font-semibold cursor-pointer"
            >
              support@pickasap.com
            </button>
            {' '}or visit our{' '}
            <button
              onClick={() => setCurrentView('contact')}
              className="text-[#FF6E40] hover:underline font-semibold cursor-pointer"
            >
              Contact Us page
            </button>.
          </p>
        </section>
      </main>
    </div>
  );
};
