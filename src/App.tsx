/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MagazineView } from './components/MagazineView';
import { DashboardView } from './components/DashboardView';
import { LoginPage } from './components/LoginPage';
import { UploadModal } from './components/UploadModal';
import { AdminPriceUpdateModal } from './components/AdminPriceUpdateModal';
import { PlatformFeeModal } from './components/PlatformFeeModal';
import { ProductDetailPage } from './components/ProductDetailPage';
import { AffiliatePartnerProfile } from './components/AffiliatePartnerProfile';
import { TermsPage } from './components/legal/TermsPage';
import { PrivacyPolicyPage } from './components/legal/PrivacyPolicyPage';
import { CancellationRefundPage } from './components/legal/CancellationRefundPage';
import { ShippingExchangePage } from './components/legal/ShippingExchangePage';
import { ContactUsPage } from './components/legal/ContactUsPage';
import { Product, UserProfile, StoreType, SortOption, CategoryType, ClickRecord, AppView } from './types';
import { database as db } from './lib/firebase';
import {
  getCurrentMonthKey,
  getMonthlyClicksForUser,
  getRevenueTier,
  isPlatformFeePaidForMonth,
} from './lib/revenueModel';
import { ShoppingBag, ShieldCheck, Sparkles, Tag, ExternalLink, TrendingUp, FileText, Scale, RotateCcw, Truck, Mail } from 'lucide-react';

export default function App() {
  // State management with URL deep linking (?page=terms, ?page=privacy, ?page=cancellation-refund, etc.)
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page');
      if (page === 'terms' || page === 'terms-and-conditions') return 'terms';
      if (page === 'privacy' || page === 'privacy-policy') return 'privacy';
      if (page === 'refunds' || page === 'cancellation-refund' || page === 'refund-policy') return 'cancellation-refund';
      if (page === 'shipping' || page === 'shipping-exchange' || page === 'shipping-policy') return 'shipping-exchange';
      if (page === 'contact' || page === 'contact-us') return 'contact';
      if (page === 'dashboard') return 'dashboard';
      if (page === 'login') return 'login';

      const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (path === 'terms' || path === 'terms-and-conditions') return 'terms';
      if (path === 'privacy' || path === 'privacy-policy') return 'privacy';
      if (path === 'cancellation-refund' || path === 'refunds') return 'cancellation-refund';
      if (path === 'shipping-exchange' || path === 'shipping') return 'shipping-exchange';
      if (path === 'contact' || path === 'contact-us') return 'contact';
      if (path === 'dashboard') return 'dashboard';
    }
    return 'magazine';
  });
  const [user, setUser] = useState<UserProfile | null>(() => db.getCurrentUser());
  // Synchronous cache retrieval ensures user-uploaded products render in 0ms on initial frame
  const [products, setProducts] = useState<Product[]>(() => db.getStoredProducts());
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(() => db.getStoredProducts().length === 0);
  const [favorites, setFavorites] = useState<string[]>(() => db.getFavorites());
  const [clicks, setClicks] = useState<ClickRecord[]>(() => db.getStoredClicks());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPlatformFeeOpen, setIsPlatformFeeOpen] = useState(false);
  const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
  const [priceUpdateProduct, setPriceUpdateProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('product');
      if (prodId) {
        const stored = db.getStoredProducts();
        return stored.find((p) => p.id === prodId) || null;
      }
    }
    return null;
  });
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const partnerId = params.get('partner');
      const partnerName = params.get('partnerName');
      if (partnerId || partnerName) {
        return { id: partnerId || '', name: partnerName || 'Affiliate Partner' };
      }
    }
    return null;
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pickasap_theme') === 'dark';
    } catch {
      return false;
    }
  });

  // Dark mode effect
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (darkMode) {
      root.classList.add('dark');
      body.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('pickasap_theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('pickasap_theme', 'light');
    }
  }, [darkMode]);

  // Real-time synchronization and live updates
  useEffect(() => {
    // 1. Subscribe to products with instant local cache feed and live Firestore updates
    const unsubscribeProducts = db.subscribeToProducts((liveProducts) => {
      setProducts(liveProducts);
      setIsProductsLoading(false);
    });

    // Subscribe to authentic outbound click stream
    const unsubscribeClicks = db.subscribeToClicks((liveClicks) => {
      setClicks(liveClicks);
    });

    // 2. Fast parallel check in case onSnapshot needs an immediate resolution
    db.getProducts().then((data) => {
      if (data && data.length > 0) {
        setProducts(data);
      }
      setIsProductsLoading(false);
    }).catch(() => {
      setIsProductsLoading(false);
    });

    // Listen to real-time click events
    const handleRealtimeClick = (e: CustomEvent<{ product: Product; clicksCount: number }>) => {
      if (e.detail?.product?.id) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === e.detail.product.id
              ? { ...p, clicksCount: e.detail.clicksCount }
              : p
          )
        );
      }
    };

    // Listen to auth changes
    const handleAuthChange = (e: CustomEvent<UserProfile | null>) => {
      setUser(e.detail);
    };

    // Listen to favorites changes
    const handleFavChange = (e: CustomEvent<string[]>) => {
      setFavorites(e.detail);
    };

    // Listen to product price & deal updates
    const handleProductUpdated = (e: CustomEvent<Product>) => {
      if (e.detail?.id) {
        setProducts((prev) =>
          prev.map((p) => (p.id === e.detail.id ? { ...p, ...e.detail } : p))
        );
        setSelectedProduct((prev) =>
          prev && prev.id === e.detail.id ? { ...prev, ...e.detail } : prev
        );
      }
    };

    window.addEventListener('pickasap:click_recorded', handleRealtimeClick as EventListener);
    window.addEventListener('pickasap:auth_changed', handleAuthChange as EventListener);
    window.addEventListener('pickasap:favorites_changed', handleFavChange as EventListener);
    window.addEventListener('pickasap:product_updated', handleProductUpdated as EventListener);

    return () => {
      unsubscribeProducts();
      unsubscribeClicks();
      window.removeEventListener('pickasap:click_recorded', handleRealtimeClick as EventListener);
      window.removeEventListener('pickasap:auth_changed', handleAuthChange as EventListener);
      window.removeEventListener('pickasap:favorites_changed', handleFavChange as EventListener);
      window.removeEventListener('pickasap:product_updated', handleProductUpdated as EventListener);
    };
  }, []);

  // Handle successful login or registration
  const handleAuthSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    // User requested: "And once the user registers or logs in redirect them to the dashboard"
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    db.signOutUser();
    db.setCurrentUser(null);
    setUser(null);
    setCurrentView('magazine');
  };

  const handleProductCreated = (newProduct: Product) => {
    setProducts((prev) => {
      const comboKey = `${(newProduct.affiliateUrl || '').trim()}::${(newProduct.title || '').trim().toLowerCase()}`;
      if (
        prev.some(
          (p) =>
            p.id === newProduct.id ||
            `${(p.affiliateUrl || '').trim()}::${(p.title || '').trim().toLowerCase()}` === comboKey
        )
      ) {
        return prev;
      }
      return [newProduct, ...prev];
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    // Remove immediately from state without window.confirm (which is blocked by sandboxed iframes)
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    await db.deleteProduct(productId);
  };

  const handleToggleFavorite = (productId: string) => {
    const updated = db.toggleFavorite(productId);
    setFavorites(updated);
  };

  const handleAttemptUpload = () => {
    if (!user) {
      setCurrentView('login');
      return;
    }
    const currentMonthKey = getCurrentMonthKey();
    const userProducts = products.filter(
      (p) => p.uploaderId === user.id || user.role === 'admin' || !p.uploaderId
    );
    const monthClicks = getMonthlyClicksForUser(
      userProducts,
      clicks,
      currentMonthKey,
      user
    );
    const tier = getRevenueTier(monthClicks);
    const feePaid = isPlatformFeePaidForMonth(user, currentMonthKey);

    if (tier.platformFee > 0 && !feePaid) {
      setIsPlatformFeeOpen(true);
    } else {
      setIsUploadOpen(true);
    }
  };

  // Dedicated Product Page selection & URL routing (?product=<id>)
  const handleSelectProduct = (product: Product | null) => {
    setSelectedProduct(product);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (product) {
        url.searchParams.set('product', product.id);
      } else {
        url.searchParams.delete('product');
      }
      window.history.pushState({}, '', url.toString());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated Affiliate Partner Profile selection & URL routing (?partner=<id>&partnerName=<name>)
  const handleSelectPartner = (partner: { id: string; name: string } | null) => {
    setSelectedPartner(partner);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (partner) {
        if (partner.id) url.searchParams.set('partner', partner.id);
        if (partner.name) url.searchParams.set('partnerName', partner.name);
        url.searchParams.delete('product');
      } else {
        url.searchParams.delete('partner');
        url.searchParams.delete('partnerName');
      }
      window.history.pushState({}, '', url.toString());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigation handler with URL sync (?page=<view>)
  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    setSelectedProduct(null);
    setSelectedPartner(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('product');
      url.searchParams.delete('partner');
      url.searchParams.delete('partnerName');
      if (view === 'magazine') {
        url.searchParams.delete('page');
      } else {
        url.searchParams.set('page', view);
      }
      window.history.pushState({}, '', url.toString());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Popstate listener to handle browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page');
      if (
        page &&
        ['terms', 'privacy', 'cancellation-refund', 'shipping-exchange', 'contact', 'dashboard', 'login'].includes(page)
      ) {
        setCurrentView(page as AppView);
        setSelectedProduct(null);
        setSelectedPartner(null);
        return;
      }

      const prodId = params.get('product');
      if (prodId) {
        const found = products.find((p) => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
          return;
        }
      }
      setSelectedProduct(null);

      const partnerId = params.get('partner');
      const partnerName = params.get('partnerName');
      if (partnerId || partnerName) {
        setSelectedPartner({ id: partnerId || '', name: partnerName || 'Affiliate Partner' });
      } else {
        setSelectedPartner(null);
      }

      if (!page && !prodId && !partnerId && !partnerName) {
        setCurrentView('magazine');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [products]);

  // Keep selected product in sync with realtime edits or price changes
  useEffect(() => {
    if (selectedProduct) {
      const fresh = products.find((p) => p.id === selectedProduct.id);
      if (fresh && fresh !== selectedProduct) {
        setSelectedProduct(fresh);
      }
    }
  }, [products]);

  const handleAffiliateClick = (e: React.MouseEvent, product: Product) => {
    db.recordClick(product);
  };

  // If viewing the login page (matching the full screen dark mockup from Image 2)
  if (currentView === 'login') {
    return (
      <LoginPage
        onSuccess={handleAuthSuccess}
        onCancel={() => {
          setCurrentView('magazine');
          handleSelectProduct(null);
          handleSelectPartner(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900 dark:bg-[#0c0c0d] dark:text-[#f3f3f3] transition-colors">
      {/* Sticky Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={handleNavigate}
        user={user}
        onLogout={handleLogout}
        onOpenUploadModal={handleAttemptUpload}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        favoritesCount={favorites.length}
      />

      {/* Main View Area */}
      <div className="flex-1">
        {selectedProduct ? (
          <ProductDetailPage
            product={selectedProduct}
            onBack={() => handleSelectProduct(null)}
            isFav={favorites.includes(selectedProduct.id)}
            onToggleFavorite={handleToggleFavorite}
            onOpenShare={(prod) => {
              if (navigator.share) {
                navigator
                  .share({
                    title: prod.title,
                    text: `Check out ${prod.title} on PickASAP: ${prod.price}`,
                    url: prod.affiliateUrl,
                  })
                  .catch(() => {});
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(prod.affiliateUrl);
              }
            }}
            onAffiliateClick={handleAffiliateClick}
            isAdmin={user?.role === 'admin'}
            currentUser={user}
            onOpenPriceUpdate={(product) => {
              setPriceUpdateProduct(product);
              setIsPriceUpdateOpen(true);
            }}
            allProducts={products}
            onSelectRelatedProduct={(rel) => handleSelectProduct(rel)}
            onSelectPartner={(partner) => {
              handleSelectProduct(null);
              handleSelectPartner(partner);
            }}
          />
        ) : selectedPartner ? (
          <AffiliatePartnerProfile
            partner={selectedPartner}
            products={products}
            onBack={() => handleSelectPartner(null)}
            onSelectProduct={handleSelectProduct}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onAffiliateClick={handleAffiliateClick}
          />
        ) : currentView === 'terms' ? (
          <TermsPage currentView={currentView} setCurrentView={handleNavigate} />
        ) : currentView === 'privacy' ? (
          <PrivacyPolicyPage currentView={currentView} setCurrentView={handleNavigate} />
        ) : currentView === 'cancellation-refund' ? (
          <CancellationRefundPage currentView={currentView} setCurrentView={handleNavigate} />
        ) : currentView === 'shipping-exchange' ? (
          <ShippingExchangePage currentView={currentView} setCurrentView={handleNavigate} />
        ) : currentView === 'contact' ? (
          <ContactUsPage currentView={currentView} setCurrentView={handleNavigate} />
        ) : currentView === 'dashboard' && user ? (
          <DashboardView
            user={user}
            products={products}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            onDeleteProduct={handleDeleteProduct}
            onSwitchToMagazine={() => {
              handleNavigate('magazine');
            }}
            onProductUpdated={(updated) => {
              setProducts((prev) =>
                prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
              );
            }}
            onSelectProduct={handleSelectProduct}
          />
        ) : (
          <MagazineView
            products={products}
            favorites={favorites}
            isLoading={isProductsLoading}
            onToggleFavorite={handleToggleFavorite}
            onOpenUpload={handleAttemptUpload}
            isLoggedIn={Boolean(user)}
            isAdmin={user?.role === 'admin'}
            onOpenPriceUpdate={(product) => {
              setPriceUpdateProduct(product);
              setIsPriceUpdateOpen(true);
            }}
            onSelectProduct={handleSelectProduct}
            onSelectPartner={handleSelectPartner}
          />
        )}
      </div>

      {/* Upload Modal (Mini page for device image upload + affiliate link) */}
      {user && (
        <UploadModal
          user={user}
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onProductCreated={handleProductCreated}
        />
      )}

      {/* Creator Platform Fee Modal */}
      {user && (
        <PlatformFeeModal
          isOpen={isPlatformFeeOpen}
          onClose={() => setIsPlatformFeeOpen(false)}
          user={user}
          monthlyClicks={getMonthlyClicksForUser(
            products.filter(
              (p) => p.uploaderId === user.id || user.role === 'admin' || !p.uploaderId
            ),
            clicks,
            getCurrentMonthKey(),
            user
          )}
          onPaymentSuccess={() => {
            setIsPlatformFeeOpen(false);
            const currentMonthKey = getCurrentMonthKey();
            const updatedUser: UserProfile = {
              ...user,
              platformFeePaidMonths: [
                ...(user.platformFeePaidMonths || []),
                currentMonthKey,
              ],
            };
            setUser(updatedUser);
            setIsUploadOpen(true);
          }}
        />
      )}

      {/* Global Admin Price Update Modal (Triggerable from ProductDetailModal or anywhere) */}
      {user?.role === 'admin' && (
        <AdminPriceUpdateModal
          isOpen={isPriceUpdateOpen}
          onClose={() => setIsPriceUpdateOpen(false)}
          selectedProduct={priceUpdateProduct}
          allProducts={products}
          onProductSelect={(prod) => setPriceUpdateProduct(prod)}
          onUpdateSuccess={(updatedProd) => {
            setProducts((prev) =>
              prev.map((p) => (p.id === updatedProd.id ? { ...p, ...updatedProd } : p))
            );
          }}
        />
      )}

      {/* Editorial & SEO Rich Footer */}
      <footer className="mt-auto border-t border-neutral-200/80 dark:border-neutral-800/80 pt-16 pb-12 px-6 bg-neutral-50/80 dark:bg-[#08080a] text-neutral-600 dark:text-neutral-400">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Main 5-Column SEO & Policy Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Column 1: PickASAP Identity & Overview */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-heading-editorial font-bold text-2xl text-neutral-900 dark:text-white tracking-tight">
                  PickASAP
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                  Affiliate Magazine
                </span>
              </div>
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                PickASAP is a premier digital curated shopping publication. We discover, review, and curate verified low cost products and high quality products across Flipkart, Amazon, Myntra, and leading online shopping platforms.
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Independently verified affiliate recommendations</span>
              </div>
            </div>

            {/* Column 2: Partner Stores & Hubs */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
                Featured Partner Hubs
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    id="footer-flipkart-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { store: 'Flipkart' } }));
                    }}
                    className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2874f0]"></span>
                    <span>Flipkart Deals &amp; Offers</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-amazon-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { store: 'Amazon' } }));
                    }}
                    className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff9900]"></span>
                    <span>Amazon Finds &amp; Best Sellers</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-myntra-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { store: 'Myntra' } }));
                    }}
                    className="hover:text-pink-600 dark:hover:text-pink-400 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff3f6c]"></span>
                    <span>Myntra Fashion &amp; Apparel</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-all-stores-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { store: 'All' } }));
                    }}
                    className="hover:text-neutral-900 dark:hover:text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                    <span>All Curated Retail Partners</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Curated Categories */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
                Curated Categories
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    id="footer-best-deals-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { sort: 'best' } }));
                    }}
                    className="hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer text-left font-medium"
                  >
                    <TrendingUp className="w-3 h-3 text-red-500" />
                    <span>Best Deals &amp; Top Products</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-low-cost-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { sort: 'price_low' } }));
                    }}
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <Tag className="w-3 h-3 text-emerald-500" />
                    <span>Low Cost Products</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-quality-picks-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { sort: 'most_clicked' } }));
                    }}
                    className="hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span>Quality Picks &amp; Highly Rated</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-tech-link"
                    onClick={() => {
                      if (currentView !== 'magazine') handleNavigate('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { category: 'Tech & Audio' } }));
                    }}
                    className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Tech &amp; Audio Innovations
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal & Policies */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
                Policies &amp; Support
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    id="footer-terms-link"
                    onClick={() => handleNavigate('terms')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer text-left ${
                      currentView === 'terms'
                        ? 'text-[#FF6E40] font-semibold'
                        : 'hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-3 h-3 text-neutral-400" />
                    <span>Terms and Conditions</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-privacy-link"
                    onClick={() => handleNavigate('privacy')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer text-left ${
                      currentView === 'privacy'
                        ? 'text-[#FF6E40] font-semibold'
                        : 'hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3 text-neutral-400" />
                    <span>Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-refund-link"
                    onClick={() => handleNavigate('cancellation-refund')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer text-left ${
                      currentView === 'cancellation-refund'
                        ? 'text-[#FF6E40] font-semibold'
                        : 'hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3 text-neutral-400" />
                    <span>Cancellation and Refund</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-shipping-link"
                    onClick={() => handleNavigate('shipping-exchange')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer text-left ${
                      currentView === 'shipping-exchange'
                        ? 'text-[#FF6E40] font-semibold'
                        : 'hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <Truck className="w-3 h-3 text-neutral-400" />
                    <span>Shipping and Exchange</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-contact-link"
                    onClick={() => handleNavigate('contact')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer text-left font-medium ${
                      currentView === 'contact'
                        ? 'text-[#FF6E40] font-bold'
                        : 'text-[#FF6E40] hover:underline'
                    }`}
                  >
                    <Mail className="w-3 h-3 text-[#FF6E40]" />
                    <span>Contact Us</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 5: Affiliate Transparency & Editorial Policy */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
                Affiliate Transparency
              </h3>
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                PickASAP participates in verified affiliate marketing programs with Flipkart, Amazon, Myntra, and top retailers. We may earn a commission on qualifying purchases at zero added cost to you.
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Platform fee subscriptions are secured by Razorpay PCI-DSS certified gateway.
              </p>
            </div>
          </div>

          {/* Quick Legal Strip & SEO Keyword Bar */}
          <div className="pt-8 border-t border-neutral-200/60 dark:border-neutral-800/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                <button
                  onClick={() => handleNavigate('terms')}
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Terms and Conditions
                </button>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <button
                  onClick={() => handleNavigate('privacy')}
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <button
                  onClick={() => handleNavigate('cancellation-refund')}
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancellation and Refund
                </button>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <button
                  onClick={() => handleNavigate('shipping-exchange')}
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Shipping and Exchange
                </button>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <button
                  onClick={() => handleNavigate('contact')}
                  className="hover:text-[#FF6E40] transition-colors cursor-pointer font-semibold"
                >
                  Contact Us
                </button>
              </div>

              <div className="text-neutral-500 dark:text-neutral-400 whitespace-nowrap text-xs">
                © 2026 PickASAP. All rights reserved.
              </div>
            </div>

            {/* Subdomain Directory Keywords */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 text-neutral-400 dark:text-neutral-500 text-[11px] pt-1">
              <span className="font-semibold text-neutral-600 dark:text-neutral-300">Directory:</span>
              <span>PickASAP</span>
              <span>•</span>
              <span>Affiliate Marketing Deals</span>
              <span>•</span>
              <span>Flipkart Deals</span>
              <span>•</span>
              <span>Amazon Finds</span>
              <span>•</span>
              <span>Myntra Fashion</span>
              <span>•</span>
              <span>Low Cost Products</span>
              <span>•</span>
              <span>Good Quality Products</span>
              <span>•</span>
              <span>Price Tracker &amp; Drop Alerts</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
