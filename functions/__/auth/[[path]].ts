// Cloudflare Pages Function: Proxy Firebase Auth requests for custom domain authDomain: "pickasap.shop"
// This proxies https://pickasap.shop/__/auth/* requests (e.g. /__/auth/handler, /__/auth/experiments.js)
// to https://pickasap-c43b0.firebaseapp.com/__/auth/* so the Google Sign-in popup runs on pickasap.shop

interface PagesFunctionContext {
  request: Request;
  env?: Record<string, unknown>;
  params?: Record<string, string | string[]>;
}

export const onRequest = async (context: PagesFunctionContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://pickasap-c43b0.firebaseapp.com');

  const reqHeaders = new Headers(context.request.headers);
  reqHeaders.set('Host', 'pickasap-c43b0.firebaseapp.com');

  try {
    const response = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers: reqHeaders,
      body: context.request.body,
      redirect: 'follow',
    });

    const resHeaders = new Headers(response.headers);
    // Allow credentials and frame options for OAuth popup
    resHeaders.set('Access-Control-Allow-Origin', url.origin);
    resHeaders.set('Access-Control-Allow-Credentials', 'true');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch {
    return new Response('Firebase Auth Proxy Error', { status: 502 });
  }
};
