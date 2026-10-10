// Cloudflare Pages Function: /api/price-history/run-batch
// Handles batch research requests on Cloudflare Pages environments

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

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return new Response(
    JSON.stringify({
      success: true,
      message: `Batch research request acknowledged for ${currentMonth}. Client background research loop active.`,
      state: {
        currentMonth,
        status: 'researching',
        totalProducts: 0,
        researchedCount: 0,
        pendingCount: 0,
        researchedProductIds: [],
        quotaPausedAt: null,
        resumesAt: null,
        lastRunAt: new Date().toISOString(),
        currentProductTitle: null,
        message: `Batch research active for ${currentMonth}.`,
      },
    }),
    { status: 200, headers: corsHeaders }
  );
};
