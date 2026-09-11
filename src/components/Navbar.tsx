import React from 'react';
import { Plus, Sun, Moon, LogOut, LayoutDashboard, BookOpen, User } from 'lucide-react';
import { PickAsapLogo } from './PickAsapLogo';
import { UserProfile } from '../types';

interface NavbarProps {
  currentView: 'magazine' | 'dashboard' | 'login';
  setCurrentView: (view: 'magazine' | 'dashboard' | 'login') => void;
  user: UserProfile | null;
  onLogout: () => void;
  onOpenUploadModal: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  favoritesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  user,
  onLogout,
  onOpenUploadModal,
  darkMode,
  setDarkMode,
  favoritesCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0c0c0d]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left: Brand Logo matching the user's uploaded logo */}
        <div
          onClick={() => setCurrentView('magazine')}
          className="cursor-pointer group flex items-center"
        >
          <PickAsapLogo size="md" showWordmark={true} />
        </div>

        {/* Center / Right Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium uppercase tracking-widest text-neutral-600 dark:text-neutral-300">
          {user && (
            <button
              id="nav-dashboard-link"
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-1.5 transition-colors hover:text-black dark:hover:text-white cursor-pointer ${
                currentView === 'dashboard'
                  ? 'text-black dark:text-white font-bold border-b border-black dark:border-white pb-0.5'
                  : ''
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          )}
        </nav>

        {/* Right Section: Theme Toggle & The Requested Dynamic Upload Button / "+" Icon */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile / Logout if logged in */}
          {user ? (
            <div className="flex items-center gap-2">
              <button
                id="user-dashboard-trigger"
                onClick={() =>
                  setCurrentView(currentView === 'dashboard' ? 'magazine' : 'dashboard')
                }
                title="View Creator Dashboard"
                className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#FF6E40] to-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="max-w-[100px] truncate">{user.name || 'Curator'}</span>
              </button>

              <button
                id="logout-btn"
                onClick={onLogout}
                title="Log out"
                className="w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Exact user requirement:
                  "and on their dashboard show a '+' icon at the place where he was first seeing a button of 'upload your own affiliate links' and when the user clicks on that + icon show a mini page where he can upload his product images through his device, and add his affiliate link"
              */}
              <button
                id="nav-plus-upload-icon-btn"
                onClick={onOpenUploadModal}
                title="Upload New Product (+)"
                className="w-10 h-10 rounded-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer"
                aria-label="Upload product"
              >
                <Plus className="w-5 h-5 stroke-[2.5] text-[#FF6E40]" />
              </button>
            </div>
          ) : (
            /* When NOT logged in: Show the requested button "upload your own affiliate links" on desktop screens, hidden on mobile web */
            <button
              id="upload-affiliate-links-btn"
              onClick={() => setCurrentView('login')}
              className="hidden sm:inline-flex items-center justify-center px-4 sm:px-5 py-2.5 rounded-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Upload Your Own Affiliate Links
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
