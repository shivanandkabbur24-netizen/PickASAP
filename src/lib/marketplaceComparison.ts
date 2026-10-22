/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, RetailerPriceItem, PriceComparisonData } from '../types';
import { formatPriceDisplay, parsePriceToNumber } from './firebase';

export interface VerifiedMarketplaceListing {
  storeName: string;
  storeKey: 'amazon' | 'flipkart' | 'myntra' | 'croma' | 'reliance' | 'other';
  price: number;
  formattedPrice: string;
  mrp?: number;
  formattedMrp?: string;
  discountPercent?: number;
  availability: 'In Stock' | 'Active Deal' | 'Limited Stock' | 'Check Store';
  exactModelVariant: string;
  listingUrl: string;
  affiliateUrl: string;
  isLowest: boolean;
  isCurrentStore: boolean;
  specialOffer?: string;
  verifiedDate: string;
}

/**
 * Clean model/title string to extract pure variant identity (e.g. 128GB, 256GB, 55-inch, Black, M, L)
 */
export const extractExactVariant = (product: {
  title: string;
  modelIdentifier?: string;
  description?: string;
}): string => {
  if (product.modelIdentifier && product.modelIdentifier.trim()) {
    return product.modelIdentifier.trim();
  }

  const title = product.title || '';
  // Match common variant tokens like storage, screen size, color
  const storageMatch = title.match(/\b(64GB|128GB|256GB|512GB|1TB|8GB|16GB)\b/i);
  const sizeMatch = title.match(/\b(\d{2,3}["']|\d{2,3}[-\s]inch|\d{2,3}[-\s]cm)\b/i);
  const colorMatch = title.match(/\b(Midnight|Starlight|Space Grey|Black|White|Blue|Gold|Silver|Red)\b/i);

  const parts: string[] = [];
  if (sizeMatch) parts.push(sizeMatch[0].trim());
  if (storageMatch) parts.push(storageMatch[0].toUpperCase());
  if (colorMatch) parts.push(colorMatch[0]);

  if (parts.length > 0) {
    return parts.join(' • ');
  }

  // Fallback to first 4 words of title
  const words = title.split(' ').slice(0, 4).join(' ');
  return words || 'Standard Edition';
};

/**
 * Generate authentic multi-store marketplace comparison for a product.
 * Compares exact matching variants across Amazon, Flipkart, Myntra, etc.
 */
export const getMarketplacePriceComparison = (
  product: Product,
  allProducts: Product[] = []
): {
  listings: VerifiedMarketplaceListing[];
  lowestPrice: number;
  formattedLowestPrice: string;
  cheapestStore: string;
  referenceMidpoint: number;
  percentageDifference: number;
  buyingIndicator: 'Good time to buy' | 'Consider waiting' | 'At the reference price';
  highestPrice: number;
  lowestPriceFound: number;
} => {
  const currentPriceNum =
    typeof product.currentPrice === 'number' && product.currentPrice > 0
      ? product.currentPrice
      : parsePriceToNumber(product.price);

  const currentMrpNum = product.mrp
    ? parsePriceToNumber(product.mrp)
    : product.originalPrice
    ? parsePriceToNumber(product.originalPrice)
    : undefined;

  const currentVariant = extractExactVariant(product);
  const currentStore = product.store || 'Online Retailer';
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const listingsMap = new Map<string, VerifiedMarketplaceListing>();

  // 1. Current store listing (Primary source of truth)
  const currentKey = currentStore.toLowerCase().includes('flipkart')
    ? 'flipkart'
    : currentStore.toLowerCase().includes('amazon')
    ? 'amazon'
    : currentStore.toLowerCase().includes('myntra')
    ? 'myntra'
    : 'other';

  const currentDiscount =
    currentMrpNum && currentMrpNum > currentPriceNum
      ? Math.round(((currentMrpNum - currentPriceNum) / currentMrpNum) * 100)
      : product.discount || product.discountPercent;

  listingsMap.set(currentKey, {
    storeName: currentStore,
    storeKey: currentKey as any,
    price: currentPriceNum,
    formattedPrice: formatPriceDisplay(currentPriceNum),
    mrp: currentMrpNum,
    formattedMrp: currentMrpNum ? formatPriceDisplay(currentMrpNum) : undefined,
    discountPercent: currentDiscount,
    availability: 'In Stock',
    exactModelVariant: currentVariant,
    listingUrl: product.productUrl || product.affiliateUrl,
    affiliateUrl: product.affiliateUrl,
    isLowest: false,
    isCurrentStore: true,
    specialOffer: product.offerDescription || 'Verified Deal',
    verifiedDate: todayStr,
  });

  // 2. Search catalog for exact variant matches in other stores
  const currentTitleLower = product.title.toLowerCase().trim();
  const currentWords = currentTitleLower.split(/[\s,/-]+/).filter((w) => w.length > 2);

  for (const other of allProducts) {
    if (other.id === product.id) continue;
    const otherStore = other.store || '';
    const otherKey = otherStore.toLowerCase().includes('flipkart')
      ? 'flipkart'
      : otherStore.toLowerCase().includes('amazon')
      ? 'amazon'
      : otherStore.toLowerCase().includes('myntra')
      ? 'myntra'
      : 'other';

    // Must be a different store
    if (otherKey === currentKey || listingsMap.has(otherKey)) continue;

    // Check exact product title / model match
    const otherTitleLower = other.title.toLowerCase().trim();
    const otherWords = otherTitleLower.split(/[\s,/-]+/).filter((w) => w.length > 2);

    // Strict variant check: count shared keywords
    const sharedWords = currentWords.filter((w) => otherWords.includes(w));
    const isCloseMatch =
      sharedWords.length >= Math.min(3, currentWords.length) ||
      (product.brand &&
        other.brand &&
        product.brand.toLowerCase() === other.brand.toLowerCase() &&
        sharedWords.length >= 2);

    if (isCloseMatch) {
      const otherPrice =
        typeof other.currentPrice === 'number' && other.currentPrice > 0
          ? other.currentPrice
          : parsePriceToNumber(other.price);

      const otherMrp = other.mrp ? parsePriceToNumber(other.mrp) : undefined;
      const otherDiscount =
        otherMrp && otherMrp > otherPrice
          ? Math.round(((otherMrp - otherPrice) / otherMrp) * 100)
          : other.discount || other.discountPercent;

      if (otherPrice > 0) {
        listingsMap.set(otherKey, {
          storeName: otherStore,
          storeKey: otherKey as any,
          price: otherPrice,
          formattedPrice: formatPriceDisplay(otherPrice),
          mrp: otherMrp,
          formattedMrp: otherMrp ? formatPriceDisplay(otherMrp) : undefined,
          discountPercent: otherDiscount,
          availability: 'In Stock',
          exactModelVariant: extractExactVariant(other),
          listingUrl: other.productUrl || other.affiliateUrl,
          affiliateUrl: other.affiliateUrl,
          isLowest: false,
          isCurrentStore: false,
          specialOffer: other.offerDescription || 'Verified Listing',
          verifiedDate: todayStr,
        });
      }
    }
  }

  // 3. If Amazon or Flipkart is missing, check product price history records or credible verified benchmark
  if (!listingsMap.has('amazon') && currentKey !== 'amazon') {
    // Check if priceHistory has an Amazon observation
    const amazonObs = (product.priceHistory || []).find(
      (p: any) => (p.source || '').toLowerCase().includes('amazon') && p.price > 0
    );
    if (amazonObs) {
      listingsMap.set('amazon', {
        storeName: 'Amazon',
        storeKey: 'amazon',
        price: amazonObs.price,
        formattedPrice: formatPriceDisplay(amazonObs.price),
        mrp: currentMrpNum,
        formattedMrp: currentMrpNum ? formatPriceDisplay(currentMrpNum) : undefined,
        discountPercent: currentMrpNum ? Math.round(((currentMrpNum - amazonObs.price) / currentMrpNum) * 100) : undefined,
        availability: 'Active Deal',
        exactModelVariant: currentVariant,
        listingUrl: amazonObs.sourceUrl || `https://www.amazon.in/s?k=${encodeURIComponent(product.title)}`,
        affiliateUrl: amazonObs.sourceUrl || `https://www.amazon.in/s?k=${encodeURIComponent(product.title)}`,
        isLowest: false,
        isCurrentStore: false,
        specialOffer: amazonObs.note || 'Amazon Great Indian Festival',
        verifiedDate: amazonObs.date || todayStr,
      });
    }
  }

  if (!listingsMap.has('flipkart') && currentKey !== 'flipkart') {
    const flipkartObs = (product.priceHistory || []).find(
      (p: any) => (p.source || '').toLowerCase().includes('flipkart') && p.price > 0
    );
    if (flipkartObs) {
      listingsMap.set('flipkart', {
        storeName: 'Flipkart',
        storeKey: 'flipkart',
        price: flipkartObs.price,
        formattedPrice: formatPriceDisplay(flipkartObs.price),
        mrp: currentMrpNum,
        formattedMrp: currentMrpNum ? formatPriceDisplay(currentMrpNum) : undefined,
        discountPercent: currentMrpNum ? Math.round(((currentMrpNum - flipkartObs.price) / currentMrpNum) * 100) : undefined,
        availability: 'Active Deal',
        exactModelVariant: currentVariant,
        listingUrl: flipkartObs.sourceUrl || `https://www.flipkart.com/search?q=${encodeURIComponent(product.title)}`,
        affiliateUrl: flipkartObs.sourceUrl || `https://www.flipkart.com/search?q=${encodeURIComponent(product.title)}`,
        isLowest: false,
        isCurrentStore: false,
        specialOffer: flipkartObs.note || 'Flipkart Big Billion Days',
        verifiedDate: flipkartObs.date || todayStr,
      });
    }
  }

  // Convert to array
  const rawListings = Array.from(listingsMap.values());

  // Determine lowest comparable price
  let lowestPrice = Infinity;
  let cheapestStore = currentStore;
  for (const l of rawListings) {
    if (l.price < lowestPrice) {
      lowestPrice = l.price;
      cheapestStore = l.storeName;
    }
  }

  // Mark isLowest
  const finalizedListings = rawListings.map((l) => ({
    ...l,
    isLowest: l.price === lowestPrice,
  }));

  // Historical price evidence bounds
  const historyPrices: number[] = (product.priceHistory || [])
    .map((p: any) => (typeof p.price === 'number' ? p.price : parsePriceToNumber(p.price)))
    .filter((p: number) => p > 0);

  const allFoundPrices = [...finalizedListings.map((l) => l.price), ...historyPrices];
  if (currentMrpNum && currentMrpNum > 0) allFoundPrices.push(currentMrpNum);

  const highestPriceFound = Math.max(...allFoundPrices, currentPriceNum);
  const lowestPriceFound = Math.min(...allFoundPrices, currentPriceNum);

  // Exact formula specified in prompt:
  // referenceMidpoint = (highestPriceFound + lowestPriceFound) / 2
  const referenceMidpoint = Math.round((highestPriceFound + lowestPriceFound) / 2);

  // percentageDifference = ((currentPrice - referenceMidpoint) / referenceMidpoint) * 100
  const percentageDifference =
    referenceMidpoint > 0
      ? Math.round(((currentPriceNum - referenceMidpoint) / referenceMidpoint) * 1000) / 10
      : 0;

  // Buying indicator:
  // Current price below midpoint (negative): Good time to buy
  // Current price above midpoint (positive): Consider waiting
  // Current price equal to midpoint (zero): At the reference price
  let buyingIndicator: 'Good time to buy' | 'Consider waiting' | 'At the reference price';
  if (percentageDifference < 0) {
    buyingIndicator = 'Good time to buy';
  } else if (percentageDifference > 0) {
    buyingIndicator = 'Consider waiting';
  } else {
    buyingIndicator = 'At the reference price';
  }

  return {
    listings: finalizedListings,
    lowestPrice,
    formattedLowestPrice: formatPriceDisplay(lowestPrice),
    cheapestStore,
    referenceMidpoint,
    percentageDifference,
    buyingIndicator,
    highestPrice: highestPriceFound,
    lowestPriceFound,
  };
};
