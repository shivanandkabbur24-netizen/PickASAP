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
import { Product, UserProfile } from './types';
import { database as db } from './lib/firebase';

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

      {/* Editorial Footer */}
      <footer className="mt-auto border-t border-neutral-100 dark:border-neutral-800/80 py-12 px-6 bg-neutral-50/60 dark:bg-[#08080a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span className="font-serif-editorial font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              PickASAP
            </span>
            <span className="hidden sm:inline">•</span>
            <span>The High-End Digital Curated Shopping Magazine</span>
          </div>

          <div className="flex items-center gap-6">
            <span>© 2026 PickASAP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
