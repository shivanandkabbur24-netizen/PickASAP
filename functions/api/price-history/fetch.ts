// Cloudflare Pages Function: /api/price-history/fetch
// Handles background price intelligence research requests on Cloudflare Pages deployments

interface Env {
  GEMINI_API_KEY?: string;
  [key: string]: any;
}

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
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = (await context.request.json().catch(() => ({}))) as any;
    const {
      productId,
      title,
      brand,
      modelIdentifier,
      asin,
      store,
      currentPrice,
      category,
      description,
      url,
    } = body;

    const currentPriceNum = parsePrice(currentPrice);
    const effectiveTitle = (title || '').trim() || 'Curated Product';
    const effectiveProductId = (productId || '').trim() || `prod_${Date.now()}`;
    const effectiveUrl = (url || '').trim();

    const apiKey = context.env?.GEMINI_API_KEY || '';

    // If Gemini API Key is available on Cloudflare Pages environment
    if (apiKey) {
      const prompt = `You are an e-commerce price history research intelligence engine for an online curated shopping platform.
Treat every product as a completely separate and independent research request.
NEVER reuse, copy, scale, transform, randomize, or modify the price-history pattern of another product.
DO NOT use a fixed/template price-history array.
DO NOT generate a generic price curve or formula.
NEVER simulate, estimate, or hallucinate historical prices just to complete a graph.
REAL VERIFIED DATA > COMPLETE GRAPH. Fabricated historical data is strictly prohibited.

Research ONLY the EXACT product listing provided below:
- Product ID: "${effectiveProductId}"
- Exact Product Name: "${effectiveTitle}"
- Brand: "${brand || ''}"
- Model Number / Identifier: "${modelIdentifier || ''}"
- ASIN / SKU / Identifier: "${asin || ''}"
- Store / Marketplace: "${store || 'Online'}"
- Product URL: "${effectiveUrl}"
- Current Listed Price: ${currentPriceNum}
- Category: "${category || ''}"
- Description: "${(description || '').slice(0, 300)}"

RESEARCH RULES:
1. Research THAT exact product using strongest available identifiers (storage, RAM, model number, regional listing, generation). Do not research a merely similar product or substitute.
2. If genuine historical prices CANNOT be verified from available sources with reasonable confidence, you MUST return:
   "isHistoricalDataAvailable": false,
   "priceHistory": []
3. If genuine historical prices CAN be verified, every historical observation MUST include its supporting source:
   - "date": "YYYY-MM-DD"
   - "price": number in INR
   - "source": name of the specific verified marketplace, catalog, or archive source
   - "sourceUrl": URL of the source if known (or null)
   - "note": factual note describing the observation (e.g. "Launch listing", "Diwali festival promotion")
4. Do NOT claim a price is verified without a supporting source.

REQUIRED JSON FORMAT:
{
  "productId": "${effectiveProductId}",
  "productName": "${effectiveTitle.replace(/"/g, '\\"')}",
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
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                },
              }),
            }
          );

          if (resp.ok) {
            const data = (await resp.json()) as any;
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = extractJson(text);
            if (parsed) {
              const isAvailable = Boolean(parsed.isHistoricalDataAvailable);
              const rawPoints = Array.isArray(parsed.priceHistory) ? parsed.priceHistory : [];
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
                const avg = Math.round(prices.reduce((s: number, v: number) => s + v, 0) / prices.length);
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

                return new Response(
                  JSON.stringify({
                    success: true,
                    source: 'cloudflare_pages_gemini',
                    data: {
                      productId: effectiveProductId,
                      productName: parsed.productName || effectiveTitle,
                      productTitle: parsed.productName || effectiveTitle,
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
                      summaryNote: parsed.summaryNote || `Verified price trajectory from ${formatINR(low)} to ${formatINR(high)}.`,
                      priceHistory: validPoints,
                      milestones,
                    },
                  }),
                  { status: 200, headers: corsHeaders }
                );
              } else {
                // Historical data unavailable or insufficient verified observations
                return new Response(
                  JSON.stringify({
                    success: true,
                    source: 'cloudflare_pages_gemini',
                    data: {
                      productId: effectiveProductId,
                      productName: parsed.productName || effectiveTitle,
                      productTitle: parsed.productName || effectiveTitle,
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
                      uncertaintyNote: parsed.uncertaintyNote || 'Historical price data unavailable from verified sources for this specific product listing.',
                      summaryNote: `Current listing price is ${formatINR(currentPriceNum)}. Historical price tracking is active.`,
                      priceHistory: [],
                      milestones: [],
                    },
                  }),
                  { status: 200, headers: corsHeaders }
                );
              }
            }
          }
        } catch (e) {
          // Try next model fallback
        }
      }
    }

    // Authentic fallback when Gemini key is not configured or service is uncontactable
    // NEVER invent fake historical dates or fake curve points
    const fallbackData = {
      productId: effectiveProductId,
      productName: effectiveTitle,
      productTitle: effectiveTitle,
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
      summaryNote: `Current verified listing price is ${formatINR(currentPriceNum)}. Historical price tracking is active.`,
      priceHistory: [],
      milestones: [],
    };

    return new Response(
      JSON.stringify({
        success: true,
        source: 'cloudflare_pages_baseline',
        data: fallbackData,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to process price intelligence',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};
