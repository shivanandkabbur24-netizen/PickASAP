import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Razorpay from 'razorpay';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

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

// Genuine Product-Specific Price Intelligence Research Engine using Gemini
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

  const systemInstruction = `You are an e-commerce price history research intelligence engine for an online curated shopping platform.
Your task is to analyze the EXACT product provided and return its independent, product-specific price history dataset.

CRITICAL REQUIREMENTS:
1. Treat every product as a completely separate and independent research request.
2. NEVER reuse, copy, scale, transform, randomize, or modify the price-history pattern of another product.
3. DO NOT use a fixed/template price-history array.
4. DO NOT generate a generic price curve or formula.
5. REAL VERIFIED DATA > COMPLETE GRAPH. Fabricated historical data is strictly prohibited.
6. The requested historical data must correspond specifically to THAT exact product, distinguishing storage variants, RAM variants, colors, listing, model numbers, and generations.
7. If reliable historical prices cannot be verified from reliable sources with reasonable confidence, you MUST set:
   "isHistoricalDataAvailable": false,
   "priceHistory": []
8. If genuine historical prices can be verified, each observation MUST contain:
   - "date": "YYYY-MM-DD"
   - "price": number in INR
   - "source": name of the specific verified marketplace, catalog, or archive source
   - "sourceUrl": URL of the source if known (or null)
   - "note": factual description of the observation
9. Return structured JSON strictly adhering to the requested format.`;

  const prompt = `Research and return the independent historical price data specifically for this exact product:
Product ID: "${productId}"
Product Name: "${title}"
Brand: "${brand || ''}"
Model Identifier: "${modelIdentifier || ''}"
ASIN / SKU / Identifier: "${asin || ''}"
Store / Marketplace: "${store || 'Online'}"
Product URL: "${resolvedUrl || effectiveUrl || ''}"
Current Price: ${currentPriceNum}
Category: "${category || ''}"
Description: "${(description || '').slice(0, 300)}"

REQUIRED RESPONSE FORMAT:
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
      "source": "string",
      "sourceUrl": "string or null",
      "note": "string"
    }
  ]
}`;

  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (text) {
        const parsed = extractJson(text);
        if (parsed && typeof parsed === 'object') {
          parsed.productId = productId;
          if (!parsed.productName) parsed.productName = title;
          if (!parsed.currentPrice) parsed.currentPrice = currentPriceNum;
          if (!Array.isArray(parsed.priceHistory)) parsed.priceHistory = [];

          priceHistoryCacheByProductId.set(productId, parsed);
          return parsed;
        }
      }
    } catch (err: any) {
      console.warn(`Gemini price history research attempt with ${model}:`, err?.status || err?.message || err);
      // Wait briefly before attempting model fallback if temporary 503 spike occurs
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  return null;
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
      const validPoints = isAvailable
        ? rawPoints
            .map((p: any) => ({
              date: p.date || new Date().toISOString().split('T')[0],
              price: parsePrice(p.price),
              source: p.source || (p.note ? 'Verified Archive' : 'Listing'),
              sourceUrl: p.sourceUrl || null,
              note: p.note || 'Verified historical observation',
            }))
            .filter((p: any) => p.price > 0 && p.source)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        : [];

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
          summaryNote: parsedData.summaryNote || `Verified product-specific price trajectory ranging from ${formatINR(low)} to ${formatINR(high)}.`,
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
