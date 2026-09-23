import React from 'react';
import { ArrowLeft, FileText, Shield, RotateCcw, Truck, Mail } from 'lucide-react';
import { AppView } from '../../types';

interface LegalNavHeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  title: string;
  subtitle: string;
  lastUpdated?: string;
}

export const LegalNavHeader: React.FC<LegalNavHeaderProps> = ({
  currentView,
  setCurrentView,
  title,
  subtitle,
  lastUpdated = 'September 2026',
}) => {
  const tabs: { id: AppView; label: string; icon: React.ReactNode }[] = [
    { id: 'terms', label: 'Terms & Conditions', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'cancellation-refund', label: 'Cancellation & Refund', icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: 'shipping-exchange', label: 'Shipping & Exchange', icon: <Truck className="w-3.5 h-3.5" /> },
    { id: 'contact', label: 'Contact Us', icon: <Mail className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#0c0c0d]/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        {/* Back Link */}
        <div className="mb-6">
          <button
            onClick={() => setCurrentView('magazine')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Curated Magazine</span>
          </button>
        </div>

        {/* Header Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
            <span>PickASAP Compliance &amp; Policies</span>
            <span>·</span>
            <span>Last Updated: {lastUpdated}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-neutral-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 mt-8 overflow-x-auto no-scrollbar pb-1 border-b border-neutral-200 dark:border-neutral-800">
          {tabs.map((tab) => {
            const isActive = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
