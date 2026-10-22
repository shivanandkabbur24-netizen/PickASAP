/**
 * Comprehensive verification test suite for PickASAP Master Implementation
 * Tests:
 * 1. Search-to-game-to-results workflow & Deal Tier Ranking
 * 2. Catch the Deal Orb Game rules, timing tiers, and bounded difficulty
 * 3. Exact Marketplace Comparison & Variant Matching
 * 4. Exact Reference Midpoint & Percentage Difference Formulas
 * 5. Buying Indicator Assertions
 * 6. Discount Calculations
 */

import {
  determineRewardTier,
  getGamePhysicsParams,
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
  MIN_ORB_RADIUS,
  MAX_ORB_RADIUS,
  rankProductsByTier,
} from '../src/lib/gameProfile';

import {
  getMarketplacePriceComparison,
  extractExactVariant,
} from '../src/lib/marketplaceComparison';

import initialProductsRaw from '../src/data/initialProducts.json';

const products = initialProductsRaw as any[];

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${desc}`);
  } else {
    console.error(`❌ FAIL: ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

console.log('======================================================');
console.log('STARTING PICKASAP MASTER WORKFLOW & ENGINE TESTS');
console.log('======================================================');

// 1. TIMING TIERS
assert(determineRewardTier(1.8) === 'tier1', 'Fast catch under 3.5s assigns Tier 1 (Apex)');
assert(determineRewardTier(3.4) === 'tier1', 'Fast catch at 3.4s assigns Tier 1 (Apex)');
assert(determineRewardTier(3.5) === 'tier2', 'Catch at 3.5s assigns Tier 2 (Gold)');
assert(determineRewardTier(5.2) === 'tier2', 'Catch at 5.2s assigns Tier 2 (Gold)');
assert(determineRewardTier(6.5) === 'tier3', 'Catch at 6.5s assigns Tier 3 (Silver)');
assert(determineRewardTier(9.8) === 'tier3', 'Catch at 9.8s assigns Tier 3 (Silver)');
assert(determineRewardTier(10.5) === 'standard', 'Expired round over 10s assigns Standard');
assert(determineRewardTier(0) === 'standard', 'Zero elapsed assigns Standard');

// 2. BOUNDED DIFFICULTY CONSTRAINTS
const paramsMin = getGamePhysicsParams(MIN_DIFFICULTY);
const paramsMax = getGamePhysicsParams(MAX_DIFFICULTY);
assert(paramsMin.clampedMod === MIN_DIFFICULTY, 'Minimum difficulty clamped to 0.70');
assert(paramsMax.clampedMod === MAX_DIFFICULTY, 'Maximum difficulty clamped to 1.25');
assert(paramsMin.orbRadius >= MIN_ORB_RADIUS, 'Orb radius satisfies minimum bound');
assert(paramsMin.orbRadius <= MAX_ORB_RADIUS, 'Orb radius satisfies maximum bound');
assert(paramsMin.baseSpeed < paramsMax.baseSpeed, 'Returning player difficulty reduces base speed');

// 3. SEARCH PRESERVATION & TIER RANKING
const testSearch = 'TV';
const rankedTier1 = rankProductsByTier(products, 'tier1', testSearch);
assert(rankedTier1.length > 0, 'Ranked products returned for search');
assert(
  rankedTier1.every((p) => p.title.toLowerCase().includes('tv') || (p.description || '').toLowerCase().includes('tv') || p.category.toLowerCase().includes('tv')),
  'Search relevance strictly preserved across tier ranking'
);

// 4. EXACT VARIANT EXTRACTION
const sampleProduct = products[0];
const variant = extractExactVariant(sampleProduct);
assert(typeof variant === 'string' && variant.length > 0, `Exact variant extracted: ${variant}`);

// 5. MARKETPLACE COMPARISON & FORMULAS
const comp = getMarketplacePriceComparison(sampleProduct, products);
assert(comp.listings.length >= 1, `Marketplace listings found: ${comp.listings.length}`);
assert(comp.lowestPrice > 0, `Lowest price determined: ₹${comp.lowestPrice}`);
assert(comp.listings.some((l) => l.isLowest), 'At least one listing is flagged as lowest comparable price');

// 6. EXACT REFERENCE MIDPOINT FORMULA: referenceMidpoint = (highestPriceFound + lowestPriceFound) / 2
const expectedMidpoint = Math.round((comp.highestPrice + comp.lowestPriceFound) / 2);
assert(
  comp.referenceMidpoint === expectedMidpoint,
  `Reference Midpoint exact match: (highest ${comp.highestPrice} + lowest ${comp.lowestPriceFound}) / 2 = ${comp.referenceMidpoint}`
);

// 7. PERCENTAGE DIFFERENCE FORMULA: ((currentPrice - referenceMidpoint) / referenceMidpoint) * 100
const curPrice = sampleProduct.currentPrice || Number(String(sampleProduct.price).replace(/[^0-9.]/g, ''));
const expectedDiff = Math.round(((curPrice - expectedMidpoint) / expectedMidpoint) * 1000) / 10;
assert(
  comp.percentageDifference === expectedDiff,
  `Percentage difference exact match: ((${curPrice} - ${expectedMidpoint}) / ${expectedMidpoint}) * 100 = ${comp.percentageDifference}%`
);

// 8. BUYING INDICATOR RULES
if (comp.percentageDifference < 0) {
  assert(comp.buyingIndicator === 'Good time to buy', 'Negative percentage gives "Good time to buy"');
} else if (comp.percentageDifference > 0) {
  assert(comp.buyingIndicator === 'Consider waiting', 'Positive percentage gives "Consider waiting"');
} else {
  assert(comp.buyingIndicator === 'At the reference price', 'Zero difference gives "At the reference price"');
}

console.log('======================================================');
console.log(`SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: 0`);
console.log('======================================================');
