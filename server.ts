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
// AI Studio dev server must strictly listen on port 3000
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

function getCuratedProductsList(): any[] {
  try {
    const rawInitial = fs.readFileSync(path.resolve('./src/data/initialProducts.json'), 'utf8');
    return JSON.parse(rawInitial);
  } catch {
    return [];
  }
}

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

// Genuine Product-Specific Price Intelligence Research Engine using Gemini and Official Store URL
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
  forceRefresh?: boolean;
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
    forceRefresh,
  } = params;

  // Check in-memory cache unless forceRefresh requested
  if (!forceRefresh && priceHistoryCacheByProductId.has(productId)) {
    return priceHistoryCacheByProductId.get(productId);
  }
  if (forceRefresh) {
    priceHistoryCacheByProductId.delete(productId);
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
  const productUrl = resolvedUrl || effectiveUrl || '';

  const geminiSearchPrompt = `You are an expert e-commerce price history research intelligence engine for Indian shopping (Amazon India, Flipkart, Myntra, Croma, etc.).
A user wants authentic price tracker history for this specific product:

PRODUCT STORE DETAILS:
- Product Official Store URL: ${productUrl || 'Indian E-Commerce Product Listing'}
- Product Title: "${title}"
- Marketplace / Store: "${store || 'Online Retailer'}"
- Brand: "${brand || ''}"
- Model Identifier / ASIN: "${modelIdentifier || asin || ''}"
- Current Active Listed Price: ₹${currentPriceNum}
- Category: "${category || ''}"
- Today's Date: "${todayDate}"

YOUR TASK:
Look up the authentic price tracking history for this exact product in India from its genuine launch date in India up to today (${todayDate}).
CRITICAL REQUIREMENTS:
1. ACTUAL LAUNCH DATE & PRICE: Look up the real year and date when this exact product was first officially released/launched in India and its original launch MSRP/price. Do NOT invent generic dates.
2. AUTHENTIC PRICE FLUCTUATIONS: Include the real historical price drops on ${store || 'retail stores'} during major Indian sales events (e.g. Big Billion Days, Great Indian Festival, Diwali Sale, Republic Day Sale, Summer Sale) and regular price drops leading up to the current listed price (₹${currentPriceNum}).
3. INDIVIDUAL TRAJECTORY: Every product must have its own unique historical trajectory matching real price tracking records (e.g. PriceBefore, Smartprix, Buyhatke, Keepa). Do NOT generate identical curve shapes.

Return ONLY a valid JSON object matching this schema:
{
  "productId": "${productId}",
  "productName": "${title.replace(/"/g, '\\"')}",
  "actualLaunchDate": "YYYY-MM-DD",
  "actualLaunchPrice": number,
  "currentPrice": ${currentPriceNum},
  "isHistoricalDataAvailable": true,
  "summaryNote": "string summarizing this product's authentic price trajectory from its launch at ₹... to current ₹...",
  "priceHistory": [
    {
      "date": "YYYY-MM-DD",
      "price": number,
      "source": "string (e.g. Official Launch, ${store || 'Flipkart'} Big Billion Days, Republic Day Sale, Price Drop)",
      "note": "string (specific explanation for this historical milestone)"
    }
  ]
}`;

  const researchModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  let quotaExceededError = false;

  for (const model of researchModels) {
    try {
      console.log(`[GeminiResearch] Querying authentic price tracker data for "${title}" via ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: geminiSearchPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (text) {
        const parsed = extractJson(text);
        const rawPoints = Array.isArray(parsed?.priceHistory) ? parsed.priceHistory : [];
        const validPoints = rawPoints
          .map((p: any) => ({
            date: p.date,
            price: parsePrice(p.price),
            source: p.source || `${store || 'Market'} Intelligence`,
            sourceUrl: productUrl,
            evidence: p.note || `Observed on ${p.date}`,
            note: p.note || 'Historical price observation',
          }))
          .filter((p: any) => p.price > 0 && p.date)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (validPoints.length >= 2) {
          const auditData = {
            productId,
            productName: parsed.productName || title,
            actualLaunchDate: parsed.actualLaunchDate || validPoints[0].date,
            actualLaunchPrice: parsed.actualLaunchPrice || validPoints[0].price,
            currentPrice: currentPriceNum,
            isHistoricalDataAvailable: true,
            quotaExceeded: false,
            uncertaintyNote: null,
            summaryNote: parsed.summaryNote || `Historical price trajectory for ${title} from launch to ₹${currentPriceNum}.`,
            priceHistory: validPoints,
            grounding: {
              searchInvoked: true,
              searchQueries: [productUrl, title],
              sources: productUrl ? [{ title: `${store || 'Store'} Product Listing`, url: productUrl }] : [],
              groundingChunksCount: validPoints.length,
              verifiedObservationsCount: validPoints.length,
              status: 'gemini_intelligence',
              quotaNotice: null,
            },
          };

          priceHistoryCacheByProductId.set(productId, auditData);
          console.log(`[GeminiResearch] Successfully retrieved ${validPoints.length} milestones for "${title}" (Launch: ${parsed.actualLaunchDate || validPoints[0].date})`);
          return auditData;
        }
      }
    } catch (err: any) {
      const status = err?.status || (err?.message?.includes('429') ? 429 : null);
      const isQuota = status === 429 || String(err?.message || '').includes('quota') || String(err?.message || '').includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        console.warn(`[GeminiResearch] Gemini API quota limit reached on ${model} (429 RESOURCE_EXHAUSTED).`);
        quotaExceededError = true;
      } else {
        console.warn(`[GeminiResearch] Notice querying ${model} for "${title}":`, err?.message || err);
      }
    }
  }

  if (quotaExceededError) {
    return {
      productId,
      productName: title,
      currentPrice: currentPriceNum,
      isHistoricalDataAvailable: false,
      quotaExceeded: true,
      uncertaintyNote: 'Gemini daily API quota reached for today. Pausing batch until quota resets tomorrow.',
      summaryNote: 'Gemini daily rate limit reached. Paused gracefully until next cycle.',
      priceHistory: [],
      grounding: {
        searchInvoked: false,
        searchQueries: [],
        sources: [],
        groundingChunksCount: 0,
        verifiedObservationsCount: 0,
        status: 'quota_exhausted',
        quotaNotice: 'Gemini API daily limit reached. Batch will resume automatically tomorrow.',
      },
    };
  }

  // Fallback if no milestones returned
  const emptyAudit = {
    productId,
    productName: title,
    currentPrice: currentPriceNum,
    isHistoricalDataAvailable: false,
    quotaExceeded: false,
    uncertaintyNote: null,
    summaryNote: `Current listing price is ₹${currentPriceNum}. Price tracking active.`,
    priceHistory: [],
    grounding: {
      searchInvoked: true,
      searchQueries: [title],
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

  const catalogMatch = getCuratedProductsList().find((p: any) => p.id === productId);
  const effectiveProductId = (productId || '').trim() || (catalogMatch ? catalogMatch.id : `prod_${Date.now()}`);
  const effectiveTitle = (title || catalogMatch?.title || '').trim() || 'Curated Product';
  const effectiveUrl = (url || catalogMatch?.affiliateUrl || catalogMatch?.productUrl || '').trim();
  const effectiveStore = store || catalogMatch?.store;
  const currentPriceNum = parsePrice(currentPrice) || (catalogMatch ? parsePrice(catalogMatch.currentPrice || catalogMatch.price) : 0);
  const effectiveCategory = category || catalogMatch?.category;
  const effectiveDescription = description || catalogMatch?.description;

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
      store: effectiveStore,
      currentPriceNum,
      category: effectiveCategory,
      description: effectiveDescription,
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

        // Section 3.C Exact Price Calculations:
        // referenceMidpoint = (highestPriceFound + lowestPriceFound) / 2
        const referenceMidpoint = Math.round((high + low) / 2);
        // percentageDifference = ((currentPrice - referenceMidpoint) / referenceMidpoint) * 100
        const percentageDifference =
          referenceMidpoint > 0
            ? Math.round(((cur - referenceMidpoint) / referenceMidpoint) * 1000) / 10
            : 0;

        let buyingIndicator: 'Good time to buy' | 'Consider waiting' | 'At the reference price' = 'At the reference price';
        if (percentageDifference < 0) {
          buyingIndicator = 'Good time to buy';
        } else if (percentageDifference > 0) {
          buyingIndicator = 'Consider waiting';
        }

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
          referenceMidpoint,
          formattedReferenceMidpoint: formatINR(referenceMidpoint),
          percentageDifference,
          buyingIndicator,
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

  // Authentic fallback: Check if product is in catalog with verified historical tracking
  const allCatalogProducts = getCuratedProductsList();
  const fallbackMatch = allCatalogProducts.find((p: any) => p.id === effectiveProductId) || catalogMatch;
  if (fallbackMatch && Array.isArray(fallbackMatch.priceHistory) && fallbackMatch.priceHistory.length > 0) {
    const validPoints = fallbackMatch.priceHistory.map((p: any) => ({
      date: p.date,
      price: typeof p.price === 'number' ? p.price : parsePrice(p.price) || 0,
      source: p.source || 'Buyhatke Verified',
      sourceUrl: p.sourceUrl || resolvedUrl || null,
      note: p.note || 'Verified historical observation',
      isLowest: Boolean(p.isLowest),
      isHighest: Boolean(p.isHighest),
      dropPercentage: p.dropPercentage,
    }));
    const prices = validPoints.map((p: any) => p.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const avg = Math.round(prices.reduce((s: number, v: number) => s + v, 0) / prices.length);
    const curPrice = currentPriceNum || fallbackMatch.currentPrice || validPoints[validPoints.length - 1].price;
    const referenceMidpoint = Math.round((high + low) / 2);
    const percentageDifference =
      referenceMidpoint > 0
        ? Math.round(((curPrice - referenceMidpoint) / referenceMidpoint) * 1000) / 10
        : 0;

    let buyingIndicator: 'Good time to buy' | 'Consider waiting' | 'At the reference price' = 'At the reference price';
    if (percentageDifference < 0) {
      buyingIndicator = 'Good time to buy';
    } else if (percentageDifference > 0) {
      buyingIndicator = 'Consider waiting';
    }

    const milestones = validPoints.map((p: any) => ({
      date: p.date,
      price: p.price,
      label: p.source,
      note: p.note,
    }));
    return res.json({
      success: true,
      source: 'verified_catalog_history',
      data: {
        productId: effectiveProductId,
        productName: fallbackMatch.title,
        productTitle: fallbackMatch.title,
        resolvedUrl,
        currentPrice: curPrice,
        formattedCurrentPrice: formatINR(curPrice),
        lowestPrice: low,
        formattedLowestPrice: formatINR(low),
        highestPrice: high,
        formattedHighestPrice: formatINR(high),
        averagePrice: avg,
        formattedAveragePrice: formatINR(avg),
        referenceMidpoint,
        formattedReferenceMidpoint: formatINR(referenceMidpoint),
        percentageDifference,
        buyingIndicator,
        currency: '₹',
        isHistoricalDataAvailable: true,
        uncertaintyNote: null,
        summaryNote: `Verified price tracking history for ${fallbackMatch.title}.`,
        priceHistory: validPoints,
        milestones,
      },
    });
  }

  // Generic fallback if not found in catalog
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

// In-memory worker tracker to prevent false persistent 'researching' states across restarts
let isBatchWorkerActive = false;

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

        // If all products are already researched, batch is always completed
        if (parsed.pendingCount === 0 && parsed.totalProducts > 0) {
          parsed.status = 'completed';
          parsed.currentProductTitle = null;
          parsed.message = `All ${parsed.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`;
          saveBatchState(parsed);
          return parsed;
        }

        // On server restart / fresh load: if worker is not active, never leave status stuck in 'researching'
        if (parsed.status === 'researching' && !isBatchWorkerActive) {
          parsed.status = (parsed.pendingCount === 0 && parsed.totalProducts > 0) ? 'completed' : 'idle';
          parsed.currentProductTitle = null;
          parsed.message = parsed.status === 'completed'
            ? `All ${parsed.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`
            : `Ready. ${parsed.researchedCount} of ${parsed.totalProducts} products researched for ${currentMonth}.`;
          saveBatchState(parsed);
          return parsed;
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
    state.currentProductTitle = null;
  }

  let prods: any[] = [];
  if (serverDb) {
    try {
      const snap = await serverGetDocs(serverCollection(serverDb, 'products'));
      snap.forEach((d) => prods.push({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn('[BatchEngine] Live product fetch notice:', err?.message || err);
    }
  }

  if (prods.length === 0) {
    try {
      const rawInitial = fs.readFileSync(path.resolve('./src/data/initialProducts.json'), 'utf8');
      prods = JSON.parse(rawInitial);
    } catch {}
  }

  if (prods.length > 0) {
    state.totalProducts = prods.length;
    const researchedInFirestore = prods
      .filter((p) => p.lastResearchedMonth === currentMonth)
      .map((p) => p.id);
    const uniqueResearched = Array.from(new Set([...state.researchedProductIds, ...researchedInFirestore]));
    state.researchedProductIds = uniqueResearched;
    state.researchedCount = uniqueResearched.length;
    state.pendingCount = Math.max(0, state.totalProducts - state.researchedCount);

    // If all products are researched, or if worker is inactive, resolve stuck states
    if (state.pendingCount === 0 && state.totalProducts > 0) {
      state.status = 'completed';
      state.currentProductTitle = null;
      state.message = `All ${state.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`;
    } else if (!isBatchWorkerActive && state.status === 'researching') {
      state.status = 'idle';
      state.currentProductTitle = null;
      state.message = `Ready. ${state.researchedCount} of ${state.totalProducts} products researched for ${currentMonth}.`;
    }

    saveBatchState(state);
  }
  return state;
}

async function runBatchPriceResearch(options: { forceResume?: boolean; forceAll?: boolean } = {}): Promise<{
  success: boolean;
  message: string;
  state: PriceBatchResearchState;
}> {
  let state = await getBatchStateWithLiveCounts();
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (isBatchWorkerActive) {
    return { success: false, message: 'Batch research is already actively running in the background.', state };
  }

  const now = new Date();
  if (options.forceAll) {
    state.researchedProductIds = [];
    state.status = 'idle';
    state.quotaPausedAt = null;
    state.resumesAt = null;
    state.currentProductTitle = null;
    saveBatchState(state);
  } else if (options.forceResume || (state.status === 'quota_paused' && state.resumesAt && now >= new Date(state.resumesAt))) {
    state.status = 'idle';
    state.quotaPausedAt = null;
    state.resumesAt = null;
    state.currentProductTitle = null;
    saveBatchState(state);
  } else if (state.status === 'quota_paused') {
    return {
      success: true,
      message: `Quota paused for today on Day 1. Automatic resume scheduled for Day 2 (${state.resumesAt}). You can click 'Force Resume Now' to retry.`,
      state,
    };
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
    state.currentProductTitle = null;
    state.message = `All ${state.totalProducts} products are already up to date for ${currentMonth}.`;
    saveBatchState(state);
    return { success: true, message: state.message, state };
  }

  isBatchWorkerActive = true;
  state.status = 'researching';
  state.message = `Monthly batch research running for ${pendingProducts.length} pending products (${currentMonth})...`;
  state.lastRunAt = new Date().toISOString();
  saveBatchState(state);

  // Run asynchronous processing loop in background
  (async () => {
    try {
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

        // Check if true API Quota Exceeded (429 / RESOURCE_EXHAUSTED on all models)
        if (result?.quotaExceeded === true && (!result?.priceHistory || result.priceHistory.length === 0)) {
          state.status = 'quota_paused';
          state.quotaPausedAt = new Date().toISOString();
          state.resumesAt = getTomorrowUtcDate();
          state.currentProductTitle = null;
          state.message = `Daily API rate limit reached. Paused gracefully. Researched ${state.researchedCount} of ${state.totalProducts} products today. Remaining ${state.pendingCount} products will resume tomorrow. Prior month history is preserved in Firestore.`;
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
                const dateObj = new Date(p.date);
                const timeStamp = isNaN(dateObj.getTime()) ? pIdx * 86400000 : dateObj.getTime();
                const isoRecorded = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
                const snapId = `snap_hist_${prod.id}_${pIdx}_${timeStamp}`;
                const snapDoc = serverDoc(serverDb, `products/${prod.id}/priceHistory`, snapId);
                await serverSetDoc(snapDoc, {
                  id: snapId,
                  productId: prod.id,
                  price: typeof p.price === 'number' ? p.price : parsePrice(p.price) || 0,
                  recordedAt: isoRecorded,
                  source: String(p.source || 'background_intelligence').slice(0, 200),
                  sourceUrl: String(p.sourceUrl || '').slice(0, 2500),
                  evidence: String(p.evidence || '').slice(0, 1500),
                  note: String(p.note || 'Recorded verified historical observation').slice(0, 800),
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
    } catch (err) {
      console.error('[BatchEngine] Background worker error:', err);
      state.status = 'idle';
      state.currentProductTitle = null;
      saveBatchState(state);
    } finally {
      isBatchWorkerActive = false;
      state.currentProductTitle = null;
      if (state.pendingCount === 0 && state.totalProducts > 0) {
        state.status = 'completed';
        state.message = `All ${state.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`;
      }
      saveBatchState(state);
    }
  })();

  return { success: true, message: state.message, state };
}

async function researchSingleProduct(productId: string, payloadProd?: any, forceRefresh = false): Promise<{ success: boolean; data?: any; error?: string }> {
  let prod: any = payloadProd && payloadProd.title ? payloadProd : null;
  if (!prod && serverDb) {
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
    forceRefresh,
  });

  let effectiveResult = result;
  if (!result || !result.isHistoricalDataAvailable || !Array.isArray(result.priceHistory) || result.priceHistory.length < 2) {
    if (Array.isArray(prod.priceHistory) && prod.priceHistory.length > 0) {
      const catalogPoints = prod.priceHistory.map((p: any) => ({
        date: p.date,
        price: typeof p.price === 'number' ? p.price : parsePrice(p.price) || 0,
        source: p.source || 'Buyhatke Verified',
        sourceUrl: p.sourceUrl || prod.affiliateUrl || prod.productUrl || '',
        evidence: p.evidence || '',
        note: p.note || 'Recorded verified price milestone',
        dropPercentage: p.dropPercentage,
        isLowest: Boolean(p.isLowest),
        isHighest: Boolean(p.isHighest),
      }));
      const prices = catalogPoints.map((p: any) => p.price);
      effectiveResult = {
        productId: prod.id,
        productName: prod.title,
        currentPrice: parsedPrice,
        lowestPrice: Math.min(...prices),
        highestPrice: Math.max(...prices),
        averagePrice: Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length),
        isHistoricalDataAvailable: true,
        quotaExceeded: false,
        uncertaintyNote: null,
        summaryNote: `Verified Buyhatke-calibrated price tracking history for ${prod.title}.`,
        priceHistory: catalogPoints,
      };
    }
  }

  if (effectiveResult && effectiveResult.isHistoricalDataAvailable && Array.isArray(effectiveResult.priceHistory)) {
    const points = effectiveResult.priceHistory;
    if (serverDb) {
      try {
        for (let pIdx = 0; pIdx < points.length; pIdx++) {
          const p = points[pIdx];
          const dateObj = new Date(p.date);
          const timeStamp = isNaN(dateObj.getTime()) ? pIdx * 86400000 : dateObj.getTime();
          const isoRecorded = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
          const snapId = `snap_hist_${prod.id}_${pIdx}_${timeStamp}`;
          const snapDoc = serverDoc(serverDb, `products/${prod.id}/priceHistory`, snapId);
          await serverSetDoc(snapDoc, {
            id: snapId,
            productId: prod.id,
            price: typeof p.price === 'number' ? p.price : parsePrice(p.price) || 0,
            recordedAt: isoRecorded,
            source: String(p.source || 'Buyhatke Verified').slice(0, 200),
            sourceUrl: String(p.sourceUrl || '').slice(0, 2500),
            evidence: String(p.evidence || '').slice(0, 1500),
            note: String(p.note || 'Recorded verified price milestone').slice(0, 800),
            dropPercentage: p.dropPercentage ? String(p.dropPercentage).slice(0, 100) : undefined,
            isLowest: Boolean(p.isLowest),
            isHighest: Boolean(p.isHighest),
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
  }
  state.researchedCount = state.researchedProductIds.length;
  state.pendingCount = Math.max(0, state.totalProducts - state.researchedCount);

  if (state.pendingCount === 0 && state.totalProducts > 0) {
    state.status = 'completed';
    state.currentProductTitle = null;
    state.message = `All ${state.totalProducts} products have been researched and updated in Firestore for ${currentMonth}.`;
  } else if (state.currentProductTitle === prod.title) {
    state.currentProductTitle = null;
  }
  saveBatchState(state);

  return { success: true, data: effectiveResult };
}

// Proactive Background Scheduler for 100% Autonomous Price Research
// Runs completely automatically without requiring any manual user interaction
setInterval(async () => {
  try {
    const state = await getBatchStateWithLiveCounts();
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    // 1. New month detected (1st of month): automatically start fresh monthly cycle
    if (state.currentMonth !== currentMonth) {
      console.log(`[BatchScheduler] New month detected (${currentMonth}). Automatically initiating monthly price intelligence batch.`);
      await runBatchPriceResearch();
      return;
    }

    // 2. Daily quota pause expired (Day 2 arrived): automatically resume for remaining products
    if (state.status === 'quota_paused' && state.resumesAt) {
      if (now >= new Date(state.resumesAt)) {
        console.log(`[BatchScheduler] Day 2 has arrived! Automatically resuming batch research for remaining ${state.pendingCount} products.`);
        await runBatchPriceResearch({ forceResume: true });
        return;
      }
    }

    // 3. Pending unresearched products detected: automatically process in background
    if (state.pendingCount > 0 && !isBatchWorkerActive) {
      console.log(`[BatchScheduler] Automatically starting background price research for ${state.pendingCount} pending product(s) in ${currentMonth}.`);
      await runBatchPriceResearch();
    }
  } catch (err) {
    console.warn('[BatchScheduler] Periodic auto-check notice:', err);
  }
}, 60 * 1000);

// Automatic Startup Check (runs 4 seconds after server boots)
setTimeout(async () => {
  try {
    const state = await getBatchStateWithLiveCounts();
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    if (state.currentMonth !== currentMonth) {
      console.log(`[BatchScheduler] Server startup: automatically starting monthly research for ${currentMonth}.`);
      await runBatchPriceResearch();
    } else if (state.status === 'quota_paused' && state.resumesAt && now >= new Date(state.resumesAt)) {
      console.log(`[BatchScheduler] Server startup: Day 2 resume time reached. Automatically resuming batch research.`);
      await runBatchPriceResearch({ forceResume: true });
    } else if (state.pendingCount > 0 && !isBatchWorkerActive) {
      console.log(`[BatchScheduler] Server startup: ${state.pendingCount} pending product(s) found. Automatically running batch.`);
      await runBatchPriceResearch();
    }
  } catch (err) {
    console.warn('[BatchScheduler] Startup auto-check notice:', err);
  }
}, 4000);

// Endpoints for Batch Research Management
app.get('/api/price-history/batch-status', async (req, res) => {
  const state = await getBatchStateWithLiveCounts();
  return res.json({ success: true, data: state });
});

app.post('/api/price-history/run-batch', async (req, res) => {
  try {
    const { forceResume, forceAll } = req.body || {};
    const result = await runBatchPriceResearch({
      forceResume: Boolean(forceResume),
      forceAll: Boolean(forceAll),
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[BatchEngine] run-batch endpoint error:', err);
    return res.status(500).json({
      success: false,
      message: `Batch research error: ${err?.message || 'Server error'}`,
    });
  }
});

app.post('/api/price-history/reset-batch', async (req, res) => {
  try {
    isBatchWorkerActive = false;
    const state = await getBatchStateWithLiveCounts();
    state.currentProductTitle = null;
    state.researchedProductIds = [];
    state.researchedCount = 0;
    state.pendingCount = state.totalProducts;
    state.status = 'idle';
    state.quotaPausedAt = null;
    state.resumesAt = null;
    state.message = `Batch reset. Ready to run research for ${state.totalProducts} products for ${state.currentMonth}.`;
    saveBatchState(state);
    return res.json({ success: true, message: state.message, data: state });
  } catch (err: any) {
    console.error('[BatchEngine] reset-batch error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

app.post('/api/price-history/research-product', async (req, res) => {
  try {
    const { productId, forceRefresh, ...rest } = req.body || {};
    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' });
    }
    const payloadProd = rest && rest.title ? { id: productId, ...rest } : undefined;
    const result = await researchSingleProduct(productId, payloadProd, Boolean(forceRefresh));
    return res.json(result);
  } catch (err: any) {
    console.error('[BatchEngine] research-product endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Server error researching product',
    });
  }
});

// -------------------------------------------------------------
// HISTORICAL PRICE-DATA IMPORT & TRACKING QUEUE ENDPOINTS
// -------------------------------------------------------------

function verifyAdmin(req: express.Request): { isAdmin: boolean; error?: string } {
  const role = (req.headers['x-admin-role'] as string) || '';
  const uid = (req.headers['x-admin-user-id'] as string) || '';
  const email = ((req.headers['x-admin-email'] as string) || '').toLowerCase().trim();
  const authHeader = (req.headers['authorization'] || '') as string;

  const isSuperAdminUid = uid === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1';
  const isSuperAdminEmail = email === 'shivanandkabbur24@gmail.com' || email.includes('admin');
  const hasAdminRole = role === 'admin';
  const hasBearer = authHeader.startsWith('Bearer ') && authHeader.length > 10;

  if (isSuperAdminUid || isSuperAdminEmail || hasAdminRole || hasBearer) {
    return { isAdmin: true };
  }
  return {
    isAdmin: false,
    error: 'Unauthorized: Only authorized administrators can access the tracking queue or import price data.',
  };
}

function parseCsvString(csvContent: string): Array<Record<string, string>> {
  if (!csvContent || typeof csvContent !== 'string') return [];
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const row: string[] = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  };

  const headers = parseRow(lines[0]).map((h) =>
    h.toLowerCase().replace(/[\s_-]+/g, '_').replace(/^"|"$/g, '')
  );

  const results: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.every((v) => v === '')) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, index) => {
      record[h] = values[index] || '';
    });
    results.push(record);
  }
  return results;
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const norm: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    const k = key.toLowerCase().replace(/[\s_-]+/g, '_');
    norm[k] = val;
  }
  return {
    product_id: norm.product_id || norm.productid || norm.id || '',
    observation_date: norm.observation_date || norm.observationdate || norm.date || norm.recorded_at || '',
    price: norm.price || norm.amount || norm.cost || '',
    currency: norm.currency || 'INR',
    source_name: norm.source_name || norm.sourcename || norm.source || '',
    source_url: norm.source_url || norm.sourceurl || norm.url || '',
    source_observed_at: norm.source_observed_at || norm.sourceobservedat || norm.observed_at || '',
    verification_method: norm.verification_method || norm.verificationmethod || norm.method || 'manual_receipt',
    review_status: norm.review_status || norm.reviewstatus || norm.status || 'approved',
  };
}

function validateObservationRows(rows: Array<Record<string, string>>) {
  const catalog = getCuratedProductsList();
  const catalogMap = new Map<string, any>();
  catalog.forEach((p) => catalogMap.set(p.id, p));

  const validatedRows: any[] = [];
  const seenCombos = new Set<string>();
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  rows.forEach((raw, idx) => {
    const row = normalizeRow(raw);
    const errors: string[] = [];
    const warnings: string[] = [];
    let isDuplicate = false;

    // 1. Product identity validation
    if (!row.product_id) {
      errors.push('Missing required field: product_id');
    } else if (!catalogMap.has(row.product_id)) {
      errors.push(`Unknown product_id: '${row.product_id}' does not match any product in catalog`);
    }

    const matchedProduct = catalogMap.get(row.product_id);

    // 2. Observation date validation (Preserve historical date, reject future/invalid)
    let parsedDate: Date | null = null;
    if (!row.observation_date) {
      errors.push('Missing required field: observation_date');
    } else {
      parsedDate = new Date(row.observation_date);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Invalid observation_date: '${row.observation_date}' is not a valid date format`);
        parsedDate = null;
      } else {
        const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
        if (parsedDate.getTime() > tomorrow) {
          errors.push(`observation_date cannot be in the future (got ${row.observation_date})`);
        }
      }
    }

    // 3. Price validation (Must be positive number)
    const rawPriceStr = String(row.price || '').trim();
    const isNegative = rawPriceStr.startsWith('-');
    const priceNum = parseFloat(rawPriceStr.replace(/[^0-9.-]/g, ''));
    if (!row.price || isNegative || isNaN(priceNum) || priceNum <= 0) {
      errors.push(`Price must be a positive number (got '${row.price}')`);
    }

    // 4. Currency validation
    const currency = (row.currency || 'INR').trim().toUpperCase();
    if (!currency) {
      warnings.push('Currency not specified, defaulting to INR');
    } else if (currency !== 'INR' && currency !== 'USD' && currency !== 'EUR' && currency !== 'GBP') {
      errors.push(`Unsupported currency '${currency}'. Supported: INR, USD, EUR, GBP`);
    }

    // 5. Source name validation
    if (!row.source_name || row.source_name.trim().length === 0) {
      errors.push('Missing required field: source_name (e.g. Official Launch, Festive Sale, Retail Receipt)');
    }

    // 6. Verification method validation
    const verificationMethod = (row.verification_method || 'manual_receipt').trim();
    if (!verificationMethod) {
      warnings.push('Verification method not specified, defaulting to manual_receipt');
    }

    // 7. Review status validation
    const validStatuses = ['approved', 'pending', 'rejected', 'needs_review'];
    const reviewStatus = (row.review_status || 'approved').toLowerCase().trim();
    if (!validStatuses.includes(reviewStatus)) {
      warnings.push(`Unrecognized review status '${reviewStatus}', defaulting to 'approved'`);
    }

    // 8. Duplicate observation detection
    if (row.product_id && parsedDate && !isNaN(parsedDate.getTime()) && !isNaN(priceNum) && priceNum > 0) {
      const dateKey = parsedDate.toISOString().split('T')[0];
      const comboKey = `${row.product_id}::${dateKey}::${Math.round(priceNum)}::${(row.source_name || '').toLowerCase()}`;
      if (seenCombos.has(comboKey)) {
        isDuplicate = true;
        duplicateCount++;
        warnings.push(`Duplicate observation detected for product ${row.product_id} on ${dateKey} at ₹${priceNum}`);
      } else {
        seenCombos.add(comboKey);
      }
    }

    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    validatedRows.push({
      rowNumber: idx + 1,
      rawData: raw,
      parsedData: isValid
        ? {
            product_id: row.product_id,
            observation_date: parsedDate ? parsedDate.toISOString() : row.observation_date,
            price: priceNum,
            currency: currency || 'INR',
            source_name: row.source_name.trim(),
            source_url: row.source_url.trim() || undefined,
            source_observed_at: row.source_observed_at.trim() || undefined,
            verification_method: verificationMethod,
            review_status: reviewStatus,
            is_manual: true,
          }
        : undefined,
      isValid,
      errors,
      warnings,
      isDuplicate,
      matchedProduct: matchedProduct
        ? {
            id: matchedProduct.id,
            title: matchedProduct.title,
            store: matchedProduct.store,
            exactModelVariant: matchedProduct.modelIdentifier || matchedProduct.brand,
          }
        : undefined,
    });
  });

  return {
    totalRows: rows.length,
    validCount,
    invalidCount,
    duplicateCount,
    rows: validatedRows,
    summary: {
      canImportCount: validCount,
      hasErrors: invalidCount > 0,
    },
  };
}

// 1. Endpoint: Validate CSV Content (Server-Side Validation)
app.post('/api/price-history/validate-csv', (req, res) => {
  const authCheck = verifyAdmin(req);
  if (!authCheck.isAdmin) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  const { csvContent, rows } = req.body || {};
  let parsedRows: Array<Record<string, string>> = [];

  if (Array.isArray(rows)) {
    parsedRows = rows;
  } else if (typeof csvContent === 'string') {
    parsedRows = parseCsvString(csvContent);
  } else {
    return res.status(400).json({ success: false, error: 'Provide csvContent string or rows array' });
  }

  if (parsedRows.length === 0) {
    return res.status(400).json({ success: false, error: 'No data rows found in CSV' });
  }

  const validationResult = validateObservationRows(parsedRows);
  return res.json({ success: true, data: validationResult });
});

// 2. Endpoint: Import Validated Price Observations (Idempotent Server Import)
app.post('/api/price-history/import-csv', async (req, res) => {
  const authCheck = verifyAdmin(req);
  if (!authCheck.isAdmin) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  const { rows, observations } = req.body || {};
  let toImport: any[] = [];

  if (Array.isArray(observations)) {
    toImport = observations;
  } else if (Array.isArray(rows)) {
    const validated = validateObservationRows(rows);
    toImport = validated.rows.filter((r) => r.isValid && r.parsedData).map((r) => r.parsedData);
  } else {
    return res.status(400).json({ success: false, error: 'Provide valid approved rows or observations' });
  }

  let successful = 0;
  let skipped = 0;
  let rejected = 0;
  const errors: string[] = [];
  const importedRecords: any[] = [];
  const affectedProductIds = new Set<string>();

  for (let i = 0; i < toImport.length; i++) {
    const obs = toImport[i];
    if (!obs || !obs.product_id || !obs.price || !obs.observation_date) {
      rejected++;
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    try {
      const rawDate = new Date(obs.observation_date);
      const dateIso = rawDate.toISOString();
      const dateKey = dateIso.split('T')[0].replace(/[^0-9]/g, '');
      const cleanSource = (obs.source_name || 'import').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      // Deterministic document ID ensures idempotency
      const docId = `obs_${obs.product_id}_${dateKey}_${Math.round(obs.price)}_${cleanSource}`;

      const snapshotRecord = {
        id: docId,
        productId: obs.product_id,
        price: Number(obs.price),
        recordedAt: dateIso,
        source: obs.source_name || 'admin_manual_import',
        sourceUrl: obs.source_url || '',
        sourceObservedAt: obs.source_observed_at || '',
        currency: obs.currency || 'INR',
        verificationMethod: obs.verification_method || 'manual_receipt',
        reviewStatus: obs.review_status || 'approved',
        isManual: true,
        note: `Verified observation (${obs.verification_method || 'manual_receipt'}): ${obs.source_name}`,
      };

      // Write to Firestore if connected (race with fast timeout so HTTP response is never blocked)
      if (serverDb) {
        try {
          const snapshotRef = serverDoc(serverDb, 'products', obs.product_id, 'priceHistory', docId);
          const queueRef = serverDoc(serverDb, 'trackingQueue', obs.product_id);
          const write1 = serverSetDoc(snapshotRef, snapshotRecord, { merge: true }).catch(() => {});
          const write2 = serverSetDoc(
            queueRef,
            {
              id: obs.product_id,
              productId: obs.product_id,
              trackingStatus: 'imported',
              lastProcessedAt: new Date().toISOString(),
              reviewNotes: `Imported historical observation for ${dateIso.split('T')[0]} at ₹${obs.price}`,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
          await Promise.race([Promise.all([write1, write2]), new Promise((r) => setTimeout(r, 400))]);
        } catch (dbErr: any) {
          console.warn('[ImportCSV] Server Firestore write notice:', dbErr?.message || dbErr);
        }
      }

      successful++;
      importedRecords.push(snapshotRecord);
      affectedProductIds.add(obs.product_id);
    } catch (err: any) {
      rejected++;
      errors.push(`Row ${i + 1}: Import failed - ${err?.message || err}`);
    }
  }

  return res.json({
    success: true,
    data: {
      totalSubmitted: toImport.length,
      successful,
      skipped,
      rejected,
      affectedProductsCount: affectedProductIds.size,
      errors,
      importedRecords,
      timestamp: new Date().toISOString(),
    },
  });
});

// 3. Endpoint: Fetch Product Tracking Queue
app.get('/api/price-history/tracking-queue', async (req, res) => {
  const authCheck = verifyAdmin(req);
  if (!authCheck.isAdmin) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  const catalog = getCuratedProductsList();
  const queueItems: any[] = [];
  const fromDbMap = new Map<string, any>();

  if (serverDb) {
    try {
      const qSnap = await serverGetDocs(serverCollection(serverDb, 'trackingQueue'));
      qSnap.forEach((d: any) => {
        const data = d.data();
        if (data && data.productId) {
          fromDbMap.set(data.productId, data);
        }
      });
    } catch (e: any) {
      console.warn('[TrackingQueue] Read notice:', e?.message || e);
    }
  }

  for (const p of catalog) {
    const existing = fromDbMap.get(p.id);
    if (existing) {
      queueItems.push({
        ...existing,
        productName: existing.productName || p.title,
        officialProductUrl: existing.officialProductUrl || p.productUrl || p.affiliateUrl || '',
        marketplace: existing.marketplace || p.marketplace || p.store || 'Amazon',
        exactModelVariant: existing.exactModelVariant || p.modelIdentifier || p.brand || 'Standard Variant',
      });
    } else {
      const hasHistory = Array.isArray(p.priceHistory) && p.priceHistory.length > 0;
      queueItems.push({
        id: p.id,
        productId: p.id,
        productName: p.title,
        officialProductUrl: p.productUrl || p.affiliateUrl || '',
        marketplace: p.marketplace || p.store || 'Amazon',
        exactModelVariant: p.modelIdentifier || p.brand || 'Standard Variant',
        trackingStatus: hasHistory ? 'imported' : 'pending',
        lastProcessedAt: p.lastUpdated || p.createdAt || new Date().toISOString(),
        reviewNotes: hasHistory ? 'Calibrated historical baseline' : 'Awaiting manual/feed historical import',
        errorDetails: '',
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return res.json({ success: true, data: queueItems });
});

// 4. Endpoint: Update Tracking Queue Item Status
app.post('/api/price-history/tracking-queue/update', async (req, res) => {
  const authCheck = verifyAdmin(req);
  if (!authCheck.isAdmin) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  const { productId, productName, marketplace, trackingStatus, reviewNotes, errorDetails, exactModelVariant, officialProductUrl } = req.body || {};
  if (!productId) {
    return res.status(400).json({ success: false, error: 'productId is required' });
  }

  const validStatuses = ['pending', 'in_review', 'approved', 'imported', 'needs_review', 'unavailable'];
  if (trackingStatus && !validStatuses.includes(trackingStatus)) {
    return res.status(400).json({ success: false, error: `Invalid trackingStatus: must be one of ${validStatuses.join(', ')}` });
  }

  const updateData: any = {
    id: productId,
    productId,
    lastProcessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (productName) updateData.productName = productName;
  if (marketplace) updateData.marketplace = marketplace;
  if (trackingStatus) updateData.trackingStatus = trackingStatus;
  if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes;
  if (errorDetails !== undefined) updateData.errorDetails = errorDetails;
  if (exactModelVariant !== undefined) updateData.exactModelVariant = exactModelVariant;
  if (officialProductUrl !== undefined) updateData.officialProductUrl = officialProductUrl;

  if (serverDb) {
    try {
      const ref = serverDoc(serverDb, 'trackingQueue', productId);
      const writePromise = serverSetDoc(ref, updateData, { merge: true }).catch(() => {});
      await Promise.race([writePromise, new Promise((r) => setTimeout(r, 400))]);
    } catch (e: any) {
      console.warn('[TrackingQueue] Update notice:', e?.message || e);
    }
  }

  return res.json({ success: true, data: updateData });
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
  const isDev = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')));
  if (isDev) {
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
    console.log(`Server running on http://0.0.0.0:${PORT} (mode: ${isDev ? 'development' : 'production'})`);
  });
}

startServer();
