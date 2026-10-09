import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Razorpay from 'razorpay';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { initializeApp as initFirebaseApp, getApps } from 'firebase/app';
import {
  initializeFirestore as initServerFirestore,
  collection as serverCollection,
  getDocs as serverGetDocs,
  doc as serverDoc,
  setDoc as serverSetDoc,
  updateDoc as serverUpdateDoc,
} from 'firebase/firestore';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize server-side Firestore connection for background batch research
let serverDb: any = null;
try {
  const firebaseConfigRaw = fs.readFileSync(path.resolve('./firebase-applet-config.json'), 'utf8');
  const firebaseConfig = JSON.parse(firebaseConfigRaw);
  const existingApps = getApps();
  const serverFirebaseApp = existingApps.length > 0 
    ? existingApps[0] 
    : initFirebaseApp(firebaseConfig, 'server-pickasap');
  serverDb = initServerFirestore(serverFirebaseApp, {}, firebaseConfig.firestoreDatabaseId);
  console.log('[BatchEngine] Firestore connected for server batch research.');
} catch (err: any) {
  console.warn('[BatchEngine] Firestore initialization notice:', err?.message || err);
}

// Lazy initialization of Gemini GenAI client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Helper: Safely resolve redirect for short links like dl.flipkart.com/s/... or amzn.to/...
async function resolveRedirectUrl(inputUrl: string): Promise<{ resolvedUrl: string; detectedTitle?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(inputUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    const finalUrl = res.url || inputUrl;
    let detectedTitle: string | undefined;

    // Try to extract title from URL path or basic HTML if available
    try {
      const parsed = new URL(finalUrl);
      const pathname = parsed.pathname;
      // Many flipkart urls are /product-slug-name/p/itm...
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 0 && segments[0] !== 's' && segments[0] !== 'dl') {
        const slug = decodeURIComponent(segments[0]).replace(/-/g, ' ');
        if (slug.length > 3 && !slug.includes('.html')) {
          detectedTitle = slug;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    return { resolvedUrl: finalUrl, detectedTitle };
  } catch {
    // If request times out or fails, return original inputUrl
    return { resolvedUrl: inputUrl };
  }
}

// In-memory per-product cache for Gemini price intelligence to preserve quota and ensure product independence
const priceHistoryCacheByProductId = new Map<string, any>();

function extractJson(text: string): any {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const sub = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(sub);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Helper: Parse numeric price from text
function parsePrice(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return Math.round(val);
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

function formatINR(val: number): string {
  if (!val) return '₹0';
  return '₹' + val.toLocaleString('en-IN');
}

// Genuine Product-Specific Price Intelligence Research Engine using Gemini + Google Search Grounding
async function fetchPriceIntelligenceFromGemini(params: {
  productId: string;
  title: string;
  brand?: string;
  modelIdentifier?: string;
  asin?: string;
  resolvedUrl?: string;
  effectiveUrl?: string;
  store?: string;
  currentPriceNum: number;
  category?: string;
  description?: string;
}): Promise<any | null> {
  const {
    productId,
    title,
    brand,
    modelIdentifier,
    asin,
    resolvedUrl,
    effectiveUrl,
    store,
    currentPriceNum,
    category,
    description,
  } = params;

  // Each product has its OWN independent cache keyed strictly by productId
  if (priceHistoryCacheByProductId.has(productId)) {
    return priceHistoryCacheByProductId.get(productId);
  }

  let ai: GoogleGenAI;
  try {
    ai = getGemini();
  } catch (err) {
    console.warn('Gemini client initialization notice:', err);
    return null;
  }

  const todayIso = new Date().toISOString();
  const todayDate = todayIso.split('T')[0];

  const searchKeywords = [
    `${title} price history India`,
    `${title} ${modelIdentifier || asin || ''} historical price deal tracker Amazon India Flipkart`,
    `${title} lowest price deal India`,
  ].filter(Boolean);

  const systemInstruction = `You are a strict, verified e-commerce price history research intelligence engine for an online curated shopping platform.
You have the Google Search tool enabled. You MUST use Google Search to find real, verifiable historical price data.

CRITICAL GROUNDING & VERIFICATION REQUIREMENTS:
1. USE GOOGLE SEARCH: You MUST perform search queries to find real web sources.
2. ZERO HALLUCINATION: NEVER invent, estimate, interpolate, or extrapolate historical prices from model memory.
3. REAL RETRIEVED SOURCES ONLY: Every historical price observation you report MUST come directly from an actual web source retrieved during this search session.
4. CURRENT LISTING ≠ HISTORICAL EVIDENCE: A current product listing showing today's price (${currentPriceNum} INR) is NOT evidence of a past historical price. Do NOT claim today's price was the price months or years ago.
5. STRICT PRODUCT MATCHING: Ensure the retrieved price refers to this EXACT product (${title}), matching storage, RAM, variant, model number (${modelIdentifier || 'standard'}), and region (India). Do NOT use prices from a different variant, different storage capacity, or different product generation.
6. SOURCE CITATION: For every observation, you MUST include the exact source URL retrieved from Google Search, the name of the source (e.g. PriceBefore, Smartprix, Buyhatke, 91mobiles, retailer sale archive), and quote/describe the specific historical evidence in "evidence".
7. IF NO RELIABLE HISTORICAL EVIDENCE EXISTS: You MUST set "isHistoricalDataAvailable": false and "priceHistory": []. Do not generate synthetic points to make a complete graph. Real data > complete graph.
8. RETURN STRUCTURED JSON adhering to the specified format.`;

  const prompt = `Perform Google Search research for the historical price records of this exact product:

PRODUCT IDENTITY:
- Product ID: "${productId}"
- Exact Title: "${title}"
- Brand: "${brand || ''}"
- Model Identifier: "${modelIdentifier || ''}"
- ASIN / SKU: "${asin || ''}"
- Store / Marketplace: "${store || 'Online'}"
- Product URL: "${resolvedUrl || effectiveUrl || ''}"
- Current Active Price: ${currentPriceNum} INR
- Category: "${category || ''}"
- Description: "${(description || '').slice(0, 300)}"
- Today's Date: "${todayDate}"

SEARCH TARGETS:
Search the web for historical price tracking, price drops, past sales (e.g. Diwali, Big Billion Days, Great Indian Festival, Summer Sale), or launch pricing for this exact product:
- ${searchKeywords.join('\n- ')}

REQUIRED JSON RESPONSE FORMAT:
{
  "productId": "${productId}",
  "productName": "${title.replace(/"/g, '\\"')}",
  "currentPrice": ${currentPriceNum},
  "isHistoricalDataAvailable": boolean,
  "uncertaintyNote": string or null,
  "summaryNote": string,
  "priceHistory": [
    {
      "date": "YYYY-MM-DD",
      "price": number,
      "source": "string (name of retrieved source)",
      "sourceUrl": "string (exact URL retrieved via Google Search)",
      "evidence": "string (specific evidence found on that page)",
      "note": "string (historical observation note)"
    }
  ]
}`;

  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let quotaExceededError = false;

  for (const model of models) {
    try {
      console.log(`[PriceIntelligence] Invoking Google Search grounding on ${model} for "${title}"`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          // REAL GOOGLE SEARCH GROUNDING TOOL ENABLED
          tools: [{ googleSearch: {} }],
        },
      });

      // 1. Inspect Grounding Metadata
      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const searchQueries: string[] = (groundingMetadata as any)?.webSearchQueries || [];
      const groundingChunks: any[] = (groundingMetadata as any)?.groundingChunks || [];

      // Extract verified web sources and build URL & Domain whitelists
      const retrievedWebSources: Array<{ title: string; url: string }> = [];
      const verifiedUrlSet = new Set<string>();
      const verifiedDomainSet = new Set<string>();

      for (const chunk of groundingChunks) {
        const uri = chunk.web?.uri;
        const chunkTitle = chunk.web?.title || '';
        if (uri) {
          retrievedWebSources.push({ title: chunkTitle, url: uri });
          verifiedUrlSet.add(uri.toLowerCase());
          try {
            const u = new URL(uri);
            verifiedDomainSet.add(u.hostname.toLowerCase().replace(/^www\./, ''));
          } catch {}
        }
      }

      console.log(`[PriceIntelligence] Grounding returned ${searchQueries.length} search queries and ${groundingChunks.length} retrieved web chunks.`);

      const text = response.text;
      if (text) {
        const parsed = extractJson(text);
        if (parsed && typeof parsed === 'object') {
          parsed.productId = productId;
          if (!parsed.productName) parsed.productName = title;
          if (!parsed.currentPrice) parsed.currentPrice = currentPriceNum;

          const rawPoints = Array.isArray(parsed.priceHistory) ? parsed.priceHistory : [];

          // STRICT GROUNDING VALIDATION:
          // An observation is accepted ONLY if its sourceUrl comes from an actual grounding chunk
          // or is grounded in a verified domain retrieved by Google Search!
          const verifiedPoints = rawPoints.filter((p: any) => {
            const price = parsePrice(p.price);
            if (price <= 0 || !p.date) return false;

            const url = (p.sourceUrl || '').trim().toLowerCase();
            if (!url) return false;

            // Check if URL matches a retrieved grounding chunk URI
            const hasExactUrl = verifiedUrlSet.has(url);
            let hasMatchingDomain = false;
            try {
              const u = new URL(url);
              const host = u.hostname.toLowerCase().replace(/^www\./, '');
              hasMatchingDomain = verifiedDomainSet.has(host);
            } catch {}

            const isGrounded = hasExactUrl || hasMatchingDomain;
            if (!isGrounded) {
              console.warn(`[PriceIntelligence] REJECTED ungrounded source claim: "${p.source}" (${p.sourceUrl}) - not found in Google Search grounding chunks.`);
              return false;
            }

            // Do not accept a current listing page that merely states current price as evidence of historical price
            if (p.date === todayDate && price === currentPriceNum && !p.evidence) {
              return false;
            }

            return true;
          });

          const isHistoricalDataAvailable = Boolean(parsed.isHistoricalDataAvailable) && verifiedPoints.length >= 2;

          const auditData = {
            productId,
            productName: parsed.productName,
            currentPrice: currentPriceNum,
            isHistoricalDataAvailable,
            uncertaintyNote: isHistoricalDataAvailable
              ? null
              : parsed.uncertaintyNote || 'Insufficient verified historical pricing records found via Google Search grounding.',
            summaryNote: parsed.summaryNote || (isHistoricalDataAvailable ? 'Verified from Google Search grounding.' : 'Historical data unavailable.'),
            priceHistory: isHistoricalDataAvailable ? verifiedPoints : [],
            grounding: {
              searchInvoked: true,
              searchQueries,
              sources: retrievedWebSources,
              groundingChunksCount: groundingChunks.length,
              verifiedObservationsCount: verifiedPoints.length,
              status: isHistoricalDataAvailable ? 'grounded_and_verified' : 'no_historical_evidence_found',
              quotaNotice: null,
            },
          };

          priceHistoryCacheByProductId.set(productId, auditData);
          return auditData;
        }
      }
    } catch (err: any) {
      const status = err?.status || (err?.message?.includes('429') ? 429 : null);
      const isQuota = status === 429 || String(err?.message || '').includes('quota') || String(err?.message || '').includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        quotaExceededError = true;
        // Log friendly informational notice instead of noisy unhandled error
        console.info(`[PriceIntelligence] Google Search grounding quota limit reached on ${model} (429 RESOURCE_EXHAUSTED).`);
        break; // Quota is per-project across all models; no need to repeatedly spam 429 errors
      } else {
        console.warn(`[PriceIntelligence] Google Search grounding attempt notice with ${model}:`, err?.status || err?.message || err);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  // If Google Search grounding hit quota limit (429 / RESOURCE_EXHAUSTED):
  if (quotaExceededError) {
    const quotaAudit = {
      productId,
      productName: title,
      currentPrice: currentPriceNum,
      isHistoricalDataAvailable: false,
      quotaExceeded: true,
      uncertaintyNote: 'Google Search grounding daily quota limit reached (429). Pausing until tomorrow for remaining products.',
      summaryNote: 'Daily Google Search quota limit reached. Paused until next daily cycle.',
      priceHistory: [],
      grounding: {
        searchInvoked: true,
        searchQueries: [],
        sources: [],
        groundingChunksCount: 0,
        verifiedObservationsCount: 0,
        status: 'search_quota_exceeded',
        quotaNotice: 'Google Search grounding quota limit reached for today.',
      },
    };
    return quotaAudit;
  }

  // If search didn't hit quota but simply found no records
  const emptyAudit = {
    productId,
    productName: title,
    currentPrice: currentPriceNum,
    isHistoricalDataAvailable: false,
    uncertaintyNote: 'Google Search did not retrieve verifiable historical price evidence for this specific product.',
    summaryNote: 'Historical price tracking is active. Historical records require verified Google Search grounding evidence.',
    priceHistory: [],
    grounding: {
      searchInvoked: true,
      searchQueries: [],
      sources: [],
      groundingChunksCount: 0,
      verifiedObservationsCount: 0,
      status: 'no_historical_evidence_found',
      quotaNotice: null,
    },
  };
  priceHistoryCacheByProductId.set(productId, emptyAudit);
  return emptyAudit;
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint: URL redirect resolver
app.post('/api/price-history/resolve-url', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  const result = await resolveRedirectUrl(url);
  return res.json(result);
});

// Endpoint: Background Gemini Price History Intelligence Engine
app.post('/api/price-history/fetch', async (req, res) => {
  const { productId, url, title, brand, modelIdentifier, asin, store, currentPrice, category, description } = req.body;

  const currentPriceNum = parsePrice(currentPrice);
  const effectiveTitle = (title || '').trim() || 'Curated Product';
  const effectiveUrl = (url || '').trim();
  const effectiveProductId = (productId || '').trim() || `prod_${Date.now()}`;

  // 1. Resolve short link if applicable (with fast 1.5s timeout)
  let resolvedUrl = effectiveUrl;
  let detectedTitleFromUrl: string | undefined;

  if (effectiveUrl.startsWith('http://') || effectiveUrl.startsWith('https://')) {
    try {
      const resolution = await resolveRedirectUrl(effectiveUrl);
      resolvedUrl = resolution.resolvedUrl;
      detectedTitleFromUrl = resolution.detectedTitle;
    } catch {
      // Ignore resolution failure
    }
  }

  const querySubject = effectiveTitle || detectedTitleFromUrl || 'Curated Product';

  // 2. Fetch independent product-specific price intelligence from Gemini
  try {
    const parsedData = await fetchPriceIntelligenceFromGemini({
      productId: effectiveProductId,
      title: querySubject,
      brand,
      modelIdentifier,
      asin,
      resolvedUrl,
      effectiveUrl,
      store,
      currentPriceNum,
      category,
      description,
    });

    if (parsedData) {
      const isAvailable = Boolean(parsedData.isHistoricalDataAvailable);
      const rawPoints = Array.isArray(parsedData.priceHistory) ? parsedData.priceHistory : [];
      const routeToday = new Date().toISOString().split('T')[0];
      let validPoints = isAvailable
        ? rawPoints
            .map((p: any) => ({
              date: p.date || routeToday,
              price: parsePrice(p.price),
              source: p.source || (p.note ? 'Verified Archive' : 'Listing'),
              sourceUrl: p.sourceUrl || null,
              note: p.note || 'Verified historical observation',
            }))
            .filter((p: any) => p.price > 0 && p.source)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        : [];

      // Ensure the dataset reaches till today's date!
      if (isAvailable && validPoints.length > 0 && currentPriceNum > 0) {
        const lastPoint = validPoints[validPoints.length - 1];
        if (lastPoint.date !== routeToday) {
          validPoints.push({
            date: routeToday,
            price: currentPriceNum,
            source: store || 'Active Store Listing',
            sourceUrl: effectiveUrl || null,
            note: 'Current listed price as of today',
          });
        }
      }

      if (isAvailable && validPoints.length >= 2) {
        const prices = validPoints.map((p: any) => p.price);
        const low = Math.min(...prices);
        const high = Math.max(...prices);
        const avg = Math.round(prices.reduce((sum: number, val: number) => sum + val, 0) / prices.length);
        const cur = validPoints[validPoints.length - 1].price || currentPriceNum;

        const milestones = validPoints.map((p: any) => ({
          date: p.date,
          price: p.price,
          formattedPrice: formatINR(p.price),
          source: p.source,
          sourceUrl: p.sourceUrl,
          evidence: p.evidence,
          note: p.note,
          dropPercentage: high > p.price ? `${Math.round(((high - p.price) / high) * 100)}% drop` : undefined,
          isLowest: p.price === low,
          isHighest: p.price === high,
        }));

        const normalized = {
          productId: effectiveProductId,
          productName: parsedData.productName || querySubject,
          productTitle: parsedData.productName || querySubject,
          resolvedUrl,
          currentPrice: cur,
          formattedCurrentPrice: formatINR(cur),
          lowestPrice: low,
          formattedLowestPrice: formatINR(low),
          highestPrice: high,
          formattedHighestPrice: formatINR(high),
          averagePrice: avg,
          formattedAveragePrice: formatINR(avg),
          currency: '₹',
          isHistoricalDataAvailable: true,
          uncertaintyNote: null,
          summaryNote: parsedData.summaryNote || `Verified price trajectory from ${formatINR(low)} to ${formatINR(high)}.`,
          grounding: parsedData.grounding || null,
          priceHistory: validPoints,
          milestones,
        };

        return res.json({
          success: true,
          source: 'gemini_intelligence',
          data: normalized,
        });
      } else {
        // Historical data unavailable or unverified
        return res.json({
          success: true,
          source: 'gemini_intelligence',
          data: {
            productId: effectiveProductId,
            productName: parsedData.productName || querySubject,
            productTitle: parsedData.productName || querySubject,
            resolvedUrl,
            currentPrice: currentPriceNum,
            formattedCurrentPrice: formatINR(currentPriceNum),
            lowestPrice: currentPriceNum,
            formattedLowestPrice: formatINR(currentPriceNum),
            highestPrice: currentPriceNum,
            formattedHighestPrice: formatINR(currentPriceNum),
            averagePrice: currentPriceNum,
            formattedAveragePrice: formatINR(currentPriceNum),
            currency: '₹',
            isHistoricalDataAvailable: false,
            uncertaintyNote: parsedData.uncertaintyNote || 'Historical price data unavailable from verified sources for this specific product listing.',
            summaryNote: `Current listing price is ${formatINR(currentPriceNum)}. Historical price tracking is active.`,
            grounding: parsedData.grounding || null,
            priceHistory: [],
            milestones: [],
          },
        });
      }
    }
  } catch (apiErr) {
    console.warn('Price history fetch exception:', apiErr);
  }

  // Authentic fallback: No fake historical dates, zero fake points
  const fallbackData = {
    productId: effectiveProductId,
    productName: querySubject,
    productTitle: querySubject,
    resolvedUrl,
    currentPrice: currentPriceNum,
    formattedCurrentPrice: formatINR(currentPriceNum),
    lowestPrice: currentPriceNum,
    formattedLowestPrice: formatINR(currentPriceNum),
    highestPrice: currentPriceNum,
    formattedHighestPrice: formatINR(currentPriceNum),
    averagePrice: currentPriceNum,
    formattedAveragePrice: formatINR(currentPriceNum),
    currency: '₹',
    isHistoricalDataAvailable: false,
    uncertaintyNote: 'Historical price data unavailable from verified sources for this specific product listing.',
    summaryNote: `Current listing price is ${formatINR(currentPriceNum)}. Historical price tracking is active.`,
    priceHistory: [],
    milestones: [],
  };

  return res.json({
    success: true,
    source: 'product_baseline',
    data: fallbackData,
  });
});

// -------------------------------------------------------------
// MONTHLY BATCH PRICE INTELLIGENCE RESEARCH ENGINE (QUOTA-AWARE)
// -------------------------------------------------------------

const STATE_DIR = path.resolve('./system_state');
if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}
const BATCH_STATE_FILE = path.join(STATE_DIR, 'batch_price_research_state.json');

interface PriceBatchResearchState {
  currentMonth: string;
  status: 'idle' | 'researching' | 'quota_paused' | 'completed';
  totalProducts: number;
  researchedCount: number;
  pendingCount: number;
  researchedProductIds: string[];
  quotaPausedAt?: string | null;
  resumesAt?: string | null;
  lastRunAt?: string | null;
  currentProductTitle?: string | null;
  message?: string;
}

function loadBatchState(): PriceBatchResearchState {
  const currentMonth = new Date().toISOString().slice(0, 7);
  try {
    if (fs.existsSync(BATCH_STATE_FILE)) {
      const raw = fs.readFileSync(BATCH_STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.currentMonth !== currentMonth) {
          const freshState: PriceBatchResearchState = {
            currentMonth,
            status: 'idle',
            totalProducts: parsed.totalProducts || 0,
            researchedCount: 0,
            pendingCount: parsed.totalProducts || 0,
            researchedProductIds: [],
            quotaPausedAt: null,
            resumesAt: null,
            lastRunAt: null,
            currentProductTitle: null,
            message: `New monthly cycle initialized for ${currentMonth}. Ready for scheduled batch research.`,
          };
          saveBatchState(freshState);
          return freshState;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[BatchEngine] Notice loading batch state, resetting:', err);
  }

  const defaultState: PriceBatchResearchState = {
    currentMonth,
    status: 'idle',
    totalProducts: 0,
    researchedCount: 0,
    pendingCount: 0,
    researchedProductIds: [],
    quotaPausedAt: null,
    resumesAt: null,
    lastRunAt: null,
    currentProductTitle: null,
    message: `Ready for ${currentMonth} monthly batch research.`,
  };
  saveBatchState(defaultState);
  return defaultState;
}

function saveBatchState(state: PriceBatchResearchState): void {
  try {
    fs.writeFileSync(BATCH_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[BatchEngine] Notice saving batch state:', err);
  }
}

function getTomorrowUtcDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 5, 0, 0); // 00:05 UTC next day
  return d.toISOString();
}

async function getBatchStateWithLiveCounts(): Promise<PriceBatchResearchState> {
  const state = loadBatchState();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (state.currentMonth !== currentMonth) {
    state.currentMonth = currentMonth;
    state.researchedProductIds = [];
    state.status = 'idle';
    state.quotaPausedAt = null;
    state.resumesAt = null;
  }

  if (serverDb) {
    try {
      const snap = await serverGetDocs(serverCollection(serverDb, 'products'));
      const prods: any[] = [];
      snap.forEach((d) => prods.push({ id: d.id, ...d.data() }));
      state.totalProducts = prods.length;
      const researchedInFirestore = prods
        .filter((p) => p.lastResearchedMonth === currentMonth)
        .map((p) => p.id);
      const uniqueResearched = Array.from(new Set([...state.researchedProductIds, ...researchedInFirestore]));
      state.researchedProductIds = uniqueResearched;
      state.researchedCount = uniqueResearched.length;
      state.pendingCount = Math.max(0, state.totalProducts - state.researchedCount);
      if (state.pendingCount === 0 && state.totalProducts > 0 && state.status !== 'researching') {
        state.status = 'completed';
        state.message = `All ${state.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`;
      }
      saveBatchState(state);
    } catch {}
  }
  return state;
}

async function runBatchPriceResearch(options: { forceResume?: boolean } = {}): Promise<{
  success: boolean;
  message: string;
  state: PriceBatchResearchState;
}> {
  let state = await getBatchStateWithLiveCounts();
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (state.status === 'researching') {
    return { success: false, message: 'Batch research is already actively running in the background.', state };
  }

  const now = new Date();
  if (state.status === 'quota_paused' && !options.forceResume) {
    if (state.resumesAt && now < new Date(state.resumesAt)) {
      return {
        success: true,
        message: `Quota paused for today on Day 1. Automatic resume scheduled for Day 2 (${state.resumesAt}).`,
        state,
      };
    } else {
      // Day 2 has arrived!
      state.status = 'idle';
      state.quotaPausedAt = null;
      state.resumesAt = null;
      saveBatchState(state);
    }
  }

  // Retrieve products
  let allProducts: any[] = [];
  if (serverDb) {
    try {
      const snap = await serverGetDocs(serverCollection(serverDb, 'products'));
      snap.forEach((d) => allProducts.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[BatchEngine] Firestore read error:', err);
    }
  }

  if (allProducts.length === 0) {
    try {
      const rawInitial = fs.readFileSync(path.resolve('./src/data/initialProducts.json'), 'utf8');
      allProducts = JSON.parse(rawInitial);
    } catch {}
  }

  state.totalProducts = allProducts.length;
  const pendingProducts = allProducts.filter(
    (p) => p.lastResearchedMonth !== currentMonth && !state.researchedProductIds.includes(p.id)
  );

  state.pendingCount = pendingProducts.length;
  state.researchedCount = state.totalProducts - state.pendingCount;

  if (pendingProducts.length === 0) {
    state.status = 'completed';
    state.message = `All ${state.totalProducts} products are already up to date for ${currentMonth}.`;
    saveBatchState(state);
    return { success: true, message: state.message, state };
  }

  state.status = 'researching';
  state.message = `Monthly batch research running for ${pendingProducts.length} pending products (${currentMonth})...`;
  state.lastRunAt = new Date().toISOString();
  saveBatchState(state);

  // Run asynchronous processing loop in background
  (async () => {
    console.log(`[BatchEngine] Starting research loop for ${pendingProducts.length} pending products in ${currentMonth}...`);
    for (let i = 0; i < pendingProducts.length; i++) {
      const prod = pendingProducts[i];
      state.currentProductTitle = prod.title;
      state.message = `Researching product ${i + 1}/${pendingProducts.length}: "${prod.title}"`;
      saveBatchState(state);

      const parsedPrice =
        typeof prod.currentPrice === 'number' && prod.currentPrice > 0
          ? prod.currentPrice
          : parsePrice(prod.price) || 0;

      let result: any = null;
      try {
        result = await fetchPriceIntelligenceFromGemini({
          productId: prod.id,
          title: prod.title,
          brand: prod.brand,
          modelIdentifier: prod.modelIdentifier,
          asin: prod.asin,
          store: prod.store,
          resolvedUrl: prod.affiliateUrl || prod.productUrl,
          effectiveUrl: prod.affiliateUrl || prod.productUrl,
          currentPriceNum: parsedPrice,
          category: prod.category,
          description: prod.description,
        });
      } catch (err: any) {
        console.warn(`[BatchEngine] Error researching product ${prod.id}:`, err?.message || err);
      }

      // Check if Quota Exceeded (429 / RESOURCE_EXHAUSTED)
      if (result?.quotaExceeded || result?.grounding?.status === 'search_quota_exceeded') {
        state.status = 'quota_paused';
        state.quotaPausedAt = new Date().toISOString();
        state.resumesAt = getTomorrowUtcDate();
        state.currentProductTitle = null;
        state.message = `Google Search quota reached for today on Day 1. Paused gracefully. Researched ${state.researchedCount} of ${state.totalProducts} products today. Remaining ${state.pendingCount} products will be researched tomorrow on Day 2. Prior month history is preserved in Firestore.`;
        saveBatchState(state);
        console.info(`[BatchEngine] QUOTA PAUSE: ${state.message}`);
        break; // Stop loop for today!
      }

      // Save snapshots and update Firestore
      if (result && result.isHistoricalDataAvailable && Array.isArray(result.priceHistory) && result.priceHistory.length > 0) {
        const points = result.priceHistory;
        if (serverDb) {
          try {
            for (let pIdx = 0; pIdx < points.length; pIdx++) {
              const p = points[pIdx];
              const snapId = `snap_hist_${prod.id}_${pIdx}_${new Date(p.date).getTime()}`;
              const snapDoc = serverDoc(serverDb, `products/${prod.id}/priceHistory`, snapId);
              await serverSetDoc(snapDoc, {
                id: snapId,
                productId: prod.id,
                price: p.price,
                recordedAt: new Date(p.date).toISOString(),
                source: p.source || 'background_intelligence',
                sourceUrl: p.sourceUrl || '',
                evidence: p.evidence || '',
                note: p.note || 'Recorded verified historical observation',
              });
            }
            const prodRef = serverDoc(serverDb, 'products', prod.id);
            await serverUpdateDoc(prodRef, {
              lastResearchedAt: new Date().toISOString(),
              lastResearchedMonth: currentMonth,
              researchStatus: 'researched',
            });
            console.log(`[BatchEngine] Saved verified snapshots to Firestore for "${prod.title}"`);
          } catch (writeErr: any) {
            console.warn(`[BatchEngine] Firestore write notice for ${prod.id}:`, writeErr?.message || writeErr);
          }
        }
      } else {
        // Researched with search; no additional milestones found; mark as researched this month
        if (serverDb) {
          try {
            const prodRef = serverDoc(serverDb, 'products', prod.id);
            await serverUpdateDoc(prodRef, {
              lastResearchedAt: new Date().toISOString(),
              lastResearchedMonth: currentMonth,
              researchStatus: 'researched',
            });
          } catch {}
        }
      }

      if (!state.researchedProductIds.includes(prod.id)) {
        state.researchedProductIds.push(prod.id);
      }
      state.researchedCount = state.researchedProductIds.length;
      state.pendingCount = Math.max(0, state.totalProducts - state.researchedCount);
      saveBatchState(state);

      // Polite delay between search requests (4.5s) to avoid bursts
      await new Promise((r) => setTimeout(r, 4500));
    }

    if (state.status !== 'quota_paused') {
      state.status = 'completed';
      state.currentProductTitle = null;
      state.message = `All ${state.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`;
      saveBatchState(state);
      console.log(`[BatchEngine] Completed batch research for ${currentMonth}.`);
    }
  })().catch((err) => {
    console.error('[BatchEngine] Background worker error:', err);
    state.status = 'idle';
    saveBatchState(state);
  });

  return { success: true, message: state.message, state };
}

async function researchSingleProduct(productId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  let prod: any = null;
  if (serverDb) {
    try {
      const snap = await serverGetDocs(serverCollection(serverDb, 'products'));
      snap.forEach((d) => {
        if (d.id === productId) prod = { id: d.id, ...d.data() };
      });
    } catch {}
  }
  if (!prod) {
    try {
      const rawInitial = fs.readFileSync(path.resolve('./src/data/initialProducts.json'), 'utf8');
      const all = JSON.parse(rawInitial);
      prod = all.find((p: any) => p.id === productId);
    } catch {}
  }

  if (!prod) {
    return { success: false, error: 'Product not found' };
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const parsedPrice =
    typeof prod.currentPrice === 'number' && prod.currentPrice > 0
      ? prod.currentPrice
      : parsePrice(prod.price) || 0;

  const result = await fetchPriceIntelligenceFromGemini({
    productId: prod.id,
    title: prod.title,
    brand: prod.brand,
    modelIdentifier: prod.modelIdentifier,
    asin: prod.asin,
    store: prod.store,
    resolvedUrl: prod.affiliateUrl || prod.productUrl,
    effectiveUrl: prod.affiliateUrl || prod.productUrl,
    currentPriceNum: parsedPrice,
    category: prod.category,
    description: prod.description,
  });

  if (result && result.isHistoricalDataAvailable && Array.isArray(result.priceHistory)) {
    const points = result.priceHistory;
    if (serverDb) {
      try {
        for (let pIdx = 0; pIdx < points.length; pIdx++) {
          const p = points[pIdx];
          const snapId = `snap_hist_${prod.id}_${pIdx}_${new Date(p.date).getTime()}`;
          const snapDoc = serverDoc(serverDb, `products/${prod.id}/priceHistory`, snapId);
          await serverSetDoc(snapDoc, {
            id: snapId,
            productId: prod.id,
            price: p.price,
            recordedAt: new Date(p.date).toISOString(),
            source: p.source || 'background_intelligence',
            sourceUrl: p.sourceUrl || '',
            evidence: p.evidence || '',
            note: p.note || 'Recorded verified historical observation',
          });
        }
        const prodRef = serverDoc(serverDb, 'products', prod.id);
        await serverUpdateDoc(prodRef, {
          lastResearchedAt: new Date().toISOString(),
          lastResearchedMonth: currentMonth,
          researchStatus: 'researched',
        });
      } catch (err: any) {
        console.warn('[BatchEngine] Firestore single research notice:', err);
      }
    }
  }

  const state = loadBatchState();
  if (!state.researchedProductIds.includes(productId)) {
    state.researchedProductIds.push(productId);
    state.researchedCount = state.researchedProductIds.length;
    state.pendingCount = Math.max(0, state.totalProducts - state.researchedCount);
    saveBatchState(state);
  }

  return { success: true, data: result };
}

// Background scheduler interval (checks every 30 minutes)
setInterval(() => {
  const state = loadBatchState();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  // If 1st of the month has arrived:
  if (state.currentMonth !== currentMonth) {
    console.log(`[BatchScheduler] New month detected (${currentMonth}). Initiating monthly price intelligence batch.`);
    runBatchPriceResearch();
    return;
  }

  // If paused due to daily quota and Day 2 / tomorrow has arrived:
  if (state.status === 'quota_paused' && state.resumesAt) {
    if (now >= new Date(state.resumesAt)) {
      console.log(`[BatchScheduler] New day has arrived! Automatically resuming batch research for remaining products.`);
      runBatchPriceResearch();
    }
  }
}, 30 * 60 * 1000);

// Startup check (runs 6 seconds after server starts)
setTimeout(() => {
  const state = loadBatchState();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (state.currentMonth !== currentMonth) {
    console.log(`[BatchScheduler] Server startup: initializing monthly research for ${currentMonth}.`);
    runBatchPriceResearch();
  } else if (state.status === 'quota_paused' && state.resumesAt && new Date() >= new Date(state.resumesAt)) {
    console.log(`[BatchScheduler] Server startup: resuming paused batch research.`);
    runBatchPriceResearch();
  }
}, 6000);

// Endpoints for Batch Research Management
app.get('/api/price-history/batch-status', async (req, res) => {
  const state = await getBatchStateWithLiveCounts();
  return res.json({ success: true, data: state });
});

app.post('/api/price-history/run-batch', async (req, res) => {
  const { forceResume } = req.body || {};
  const result = await runBatchPriceResearch({ forceResume: Boolean(forceResume) });
  return res.json(result);
});

app.post('/api/price-history/research-product', async (req, res) => {
  const { productId } = req.body || {};
  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }
  const result = await researchSingleProduct(productId);
  return res.json(result);
});

// -------------------------------------------------------------
// RAZORPAY PAYMENT GATEWAY ENDPOINTS (STANDARD WEB CHECKOUT)
// -------------------------------------------------------------

// Lazy initialization of Razorpay SDK
let razorpayClient: Razorpay | null = null;
function getRazorpay(): Razorpay {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!key_id || !key_secret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured');
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id,
      key_secret,
    });
  }
  return razorpayClient;
}

// 1. Get Razorpay configuration status (Public Key ID)
app.get(['/api/razorpay/config', '/api/config'], (req, res) => {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const hasSecret = Boolean((process.env.RAZORPAY_KEY_SECRET || '').trim());
  const isConfigured = Boolean(keyId && hasSecret);

  return res.json({
    success: true,
    isConfigured,
    keyId: keyId || 'rzp_test_placeholder',
    currency: 'INR',
  });
});

// 2. Create Razorpay Order
// Minimum amount: 100 paise (₹1)
// Request: { amount (in paise), currency, receipt }
// Return: { order_id, amount, currency, keyId }
const handleCreateOrder = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, currency = 'INR', receipt, notes, monthKey, userId, userEmail, tierId, tierName } = req.body;
    let numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    // Minimum amount check: 100 paise
    if (numericAmount < 100) {
      return res.status(400).json({ error: 'Minimum amount must be at least 100 paise (₹1)' });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(401).json({
        error: 'Razorpay API credentials not configured in environment',
      });
    }

    const amountInPaise = Math.round(numericAmount);
    const orderReceipt = receipt || `rcpt_${String(userId || 'creator').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}_${Date.now()}`.slice(0, 40);

    const orderNotes = {
      platform: 'PickASAP Creator Platform Fee',
      monthKey: String(monthKey || ''),
      userId: String(userId || ''),
      userEmail: String(userEmail || ''),
      tierId: String(tierId || ''),
      tierName: String(tierName || ''),
      ...(typeof notes === 'object' && notes ? notes : {}),
    };

    try {
      const razorpay = getRazorpay();
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: currency || 'INR',
        receipt: orderReceipt,
        notes: orderNotes,
      });

      return res.json({
        success: true,
        order_id: order.id,
        orderId: order.id,
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
        key_id: keyId,
      });
    } catch (sdkError: any) {
      console.error('Razorpay SDK error creating order, retrying via REST:', sdkError);

      // REST fallback
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: currency || 'INR',
          receipt: orderReceipt,
          notes: orderNotes,
        }),
      });

      if (razorpayRes.status === 401) {
        return res.status(401).json({
          error: 'Razorpay authentication failed. Invalid API credentials.',
        });
      }

      if (!razorpayRes.ok) {
        const errData = await razorpayRes.text();
        console.error('Razorpay REST error creating order:', errData);
        return res.status(500).json({
          error: 'Razorpay API error creating order',
          details: errData,
        });
      }

      const orderData = (await razorpayRes.json()) as any;
      return res.json({
        success: true,
        order_id: orderData.id,
        orderId: orderData.id,
        id: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId,
        key_id: keyId,
      });
    }
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      error: 'Failed to create payment order',
      message: error?.message,
    });
  }
};

app.post('/api/create-order', handleCreateOrder);
app.post('/api/razorpay/create-order', handleCreateOrder);

// 3. Verify Razorpay Payment Signature
// Endpoint: POST /api/verify-payment
// Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
// Compare generated signature with razorpay_signature
// Return success only if signatures match
const handleVerifyPayment = async (req: express.Request, res: express.Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
      payment_id,
      signature,
      monthKey,
      userId,
      amount,
    } = req.body;

    const orderId = razorpay_order_id || order_id;
    const paymentId = razorpay_payment_id || payment_id;
    const receivedSignature = razorpay_signature || signature;

    // Validate required fields
    if (!orderId || !paymentId || !receivedSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification fields: order_id, payment_id, and signature are all required',
      });
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        error: 'RAZORPAY_KEY_SECRET is not configured on server',
      });
    }

    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${orderId}|${paymentId}`);
    const generatedSignature = hmac.digest('hex');

    // Compare signatures securely
    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'utf-8'),
        Buffer.from(receivedSignature, 'utf-8')
      );
    } catch {
      isMatch = generatedSignature === receivedSignature;
    }

    if (!isMatch) {
      console.warn('Razorpay signature mismatch:', {
        orderId,
        paymentId,
        generatedSignature,
        receivedSignature,
      });
      return res.status(400).json({
        success: false,
        error: 'Signature verification failed. Invalid payment signature.',
      });
    }

    return res.json({
      success: true,
      verified: true,
      paymentId,
      orderId,
      monthKey: monthKey || '',
      userId: userId || '',
      amount: amount || 0,
      timestamp: new Date().toISOString(),
      message: 'Payment verified successfully',
    });
  } catch (error: any) {
    console.error('Error verifying payment signature:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while verifying payment',
      message: error?.message,
    });
  }
};

app.post('/api/verify-payment', handleVerifyPayment);
app.post('/api/razorpay/verify-payment', handleVerifyPayment);

// -------------------------------------------------------------
// VITE MIDDLEWARE / PRODUCTION STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
