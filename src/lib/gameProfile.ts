/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from '../types';
import { getEffectiveDiscount } from './discountUtils';

export type DealTierId = 'tier1' | 'tier2' | 'tier3' | 'standard';

export interface DealTierInfo {
  id: DealTierId;
  name: string;
  badge: string;
  shortLabel: string;
  colorClass: string;
  bgGradient: string;
  description: string;
  minTimeSeconds: number;
  maxTimeSeconds: number;
}

export const DEAL_TIERS: Record<DealTierId, DealTierInfo> = {
  tier1: {
    id: 'tier1',
    name: 'Apex Deal Tier',
    badge: '🏆 Tier 1: Apex Deal Hunter',
    shortLabel: 'Apex Tier',
    colorClass: 'text-amber-400 border-amber-400 bg-amber-500/10',
    bgGradient: 'from-amber-500/20 via-orange-500/20 to-rose-500/20',
    description: 'Caught in under 3.5s! Unlocked Top-Priority Deals with Maximum Verified Discounts.',
    minTimeSeconds: 0,
    maxTimeSeconds: 3.5,
  },
  tier2: {
    id: 'tier2',
    name: 'Gold Deal Tier',
    badge: '⚡ Tier 2: Gold Deal Hunter',
    shortLabel: 'Gold Tier',
    colorClass: 'text-orange-400 border-orange-400 bg-orange-500/10',
    bgGradient: 'from-orange-500/20 via-amber-500/15 to-neutral-900/40',
    description: 'Caught in 3.5s – 6.5s! High-priority deals with strong verified savings unlocked.',
    minTimeSeconds: 3.5,
    maxTimeSeconds: 6.5,
  },
  tier3: {
    id: 'tier3',
    name: 'Silver Deal Tier',
    badge: '✨ Tier 3: Silver Deal Hunter',
    shortLabel: 'Silver Tier',
    colorClass: 'text-sky-400 border-sky-400 bg-sky-500/10',
    bgGradient: 'from-sky-500/20 via-blue-500/15 to-neutral-900/40',
    description: 'Caught in 6.5s – 10.0s! Curated matching deals unlocked.',
    minTimeSeconds: 6.5,
    maxTimeSeconds: 10.0,
  },
  standard: {
    id: 'standard',
    name: 'Standard Deals',
    badge: '🎯 Standard Deals Mode',
    shortLabel: 'Standard Deals',
    colorClass: 'text-neutral-400 border-neutral-600 bg-neutral-800/40',
    bgGradient: 'from-neutral-800/40 to-neutral-900/60',
    description: 'Standard verified deals for your search.',
    minTimeSeconds: 10.0,
    maxTimeSeconds: Infinity,
  },
};

export interface DealOrbProfile {
  gamesPlayed: number;
  totalCatches: number;
  bestCatchTimeMs: number | null;
  lastCatchTimeMs: number | null;
  consecutiveVisits: number;
  // Bounded difficulty modifier: 0.70x (easiest) to 1.25x (hardest)
  // Over repeat visits, it gradually trends lower (easier) for loyal shoppers
  difficultyModifier: number;
  unlockedTier: DealTierId | null;
  lastPlayedAt: string | null;
}

const STORAGE_KEY = 'pickasap_orb_game_profile_v1';

// Bounded difficulty constraints
export const MIN_DIFFICULTY = 0.70; // 30% slower / easier for seasoned returning shoppers
export const MAX_DIFFICULTY = 1.25; // Base starting challenge
export const DEFAULT_DIFFICULTY = 1.0;

export const MIN_ORB_RADIUS = 28; // px
export const MAX_ORB_RADIUS = 46; // px

/**
 * Load local game profile for guest or cached session
 */
export const getLocalGameProfile = (): DealOrbProfile => {
  if (typeof window === 'undefined') {
    return {
      gamesPlayed: 0,
      totalCatches: 0,
      bestCatchTimeMs: null,
      lastCatchTimeMs: null,
      consecutiveVisits: 1,
      difficultyModifier: DEFAULT_DIFFICULTY,
      unlockedTier: null,
      lastPlayedAt: null,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        gamesPlayed: Number(parsed.gamesPlayed) || 0,
        totalCatches: Number(parsed.totalCatches) || 0,
        bestCatchTimeMs: parsed.bestCatchTimeMs ? Number(parsed.bestCatchTimeMs) : null,
        lastCatchTimeMs: parsed.lastCatchTimeMs ? Number(parsed.lastCatchTimeMs) : null,
        consecutiveVisits: Number(parsed.consecutiveVisits) || 1,
        difficultyModifier: Math.min(
          MAX_DIFFICULTY,
          Math.max(MIN_DIFFICULTY, Number(parsed.difficultyModifier) || DEFAULT_DIFFICULTY)
        ),
        unlockedTier: parsed.unlockedTier || null,
        lastPlayedAt: parsed.lastPlayedAt || null,
      };
    }
  } catch {
    // Fall back to default
  }

  return {
    gamesPlayed: 0,
    totalCatches: 0,
    bestCatchTimeMs: null,
    lastCatchTimeMs: null,
    consecutiveVisits: 1,
    difficultyModifier: DEFAULT_DIFFICULTY,
    unlockedTier: null,
    lastPlayedAt: null,
  };
};

/**
 * Save game profile to localStorage and dispatch update
 */
export const saveGameProfile = (profile: DealOrbProfile): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('pickasap:game_profile_updated', { detail: profile }));
  } catch {
    // ignore storage exceptions
  }
};

/**
 * Determine reward tier based on accurate elapsed time in seconds
 */
export const determineRewardTier = (elapsedSeconds: number): DealTierId => {
  if (elapsedSeconds <= 0) return 'standard';
  if (elapsedSeconds < 3.5) return 'tier1';
  if (elapsedSeconds < 6.5) return 'tier2';
  if (elapsedSeconds <= 10.0) return 'tier3';
  return 'standard';
};

/**
 * Calculate bounded parameters based on difficulty modifier
 */
export const getGamePhysicsParams = (difficultyModifier: number, isReducedMotion: boolean = false) => {
  // Clamped difficulty
  const clampedMod = Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, difficultyModifier));

  // Base speed (pixels per frame at 60fps): between 2.2px (easier) and 4.2px (harder)
  const baseSpeed = isReducedMotion ? 1.6 : 2.2 + (clampedMod - MIN_DIFFICULTY) * 3.5;

  // Orb radius (hitbox): between 46px (easier) and 28px (harder)
  const orbRadius = isReducedMotion
    ? 44
    : Math.round(MAX_ORB_RADIUS - ((clampedMod - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY)) * (MAX_ORB_RADIUS - MIN_ORB_RADIUS));

  return {
    baseSpeed,
    orbRadius,
    clampedMod,
  };
};

/**
 * Record completed round: updates visits, difficulty progression, and statistics
 */
export const recordGameRound = (
  isCatch: boolean,
  elapsedMs: number | null
): { profile: DealOrbProfile; tier: DealTierId } => {
  const current = getLocalGameProfile();

  const gamesPlayed = current.gamesPlayed + 1;
  const totalCatches = isCatch ? current.totalCatches + 1 : current.totalCatches;

  let bestCatchTimeMs = current.bestCatchTimeMs;
  let lastCatchTimeMs = current.lastCatchTimeMs;
  let tier: DealTierId = 'standard';

  if (isCatch && typeof elapsedMs === 'number' && elapsedMs > 0 && elapsedMs <= 10000) {
    lastCatchTimeMs = elapsedMs;
    if (bestCatchTimeMs === null || elapsedMs < bestCatchTimeMs) {
      bestCatchTimeMs = elapsedMs;
    }
    tier = determineRewardTier(elapsedMs / 1000);
  }

  // Returning-shopper bounded difficulty adjustment:
  // Over repeat visits, each game gradually adapts downward (easier) by 0.04 up to MIN_DIFFICULTY
  let newDifficulty = current.difficultyModifier;
  if (isCatch) {
    // If successfully caught fast, slight stabilization; if slow/struggled, ease down
    if (elapsedMs && elapsedMs > 6000) {
      newDifficulty = Math.max(MIN_DIFFICULTY, newDifficulty - 0.05);
    } else {
      newDifficulty = Math.max(MIN_DIFFICULTY, newDifficulty - 0.02);
    }
  } else {
    // Failed catch or timeout: make it easier on next visit
    newDifficulty = Math.max(MIN_DIFFICULTY, newDifficulty - 0.07);
  }

  const updatedProfile: DealOrbProfile = {
    gamesPlayed,
    totalCatches,
    bestCatchTimeMs,
    lastCatchTimeMs,
    consecutiveVisits: current.consecutiveVisits + 1,
    difficultyModifier: Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, newDifficulty)),
    unlockedTier: tier,
    lastPlayedAt: new Date().toISOString(),
  };

  saveGameProfile(updatedProfile);
  return { profile: updatedProfile, tier };
};

/**
 * Rank products according to the unlocked tier while strictly preserving search relevance.
 * Does not fabricate discounts or alter prices.
 * If higher tier has limited matching products, gracefully includes best matching deals.
 */
export const rankProductsByTier = (
  products: Product[],
  tier: DealTierId | null,
  searchQuery: string = ''
): Product[] => {
  if (!products || products.length === 0) return [];

  // Filter by search query if provided
  let matching = products;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    matching = products.filter((p) => {
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchCategory = p.category.toLowerCase().includes(q);
      const matchStore = p.store.toLowerCase().includes(q);
      const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCategory || matchStore || matchTags;
    });
  }

  // If no match found for search query, fall back to all products with query score
  if (matching.length === 0) {
    matching = products;
  }

  const sorted = [...matching];

  if (tier === 'tier1') {
    // Apex Hunter: Rank products strictly by highest verified discount and verified deal status
    return sorted.sort((a, b) => {
      const discA = getEffectiveDiscount(a);
      const discB = getEffectiveDiscount(b);
      if (discB !== discA) return discB - discA;
      const clicksA = a.clicksCount || 0;
      const clicksB = b.clicksCount || 0;
      return clicksB - clicksA;
    });
  }

  if (tier === 'tier2') {
    // Gold Hunter: Rank by balanced discount and popularity
    return sorted.sort((a, b) => {
      const scoreA = getEffectiveDiscount(a) * 1.5 + (a.clicksCount || 0);
      const scoreB = getEffectiveDiscount(b) * 1.5 + (b.clicksCount || 0);
      return scoreB - scoreA;
    });
  }

  if (tier === 'tier3') {
    // Silver Hunter: Popularity and active deals
    return sorted.sort((a, b) => {
      const clicksA = a.clicksCount || 0;
      const clicksB = b.clicksCount || 0;
      if (clicksB !== clicksA) return clicksB - clicksA;
      return getEffectiveDiscount(b) - getEffectiveDiscount(a);
    });
  }

  // Standard: default balanced catalog ordering
  return sorted;
};
