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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Left: Brand Logo matching the user's uploaded logo */}
        <div
          id="brand-logo-btn"
          onClick={() => setCurrentView('magazine')}
          className="cursor-pointer group flex items-center shrink-0 py-1"
          role="button"
          tabIndex={0}
          title="PickASAP Home"
        >
          <PickAsapLogo size="responsive" showWordmark={true} />
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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile / Logout if logged in */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                id="user-dashboard-trigger"
                onClick={() =>
                  setCurrentView(currentView === 'dashboard' ? 'magazine' : 'dashboard')
                }
                title={currentView === 'dashboard' ? 'Switch to Magazine View' : 'View Creator Dashboard'}
                className={`flex items-center gap-1.5 sm:gap-2 p-1 sm:pl-2 sm:pr-3 sm:py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0 ${
                  currentView === 'dashboard'
                    ? 'ring-1 ring-[#FF6E40] border-[#FF6E40]/50 bg-neutral-100/80 dark:bg-neutral-800/80'
                    : ''
                }`}
              >
                <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-[#FF6E40] to-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">{user.name || 'Curator'}</span>
              </button>

              <button
                id="logout-btn"
                onClick={onLogout}
                title="Log out"
                className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Exact user requirement:
                  "and on their dashboard show a '+' icon at the place where he was first seeing a button of 'upload your own affiliate links' and when the user clicks on that + icon show a mini page where he can upload his product images through his device, and add his affiliate link"
                  "also that + icon which is showed when the user has already logged in"
              */}
              <button
                id="nav-plus-upload-icon-btn"
                onClick={onOpenUploadModal}
                title="Add your own affiliate link (+)"
                className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                aria-label="Upload product"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-[#FF6E40]" />
              </button>
            </div>
          ) : (
            /* When NOT logged in:
               Exact user requirement:
               "add that 'add your own affiliate link' button on mobile screen also that + icon which is showed when the user has already logged in but to login through mobile first show the button in the right side of dark mode option"
            */
            <button
              id="upload-affiliate-links-btn"
              onClick={() => setCurrentView('login')}
              title="Add Link"
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5] text-[#FF6E40]" />
              <span className="hidden sm:inline">Add Link</span>
              <span className="sm:hidden">Add Link</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
