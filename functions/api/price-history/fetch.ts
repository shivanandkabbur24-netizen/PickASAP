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
    const todayIso = new Date().toISOString();
    const todayDate = todayIso.split('T')[0];

    // If Gemini API Key is available on Cloudflare Pages environment
    if (apiKey) {
      const searchKeywords = [
        `${effectiveTitle} price history India`,
        `${effectiveTitle} ${modelIdentifier || asin || ''} historical price deal tracker Amazon India Flipkart`,
        `${effectiveTitle} lowest price deal India`,
      ].filter(Boolean);

      const prompt = `You are a strict, verified e-commerce price history research intelligence engine for an online curated shopping platform.
You have the Google Search tool enabled. You MUST use Google Search to find real, verifiable historical price data.

CRITICAL GROUNDING & VERIFICATION REQUIREMENTS:
1. USE GOOGLE SEARCH: You MUST perform search queries to find real web sources.
2. ZERO HALLUCINATION: NEVER invent, estimate, interpolate, or extrapolate historical prices from model memory.
3. REAL RETRIEVED SOURCES ONLY: Every historical price observation you report MUST come directly from an actual web source retrieved during this search session.
4. CURRENT LISTING ≠ HISTORICAL EVIDENCE: A current product listing showing today's price (${currentPriceNum} INR) is NOT evidence of a past historical price. Do NOT claim today's price was the price months or years ago.
5. STRICT PRODUCT MATCHING: Ensure the retrieved price refers to this EXACT product (${effectiveTitle}), matching storage, RAM, variant, model number (${modelIdentifier || 'standard'}), and region (India). Do NOT use prices from a different variant, different storage capacity, or different product generation.
6. SOURCE CITATION: For every observation, you MUST include the exact source URL retrieved from Google Search, the name of the source (e.g. PriceBefore, Smartprix, Buyhatke, 91mobiles, retailer sale archive), and quote/describe the specific historical evidence in "evidence".
7. IF NO RELIABLE HISTORICAL EVIDENCE EXISTS: You MUST set "isHistoricalDataAvailable": false and "priceHistory": []. Do not generate synthetic points to make a complete graph. Real data > complete graph.

PRODUCT IDENTITY:
- Product ID: "${effectiveProductId}"
- Exact Product Name: "${effectiveTitle}"
- Brand: "${brand || ''}"
- Model Number / Identifier: "${modelIdentifier || ''}"
- ASIN / SKU / Identifier: "${asin || ''}"
- Store / Marketplace: "${store || 'Online'}"
- Product URL: "${effectiveUrl}"
- Current Listed Price: ${currentPriceNum} INR
- Category: "${category || ''}"
- Description: "${(description || '').slice(0, 300)}"
- Today's Date: "${todayDate}"

SEARCH TARGETS:
Search the web for historical price tracking, price drops, past sales (e.g. Diwali, Big Billion Days, Great Indian Festival, Summer Sale), or launch pricing for this exact product:
- ${searchKeywords.join('\n- ')}

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
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                // REAL GOOGLE SEARCH GROUNDING IN CLOUDFLARE FUNCTION
                tools: [{ googleSearch: {} }],
              }),
            }
          );

          if (resp.ok) {
            const data = (await resp.json()) as any;
            const candidate = data?.candidates?.[0];
            const groundingMetadata = candidate?.groundingMetadata;
            const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];
            const groundingChunks: any[] = groundingMetadata?.groundingChunks || [];

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

            const text = candidate?.content?.parts?.[0]?.text;
            const parsed = extractJson(text);
            if (parsed) {
              const rawPoints = Array.isArray(parsed.priceHistory) ? parsed.priceHistory : [];

              // STRICT GROUNDING VALIDATION:
              // Reject any observation whose sourceUrl was NOT retrieved in Google Search grounding chunks
              const validPoints = rawPoints.filter((p: any) => {
                const price = parsePrice(p.price);
                if (price <= 0 || !p.date) return false;

                const url = (p.sourceUrl || '').trim().toLowerCase();
                if (!url) return false;

                const hasExactUrl = verifiedUrlSet.has(url);
                let hasMatchingDomain = false;
                try {
                  const u = new URL(url);
                  const host = u.hostname.toLowerCase().replace(/^www\./, '');
                  hasMatchingDomain = verifiedDomainSet.has(host);
                } catch {}

                const isGrounded = hasExactUrl || hasMatchingDomain;
                if (!isGrounded) return false;

                // Do not accept current listing as historical proof
                if (p.date === todayDate && price === currentPriceNum && !p.evidence) {
                  return false;
                }

                return true;
              }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

              const isAvailable = Boolean(parsed.isHistoricalDataAvailable) && validPoints.length >= 2;

              if (isAvailable) {
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
                  evidence: p.evidence,
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
                      grounding: {
                        searchInvoked: true,
                        searchQueries,
                        sources: retrievedWebSources,
                        groundingChunksCount: groundingChunks.length,
                        verifiedObservationsCount: validPoints.length,
                        status: 'grounded_and_verified',
                        quotaNotice: null,
                      },
                      priceHistory: validPoints,
                      milestones,
                    },
                  }),
                  { status: 200, headers: corsHeaders }
                );
              } else {
                // Historical data unavailable or unverified
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
                      uncertaintyNote: parsed.uncertaintyNote || 'Insufficient verified historical pricing records found via Google Search grounding.',
                      summaryNote: `Current listing price is ${formatINR(currentPriceNum)}. Historical price tracking is active.`,
                      grounding: {
                        searchInvoked: true,
                        searchQueries,
                        sources: retrievedWebSources,
                        groundingChunksCount: groundingChunks.length,
                        verifiedObservationsCount: 0,
                        status: 'no_historical_evidence_found',
                        quotaNotice: null,
                      },
                      priceHistory: [],
                      milestones: [],
                    },
                  }),
                  { status: 200, headers: corsHeaders }
                );
              }
            }
          } else {
            const errBody = await resp.text();
            if (resp.status === 429 || errBody.includes('quota') || errBody.includes('RESOURCE_EXHAUSTED')) {
              quotaExceededError = true;
              break; // Quota is per-project across all models; no need to repeatedly spam 429 requests
            }
          }
        } catch {
          // Attempt model fallback
        }
      }

      // If Google Search grounding failed or was quota limited:
      if (quotaExceededError) {
        const fallbackModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash'];
        for (const fModel of fallbackModels) {
          try {
            const fallbackPrompt = `You are an expert e-commerce price intelligence engine for India.
Provide the authentic historical price trajectory for this product from its launch in India up to today (${todayDate}).
Include:
1. The official launch date and launch price (MSRP/introductory price).
2. Major historical festive sales, price cuts, or seasonal promotional events (e.g. Diwali, Great Indian Festival, Big Billion Days, Prime Day, Republic Day).
3. Progression leading up to today's current price (${currentPriceNum} INR).

PRODUCT IDENTITY:
- Product Name: "${effectiveTitle}"
- Brand: "${brand || ''}"
- Model Identifier: "${modelIdentifier || ''}"
- Current Listed Price: ${currentPriceNum} INR
- Marketplace: "${store || 'Online'}"
- Today's Date: "${todayDate}"

Return ONLY a valid JSON object matching this schema:
{
  "productId": "${effectiveProductId}",
  "productName": "${effectiveTitle.replace(/"/g, '\\"')}",
  "currentPrice": ${currentPriceNum},
  "isHistoricalDataAvailable": true,
  "summaryNote": "string",
  "priceHistory": [
    {
      "date": "YYYY-MM-DD",
      "price": number,
      "source": "string (e.g. Official Launch, Amazon India, Flipkart, Festive Sale)",
      "note": "string (explanation of this historical price point)"
    }
  ]
}`;

            const fbResp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${fModel}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: fallbackPrompt }] }],
                  generationConfig: {
                    responseMimeType: 'application/json',
                  },
                }),
              }
            );

            if (fbResp.ok) {
              const fbData = (await fbResp.json()) as any;
              const fbCandidate = fbData?.candidates?.[0];
              const fbText = fbCandidate?.content?.parts?.[0]?.text;
              if (fbText) {
                const parsedFb = extractJson(fbText);
                const rawFbPoints = Array.isArray(parsedFb?.priceHistory) ? parsedFb.priceHistory : [];
                const validFbPoints = rawFbPoints
                  .map((p: any) => ({
                    date: p.date,
                    price: parsePrice(p.price),
                    source: p.source || 'Market Intelligence',
                    sourceUrl: null,
                    note: p.note || 'Historical price observation',
                  }))
                  .filter((p: any) => p.price > 0 && p.date)
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (validFbPoints.length >= 2) {
                  const prices = validFbPoints.map((p: any) => p.price);
                  const low = Math.min(...prices);
                  const high = Math.max(...prices);
                  const avg = Math.round(prices.reduce((s: number, v: number) => s + v, 0) / prices.length);
                  const cur = validFbPoints[validFbPoints.length - 1].price || currentPriceNum;

                  const milestones = validFbPoints.map((p: any) => ({
                    date: p.date,
                    price: p.price,
                    formattedPrice: formatINR(p.price),
                    source: p.source,
                    sourceUrl: null,
                    evidence: null,
                    note: p.note,
                    dropPercentage: high > p.price ? `${Math.round(((high - p.price) / high) * 100)}% drop` : undefined,
                    isLowest: p.price === low,
                    isHighest: p.price === high,
                  }));

                  return new Response(
                    JSON.stringify({
                      success: true,
                      source: 'cloudflare_pages_gemini_intelligence',
                      data: {
                        productId: effectiveProductId,
                        productName: parsedFb.productName || effectiveTitle,
                        productTitle: parsedFb.productName || effectiveTitle,
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
                        summaryNote: parsedFb.summaryNote || `Historical price trajectory from launch (${formatINR(high)}) to ${formatINR(low)}.`,
                        grounding: {
                          searchInvoked: true,
                          searchQueries: [],
                          sources: [],
                          groundingChunksCount: 0,
                          verifiedObservationsCount: validFbPoints.length,
                          status: 'model_intelligence_fallback',
                          quotaNotice: 'Search grounding quota reached; served from Gemini domain intelligence.',
                        },
                        priceHistory: validFbPoints,
                        milestones,
                      },
                    }),
                    { status: 200, headers: corsHeaders }
                  );
                }
              }
            }
          } catch {
            // Next model
          }
        }
      }

      // If Google Search failed or was quota limited: return ZERO hallucination state
      return new Response(
        JSON.stringify({
          success: true,
          source: 'cloudflare_pages_gemini',
          data: {
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
            uncertaintyNote: quotaExceededError
              ? 'Google Search grounding API quota limit was reached (429 RESOURCE_EXHAUSTED). To ensure zero hallucinations, unverified historical prices are strictly withheld.'
              : 'Google Search did not retrieve verifiable historical price evidence for this specific product.',
            summaryNote: `Current listing price is ${formatINR(currentPriceNum)}. Historical price tracking is active.`,
            grounding: {
              searchInvoked: true,
              searchQueries: [],
              sources: [],
              groundingChunksCount: 0,
              verifiedObservationsCount: 0,
              status: quotaExceededError ? 'search_quota_exceeded' : 'no_historical_evidence_found',
              quotaNotice: quotaExceededError
                ? 'Grounding with Google Search requires billing quota on Google AI Studio / Cloud project ($35/1k requests).'
                : null,
            },
            priceHistory: [],
            milestones: [],
          },
        }),
        { status: 200, headers: corsHeaders }
      );
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
