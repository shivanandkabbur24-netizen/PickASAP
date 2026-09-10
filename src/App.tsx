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
import { Product, UserProfile, StoreType, SortOption, CategoryType } from './types';
import { database as db } from './lib/firebase';
import { ShoppingBag, ShieldCheck, Sparkles, Tag, ExternalLink } from 'lucide-react';

export default function App() {
  // State management
  const [currentView, setCurrentView] = useState<'magazine' | 'dashboard' | 'login'>('magazine');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
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

  // Load initial data
  useEffect(() => {
    // Current user
    const existingUser = db.getCurrentUser();
    if (existingUser) {
      setUser(existingUser);
    }

    // Products (strictly empty initially unless uploaded by user)
    db.getProducts().then((data) => {
      setProducts(data);
    });

    // Favorites
    setFavorites(db.getFavorites());

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

    window.addEventListener('pickasap:click_recorded', handleRealtimeClick as EventListener);
    window.addEventListener('pickasap:auth_changed', handleAuthChange as EventListener);
    window.addEventListener('pickasap:favorites_changed', handleFavChange as EventListener);

    return () => {
      window.removeEventListener('pickasap:click_recorded', handleRealtimeClick as EventListener);
      window.removeEventListener('pickasap:auth_changed', handleAuthChange as EventListener);
      window.removeEventListener('pickasap:favorites_changed', handleFavChange as EventListener);
    };
  }, []);

  // Handle successful login or registration
  const handleAuthSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    // User requested: "And once the user registers or logs in redirect them to the dashboard"
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    db.setCurrentUser(null);
    setUser(null);
    setCurrentView('magazine');
  };

  const handleProductCreated = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to remove this affiliate product?')) {
      await db.deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const handleToggleFavorite = (productId: string) => {
    const updated = db.toggleFavorite(productId);
    setFavorites(updated);
  };

  // If viewing the login page (matching the full screen dark mockup from Image 2)
  if (currentView === 'login') {
    return (
      <LoginPage
        onSuccess={handleAuthSuccess}
        onCancel={() => setCurrentView('magazine')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900 dark:bg-[#0c0c0d] dark:text-[#f3f3f3] transition-colors">
      {/* Sticky Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        onLogout={handleLogout}
        onOpenUploadModal={() => {
          if (!user) {
            setCurrentView('login');
          } else {
            setIsUploadOpen(true);
          }
        }}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        favoritesCount={favorites.length}
      />

      {/* Main View Area */}
      <div className="flex-1">
        {currentView === 'dashboard' && user ? (
          <DashboardView
            user={user}
            products={products}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            onDeleteProduct={handleDeleteProduct}
            onSwitchToMagazine={() => setCurrentView('magazine')}
          />
        ) : (
          <MagazineView
            products={products}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onOpenUpload={() => {
              if (!user) {
                setCurrentView('login');
              } else {
                setIsUploadOpen(true);
              }
            }}
            isLoggedIn={Boolean(user)}
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

      {/* Editorial & SEO Rich Footer */}
      <footer className="mt-auto border-t border-neutral-200/80 dark:border-neutral-800/80 pt-16 pb-12 px-6 bg-neutral-50/80 dark:bg-[#08080a] text-neutral-600 dark:text-neutral-400">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Main 4-Column SEO Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
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
                      if (currentView !== 'magazine') setCurrentView('magazine');
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
                      if (currentView !== 'magazine') setCurrentView('magazine');
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
                      if (currentView !== 'magazine') setCurrentView('magazine');
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
                      if (currentView !== 'magazine') setCurrentView('magazine');
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

            {/* Column 3: Curated Deal Categories */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
                Curated Value Discoveries
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    id="footer-low-cost-link"
                    onClick={() => {
                      if (currentView !== 'magazine') setCurrentView('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { sort: 'price_low' } }));
                    }}
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <Tag className="w-3 h-3 text-emerald-500" />
                    <span>Low Cost Products &amp; Budget Deals</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-quality-picks-link"
                    onClick={() => {
                      if (currentView !== 'magazine') setCurrentView('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { sort: 'most_clicked' } }));
                    }}
                    className="hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span>Good Quality &amp; Highly Rated Products</span>
                  </button>
                </li>
                <li>
                  <button
                    id="footer-tech-link"
                    onClick={() => {
                      if (currentView !== 'magazine') setCurrentView('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { category: 'Tech & Audio' } }));
                    }}
                    className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Tech &amp; Audio Innovations
                  </button>
                </li>
                <li>
                  <button
                    id="footer-fashion-link"
                    onClick={() => {
                      if (currentView !== 'magazine') setCurrentView('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { category: 'Fashion & Apparel' } }));
                    }}
                    className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Fashion &amp; Seasonal Wardrobe
                  </button>
                </li>
                <li>
                  <button
                    id="footer-home-link"
                    onClick={() => {
                      if (currentView !== 'magazine') setCurrentView('magazine');
                      window.dispatchEvent(new CustomEvent('pickasap:filter', { detail: { category: 'Home & Design' } }));
                    }}
                    className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Home, Living &amp; Interior Design
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Affiliate Transparency & Editorial Policy */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">
                Affiliate Marketing Disclosure
              </h3>
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                PickASAP participates in verified affiliate marketing programs with Flipkart, Amazon, Myntra, and top retailers. When you purchase through our links, we may earn an affiliate commission at zero extra cost to you.
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Prices and availability are accurate at time of publication and subject to merchant adjustments.
              </p>
            </div>
          </div>

          {/* SEO Keyword & Subdomain Directory Bar */}
          <div className="pt-8 border-t border-neutral-200/60 dark:border-neutral-800/60">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 text-neutral-400 dark:text-neutral-500 text-[11px]">
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">SEO Directory:</span>
                <span>PickASAP</span>
                <span>•</span>
                <span>pickasap</span>
                <span>•</span>
                <span>Affiliate</span>
                <span>•</span>
                <span>Flipkart Deals</span>
                <span>•</span>
                <span>Amazon Finds</span>
                <span>•</span>
                <span>Myntra Fashion</span>
                <span>•</span>
                <span>Shopping</span>
                <span>•</span>
                <span>Low Cost Products</span>
                <span>•</span>
                <span>Good Quality Products</span>
                <span>•</span>
                <span>Affiliate Marketing</span>
              </div>
              <div className="text-neutral-500 dark:text-neutral-400 whitespace-nowrap text-xs">
                © 2026 PickASAP. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
