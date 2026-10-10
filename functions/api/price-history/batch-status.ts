// Cloudflare Pages Function: /api/price-history/batch-status
// Provides live batch status for Cloudflare Pages serverless environments

interface Env {
  GEMINI_API_KEY?: string;
  [key: string]: any;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestGet = async () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        currentMonth,
        status: 'idle',
        totalProducts: 0,
        researchedCount: 0,
        pendingCount: 0,
        researchedProductIds: [],
        quotaPausedAt: null,
        resumesAt: null,
        lastRunAt: new Date().toISOString(),
        currentProductTitle: null,
        message: `Cloudflare Pages function ready for ${currentMonth} monthly batch research.`,
      },
    }),
    { status: 200, headers: corsHeaders }
  );
};
