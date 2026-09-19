import React, { useState, useEffect, useMemo } from 'react';
import { X, ShieldCheck, Tag, Calendar, AlertCircle, CheckCircle2, DollarSign, Clock, ExternalLink, Percent, Search, Check } from 'lucide-react';
import { Product } from '../types';
import { databaseService as db, formatPriceDisplay, parsePriceToNumber } from '../lib/firebase';

interface AdminPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: Product | null;
  allProducts: Product[];
  onProductSelect?: (product: Product) => void;
  onUpdateSuccess: (updatedProduct: Product) => void;
}

export const AdminPriceUpdateModal: React.FC<AdminPriceUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedProduct,
  allProducts,
  onProductSelect,
  onUpdateSuccess,
}) => {
  const [activeProductId, setActiveProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [mrp, setMrp] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [offerDescription, setOfferDescription] = useState<string>('');
  const [offerExpiry, setOfferExpiry] = useState<string>('');
  const [dealStatus, setDealStatus] = useState<'verified' | 'pending' | 'expired'>('verified');
  const [note, setNote] = useState<string>('');
  const [affiliateUrl, setAffiliateUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Dynamically filter and order products matching what the user types
  const searchedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allProducts;

    const startsWithTitle: Product[] = [];
    const containsTitle: Product[] = [];
    const otherMatches: Product[] = [];

    allProducts.forEach((p) => {
      const title = (p.title || '').toLowerCase();
      const store = (p.store || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();

      if (title.startsWith(q)) {
        startsWithTitle.push(p);
      } else if (title.includes(q)) {
        containsTitle.push(p);
      } else if (store.includes(q) || cat.includes(q)) {
        otherMatches.push(p);
      }
    });

    return [...startsWithTitle, ...containsTitle, ...otherMatches];
  }, [allProducts, searchQuery]);

  // Synchronize state when selectedProduct changes
  useEffect(() => {
    if (selectedProduct) {
      setActiveProductId(selectedProduct.id);
      populateFields(selectedProduct);
    } else if (allProducts.length > 0) {
      setActiveProductId(allProducts[0].id);
      populateFields(allProducts[0]);
    }
  }, [selectedProduct, allProducts, isOpen]);

  const populateFields = (product: Product) => {
    const numPrice = product.currentPrice ?? parsePriceToNumber(product.price);
    setNewPrice(numPrice > 0 ? numPrice.toString() : '');
    setMrp(product.mrp || product.originalPrice || '');
    const disc = product.discount ?? product.discountPercent;
    setDiscount(disc !== undefined ? disc.toString() : '');
    setOfferDescription(product.offerDescription || '');
    setOfferExpiry(product.offerExpiry || '');
    setDealStatus((product.dealStatus as 'verified' | 'pending' | 'expired') || 'verified');
    setAffiliateUrl(product.affiliateUrl || '');
    setNote('');
    setError('');
    setSuccessMsg('');
  };

  const handleProductChange = (productId: string) => {
    setActiveProductId(productId);
    const prod = allProducts.find((p) => p.id === productId);
    if (prod) {
      if (onProductSelect) onProductSelect(prod);
      populateFields(prod);
    }
  };

  const currentProduct = allProducts.find((p) => p.id === activeProductId) || selectedProduct;

  // Auto-calculate discount percentage when MRP or New Price changes
  const handlePriceChange = (val: string) => {
    setNewPrice(val);
    const numPrice = parseFloat(val);
    const numMrp = parseFloat(mrp);
    if (!isNaN(numPrice) && !isNaN(numMrp) && numMrp > numPrice && numMrp > 0) {
      const calc = Math.round(((numMrp - numPrice) / numMrp) * 100);
      setDiscount(calc.toString());
    }
  };

  const handleMrpChange = (val: string) => {
    setMrp(val);
    const numPrice = parseFloat(newPrice);
    const numMrp = parseFloat(val);
    if (!isNaN(numPrice) && !isNaN(numMrp) && numMrp > numPrice && numMrp > 0) {
      const calc = Math.round(((numMrp - numPrice) / numMrp) * 100);
      setDiscount(calc.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!currentProduct) {
      setError('Please select a product to update.');
      return;
    }

    const parsedPrice = parseFloat(newPrice.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Please enter a valid positive numeric price.');
      return;
    }

    setLoading(true);

    try {
      const result = await db.updateProductPriceAndOffer(
        currentProduct.id,
        {
          price: parsedPrice,
          mrp: mrp.trim() || undefined,
          discount: discount ? parseInt(discount, 10) : undefined,
          offerDescription: offerDescription.trim() || undefined,
          offerExpiry: offerExpiry.trim() || undefined,
          dealStatus,
          note: note.trim() || 'Verified price change',
          affiliateUrl: affiliateUrl.trim() || undefined,
        }
      );

      const { product: updated, snapshotCreated } = result;

      setLoading(false);
      setSuccessMsg(
        snapshotCreated
          ? `Price updated to ${formatPriceDisplay(parsedPrice)} and new price-history snapshot recorded successfully!`
          : `Product offer and details updated. (Price was identical, duplicate snapshot skipped).`
      );

      onUpdateSuccess(updated);

      // Auto close after brief pause
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Price update error:', err);
      setError('Failed to update price. Please check input values.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div
        id="admin-price-modal"
        className="relative w-full max-w-2xl bg-white dark:bg-[#121214] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-6 transition-all"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#FF6E40]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Admin Price & Deal Verification
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Update verified pricing, offer terms, and generate price-history snapshots.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Status feedback alerts */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Search Product Section (Replaced select dropdown with dynamic search & ordered list) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                Search Product to Verify / Update
              </label>
              <span className="text-[11px] text-neutral-400">
                {searchedProducts.length} {searchedProducts.length === 1 ? 'product' : 'products'} available
              </span>
            </div>

            {/* Search Input Bar with Search Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-search-product-input"
                  type="text"
                  placeholder="Search products by title, store, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9.5 pr-8 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                id="search-product-btn"
                onClick={() => {
                  const input = document.getElementById('admin-search-product-input');
                  if (input) input.focus();
                }}
                className="px-3.5 py-2.5 bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Product</span>
              </button>
            </div>

            {/* Search Results List (Appearing dynamically in the order the user types) */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-1.5 space-y-1 scrollbar-thin">
              {searchedProducts.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-400">
                  No products matched "{searchQuery}". Try typing another name or keyword.
                </div>
              ) : (
                searchedProducts.map((p) => {
                  const isSelected = p.id === activeProductId;
                  return (
                    <div
                      key={p.id}
                      id={`search-item-${p.id}`}
                      onClick={() => handleProductChange(p.id)}
                      className={`p-2 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#FF6E40]/10 border border-[#FF6E40]/30 text-neutral-900 dark:text-white'
                          : 'hover:bg-white dark:hover:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-10 h-10 object-cover rounded-md bg-neutral-200 shrink-0 border border-neutral-200/60 dark:border-neutral-700/60"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium truncate ${isSelected ? 'font-bold text-[#FF6E40]' : ''}`}>
                            {p.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                            <span className="font-semibold text-neutral-600 dark:text-neutral-300">{p.store}</span>
                            <span>•</span>
                            <span className="font-bold text-neutral-900 dark:text-white">{p.price}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductChange(p.id);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF6E40] text-white'
                            : 'bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Current Product Quick Summary Card */}
          {currentProduct && (
            <div className="p-3.5 bg-neutral-100/80 dark:bg-neutral-850 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3.5">
              <img
                src={currentProduct.imageUrl}
                alt={currentProduct.title}
                className="w-14 h-14 object-cover rounded-lg bg-neutral-200 shrink-0 border border-neutral-200 dark:border-neutral-700"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {currentProduct.store}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    currentProduct.dealStatus === 'verified'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    {currentProduct.dealStatus === 'verified' ? '✓ Verified Deal' : 'Pending Review'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate mt-1">
                  {currentProduct.title}
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  <span>
                    Current Listed Price: <strong className="text-neutral-900 dark:text-white">{currentProduct.price}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last checked: {currentProduct.lastUpdated ? new Date(currentProduct.lastUpdated).toLocaleDateString() : 'Initial'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* New Verified Price */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                New Verified Price (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-sm font-bold">₹</span>
                <input
                  id="new-verified-price-input"
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 10917"
                  value={newPrice}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
                />
              </div>
            </div>

            {/* List Price / MRP */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                Original MRP / List Price (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-sm font-bold">₹</span>
                <input
                  id="admin-mrp-input"
                  type="number"
                  step="any"
                  placeholder="e.g. 14999"
                  value={mrp}
                  onChange={(e) => handleMrpChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
                />
              </div>
            </div>

            {/* Discount Percent */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                Discount Percentage (%)
              </label>
              <div className="relative">
                <input
                  id="admin-discount-input"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 27"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
                />
                <span className="absolute right-3 top-2.5 text-neutral-400 text-xs font-semibold">%</span>
              </div>
            </div>
          </div>

          {/* Deal Status & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                Deal Verification Status
              </label>
              <select
                id="admin-deal-status"
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value as 'verified' | 'pending' | 'expired')}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
              >
                <option value="verified">✓ Verified Genuine Deal</option>
                <option value="pending">⏳ Pending Review / In Verification</option>
                <option value="expired">✕ Deal Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                Offer Expiry (Optional)
              </label>
              <input
                id="admin-expiry-input"
                type="date"
                value={offerExpiry}
                onChange={(e) => setOfferExpiry(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
              />
            </div>
          </div>

          {/* Offer Description / Coupon / Bank Offer Details */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Offer Details & Promotion Terms
            </label>
            <input
              id="admin-offer-desc-input"
              type="text"
              placeholder="e.g. Extra ₹2,000 off with HDFC/ICICI Bank Cards. Free shipping."
              value={offerDescription}
              onChange={(e) => setOfferDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
            />
          </div>

          {/* Price Snapshot Note (Context for price drop or snapshot) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Snapshot Observation Note (Recorded in Price History)
            </label>
            <input
              id="admin-snapshot-note-input"
              type="text"
              placeholder="e.g. Weekend lightning deal verification, Festival price match"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#FF6E40]"
            />
            <span className="text-[11px] text-neutral-400 mt-0.5 block">
              This note will appear when shoppers hover on this specific price observation in the history chart.
            </span>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="admin-save-price-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#FF6E40] hover:bg-[#E65A2E] disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <span>Recording Snapshot...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Verified Price & Snapshot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
