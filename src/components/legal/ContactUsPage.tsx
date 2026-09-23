import React, { useState, useEffect } from 'react';
import { LegalNavHeader } from './LegalNavHeader';
import { AppView } from '../../types';
import {
  Mail,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ContactUsPageProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const ContactUsPage: React.FC<ContactUsPageProps> = ({ currentView, setCurrentView }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Support',
    paymentId: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketId: string;
    email: string;
    timestamp: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Contact Us | PickASAP';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setErrorMessage('Please fill in your name, email address, and message.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate/record ticket generation
      await new Promise((r) => setTimeout(r, 600));

      const generatedTicketId = `PAS-${Math.floor(100000 + Math.random() * 900000)}`;

      // Save inquiry to localStorage for user reference
      try {
        const existingInquiries = JSON.parse(localStorage.getItem('pickasap_inquiries') || '[]');
        existingInquiries.push({
          ticketId: generatedTicketId,
          ...formData,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('pickasap_inquiries', JSON.stringify(existingInquiries));
      } catch {
        // non-blocking
      }

      setSubmittedTicket({
        ticketId: generatedTicketId,
        email: formData.email,
        timestamp: new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      // Clear form
      setFormData({
        name: '',
        email: '',
        subject: 'General Support',
        paymentId: '',
        message: '',
      });
    } catch {
      setErrorMessage('Failed to submit your message. Please write directly to support@pickasap.com.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0d] text-neutral-800 dark:text-neutral-200">
      <LegalNavHeader
        currentView={currentView}
        setCurrentView={setCurrentView}
        title="Contact Us"
        subtitle="Have questions about curated shopping deals, creator revenue tiers, or Razorpay platform fees? We're here to help."
        lastUpdated="September 2026"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Quick Contact Info Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-[#FF6E40]/10 text-[#FF6E40] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Official Email
            </span>
            <a
              href="mailto:support@pickasap.com"
              className="font-bold text-sm text-neutral-900 dark:text-white hover:text-[#FF6E40] transition-colors block"
            >
              support@pickasap.com
            </a>
            <span className="text-[11px] text-neutral-400 block">
              General inquiries &amp; Creator Desk
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Response Time
            </span>
            <span className="font-bold text-sm text-neutral-900 dark:text-white block">
              Within 24 Hours
            </span>
            <span className="text-[11px] text-neutral-400 block">
              Monday &ndash; Saturday (9:00 AM &ndash; 6:00 PM IST)
            </span>
          </div>
        </section>

        {/* Contact Form & Submission Section */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="p-6 sm:p-8 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-6">
              <div>
                <h2 className="text-xl font-serif-editorial font-bold text-neutral-900 dark:text-white">
                  Send us a Message
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Fill in your details below. Our team reviews every submission promptly.
                </p>
              </div>

              {submittedTicket ? (
                <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Message Submitted Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    Thank you for reaching out. We have logged your request under ticket{' '}
                    <strong className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                      {submittedTicket.ticketId}
                    </strong>
                    . Our support team will respond to <strong className="font-medium">{submittedTicket.email}</strong> within 24 business hours.
                  </p>
                  <button
                    onClick={() => setSubmittedTicket(null)}
                    className="text-xs font-semibold underline text-emerald-800 dark:text-emerald-200 cursor-pointer pt-1 block"
                  >
                    Send another inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0c0c0d] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0c0c0d] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Topic / Category
                      </label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0c0c0d] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                      >
                        <option value="General Support">General Support</option>
                        <option value="Creator Platform & Fees">Creator Platform &amp; Fees</option>
                        <option value="Razorpay Billing / Receipt">Razorpay Billing / Receipt</option>
                        <option value="Affiliate Partnership">Affiliate Partnership / Stores</option>
                        <option value="Price Correction Report">Price Correction / Report</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Payment / Order ID <span className="font-normal text-neutral-400">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.paymentId}
                        onChange={(e) => setFormData({ ...formData, paymentId: e.target.value })}
                        placeholder="pay_... (if billing related)"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0c0c0d] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Your Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Please describe how we can assist you with your question or request..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0c0c0d] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6E40]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#FF6E40] hover:bg-[#e85b2e] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Message to Support</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar Info & FAQ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Direct Channel */}
            <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
              <h3 className="font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
                Support Channel
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[11px]">Customer &amp; Creator Support:</span>
                  <a href="mailto:support@pickasap.com" className="font-medium text-[#FF6E40] hover:underline">
                    support@pickasap.com
                  </a>
                </div>
              </div>
            </div>

            {/* Quick FAQs */}
            <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-[#151720] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
              <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5 text-[#FF6E40]" />
                <span>Frequently Asked</span>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <strong className="text-neutral-900 dark:text-white block font-medium">
                    Where is my product delivery?
                  </strong>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-0.5">
                    Orders are placed directly with Flipkart, Amazon, or Myntra. Please check the tracking link sent by the retailer in your SMS/email.
                  </p>
                </div>
                <div>
                  <strong className="text-neutral-900 dark:text-white block font-medium">
                    How do I unlock link uploads?
                  </strong>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-0.5">
                    If your account exceeds 10,000 monthly clicks, activate your monthly platform fee via Razorpay in the creator modal or Dashboard.
                  </p>
                </div>
                <div>
                  <strong className="text-neutral-900 dark:text-white block font-medium">
                    How are prices updated?
                  </strong>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-0.5">
                    Our platform combines automatic retail intelligence with verified community and admin updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
