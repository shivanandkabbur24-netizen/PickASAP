/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from '../types';

export function parsePriceToNumber(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate effective discount percentage from explicit fields or MRP comparison
 */
export const getEffectiveDiscount = (product: Product): number => {
  if (typeof product.discountPercent === 'number' && product.discountPercent > 0) {
    return product.discountPercent;
  }
  if (typeof product.discount === 'number' && product.discount > 0) {
    return product.discount;
  }
  if (typeof product.discountPercentage === 'number' && product.discountPercentage > 0) {
    return product.discountPercentage;
  }
  const original = parsePriceToNumber(product.originalPrice || product.mrp);
  const current = typeof product.currentPrice === 'number' && product.currentPrice > 0
    ? product.currentPrice
    : parsePriceToNumber(product.price);
  if (original > current && original > 0 && current > 0) {
    return Math.round(((original - current) / original) * 100);
  }
  return 0;
};
