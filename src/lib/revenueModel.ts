import { Product, ClickRecord, UserProfile, RevenueTier } from '../types';
import { database as db } from './firebase';

export const REVENUE_TIERS: RevenueTier[] = [
  {
    id: 'free',
    name: 'Free Tier',
    minClicks: 0,
    maxClicks: 9999,
    platformFee: 0,
    description: 'Up to 9,999 clicks in a month. Perfect for new creators getting started.',
    perks: [
      'Unlimited uploads (under 10,000 monthly clicks)',
      'Real-time click telemetry & store attribution',
      'Standard placement on PickASAP Curated Magazine',
    ],
  },
  {
    id: 'growth',
    name: 'Growth Tier',
    minClicks: 10000,
    maxClicks: 50000,
    platformFee: 499,
    description: '10,000 to 50,000 clicks in a month. High affiliate earning volume.',
    perks: [
      'Upload new affiliate links with active monthly platform fee',
      'Priority indexing on magazine shelves',
      'Verified Deal status & background price intelligence tracking',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Tier',
    minClicks: 50001,
    maxClicks: 100000,
    platformFee: 999,
    description: 'More than 50,000 up to 1,00,000 clicks in a month. Premier affiliate partner.',
    perks: [
      'Upload new affiliate links with active monthly platform fee',
      'Featured placement in top category carousels',
      'Detailed monthly telemetry & store conversion breakdown',
    ],
  },
  {
    id: 'elite',
    name: 'Elite Tier',
    minClicks: 100001,
    maxClicks: null,
    platformFee: 1999,
    description: 'More than 1,00,000 clicks in a month. Enterprise influencer scale.',
    perks: [
      'Upload new affiliate links with active monthly platform fee',
      'Featured top hero banner & brand showcase inclusion',
      'Dedicated partner badge & VIP editorial support',
    ],
  },
];

/**
 * Returns the active revenue tier based on monthly clicks count
 */
export function getRevenueTier(monthlyClicks: number): RevenueTier {
  if (monthlyClicks > 100000) {
    return REVENUE_TIERS[3]; // Elite Tier: ₹1,999/mo
  }
  if (monthlyClicks > 50000) {
    return REVENUE_TIERS[2]; // Pro Tier: ₹999/mo
  }
  if (monthlyClicks >= 10000) {
    return REVENUE_TIERS[1]; // Growth Tier: ₹499/mo
  }
  return REVENUE_TIERS[0]; // Free Tier: ₹0
}

/**
 * Returns current month key in format YYYY-MM (e.g., "2026-09")
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format a YYYY-MM key into human-readable month name (e.g., "September 2026")
 */
export function formatMonthName(monthKey: string, short: boolean = false): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const year = parseInt(yearStr, 10);
  const date = new Date(year, monthIdx, 1);
  return date.toLocaleDateString('en-US', {
    month: short ? 'short' : 'long',
    year: 'numeric',
  });
}

/**
 * Get the last 12 months for selector
 */
export function getAvailableMonthKeys(): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    list.push(`${y}-${m}`);
  }
  return list;
}

/**
 * Calculates authentic clicks in a specific month for a creator's products
 * derived strictly from individual telemetry ClickRecord entries.
 */
export function getMonthlyClicksForUser(
  myProducts: Product[],
  clickRecords: ClickRecord[],
  monthKey: string,
  user?: UserProfile | null
): number {
  if (user?.simulatedClicks !== undefined && user.simulatedClicks !== null && user.simulatedClicks > 0) {
    return user.simulatedClicks;
  }
  const myProductIds = new Set(myProducts.map((p) => p.id));
  return clickRecords.filter(
    (c) => myProductIds.has(c.productId) && (c.timestamp || '').startsWith(monthKey)
  ).length;
}

/**
 * Check if the user has paid the platform fee for a given month
 */
export function isPlatformFeePaidForMonth(
  user: UserProfile | null | undefined,
  monthKey: string = getCurrentMonthKey()
): boolean {
  if (!user) return false;
  // Super admin / Owner is exempt from fee
  if (
    user.role === 'admin' ||
    user.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' ||
    user.email?.toLowerCase().trim() === 'shivanandkabbur24@gmail.com'
  ) {
    return true;
  }
  if (!user.platformFeePaidMonths || !Array.isArray(user.platformFeePaidMonths)) {
    return false;
  }
  return user.platformFeePaidMonths.includes(monthKey);
}

/**
 * Mark a month's platform fee as paid and persist to store
 */
export function markPlatformFeePaid(
  user: UserProfile,
  monthKey: string = getCurrentMonthKey()
): UserProfile {
  const currentPaid = Array.isArray(user.platformFeePaidMonths)
    ? [...user.platformFeePaidMonths]
    : [];
  if (!currentPaid.includes(monthKey)) {
    currentPaid.push(monthKey);
  }
  const updatedUser: UserProfile = {
    ...user,
    platformFeePaidMonths: currentPaid,
  };

  db.saveUserProfile(updatedUser);
  db.setCurrentUser(updatedUser);
  return updatedUser;
}

/**
 * Update simulated clicks for testing revenue tier limits
 */
export function setSimulatedClicks(user: UserProfile, count: number | null): UserProfile {
  const updatedUser: UserProfile = {
    ...user,
    simulatedClicks: count,
  };
  db.saveUserProfile(updatedUser);
  db.setCurrentUser(updatedUser);
  return updatedUser;
}
