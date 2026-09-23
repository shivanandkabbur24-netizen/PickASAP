import React, { useEffect } from 'react';
import { LegalNavHeader } from './LegalNavHeader';
import { AppView } from '../../types';
import { ShieldCheck, Lock, Eye, Database, FileText, UserCheck } from 'lucide-react';

interface PrivacyPolicyPageProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ currentView, setCurrentView }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Privacy Policy | PickASAP';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0d] text-neutral-800 dark:text-neutral-200">
      <LegalNavHeader
        currentView={currentView}
        setCurrentView={setCurrentView}
        title="Privacy Policy"
        subtitle="We value your privacy and are committed to safeguarding your personal information. This Privacy Policy details how PickASAP collects, uses, protects, and handles your data."
        lastUpdated="September 2026"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 leading-relaxed text-sm">
        {/* Highlight Card */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Privacy Highlights</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            PickASAP does not sell your personal data to data brokers or third parties. Payment information is securely handled via Razorpay&rsquo;s PCI-DSS Level 1 compliant gateway; we never store your card numbers or CVV.
          </p>
        </section>

        {/* Section 1: Information We Collect */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            1. Information We Collect
          </h2>
          <p>
            When you browse PickASAP or utilize our platform as a reader, contributor, or creator, we may collect the following categories of information:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-white">Account Information:</strong> When signing in via Google Authentication or email, we receive your name, email address, profile photo, and role identifier.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Creator &amp; Billing Data:</strong> For creators submitting affiliate links and paying platform tier fees, we record transaction identifiers, Razorpay Payment IDs, selected billing tiers, and monthly click aggregates.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Outbound Affiliate Click Data:</strong> When you click a product link to visit Amazon, Flipkart, or Myntra, our system logs anonymous click counts, timestamp, and product ID to display accurate trending metrics.
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-white">Technical &amp; Device Information:</strong> Standard browser user-agent, operating system, and anonymous IP records used for security monitoring and fraud prevention.
            </li>
          </ul>
        </section>

        {/* Section 2: How We Use Your Information */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            2. How We Use Your Information
          </h2>
          <p>We process your data strictly for legitimate operational purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-neutral-600 dark:text-neutral-400">
            <li>Operating, maintaining, and improving the PickASAP curated discovery platform.</li>
            <li>Enabling affiliate link submissions and verifying creator revenue tiers.</li>
            <li>Processing payments and issuing transaction receipts for platform fees via Razorpay.</li>
            <li>Displaying authentic price comparisons, historical charts, and community updates.</li>
            <li>Preventing click fraud, automated bots, and security vulnerabilities.</li>
            <li>Responding to customer support inquiries and legal notices.</li>
          </ul>
        </section>

        {/* Section 3: Payment Security & Gateways */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            3. Payment Processing &amp; Razorpay Security
          </h2>
          <p>
            All direct monetary transactions on PickASAP (such as monthly creator platform fees) are processed through certified third-party payment gateways, primarily <strong>Razorpay Software Private Limited</strong>.
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            Razorpay is certified under PCI-DSS Level 1 (the highest standard in payment security). During payment, your payment details (credit/debit cards, UPI VPA, NetBanking credentials) are transmitted directly to Razorpay over TLS 1.3 encryption. PickASAP servers <strong>never store or process your credit card numbers, debit card numbers, CVVs, or bank PINs</strong>.
          </p>
        </section>

        {/* Section 4: Cookies & Local Storage */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            4. Cookies, Local Storage &amp; Third-Party Retailers
          </h2>
          <p>
            PickASAP uses standard cookies and browser LocalStorage to remember your user preferences (such as Light/Dark theme mode), saved product bookmarks, and authentication tokens.
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            When you click external links directing to third-party marketplaces (e.g., Amazon, Flipkart, Myntra), those retailers may set cookies in your browser in accordance with their respective affiliate tracking and privacy policies. We encourage you to review their individual privacy declarations.
          </p>
        </section>

        {/* Section 5: Data Retention & User Rights */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
            5. Data Retention &amp; Your Rights
          </h2>
          <p>
            We retain account and payment records for as long as your account remains active or as required by Indian taxation, audit, and regulatory laws.
          </p>
          <p>Under applicable Indian data protection laws, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 text-neutral-600 dark:text-neutral-400">
            <li>Request access to the personal data we hold about you.</li>
            <li>Request correction or rectification of incomplete or inaccurate data.</li>
            <li>Request deletion of your account and associated profile records.</li>
            <li>Opt out of non-essential communications.</li>
          </ul>
        </section>

        {/* Section 6: Grievance Officer */}
        <section className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
            <UserCheck className="w-4 h-4 text-[#FF6E40]" />
            <span>Grievance Redressal Officer (IT Rules, 2021)</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            In compliance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, the details of our Grievance Redressal Officer are as follows:
          </p>
          <div className="text-xs space-y-1 text-neutral-700 dark:text-neutral-300">
            <p><strong>Designation:</strong> Grievance Redressal Officer, PickASAP</p>
            <p><strong>Email:</strong> <span className="font-mono text-[#FF6E40]">grievance@pickasap.com</span> / <span className="font-mono text-[#FF6E40]">support@pickasap.com</span></p>
            <p><strong>Location:</strong> Bangalore, Karnataka, India</p>
            <p><strong>Response Timeline:</strong> Acknowledgement within 48 hours; resolution within 30 days.</p>
          </div>
        </section>
      </main>
    </div>
  );
};
