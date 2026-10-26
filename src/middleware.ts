import { defineMiddleware } from 'astro:middleware';

// SSR で返すレスポンス（/api/contact・404 など）用。静的に配る HTML・アセットのヘッダーは public/_headers
// script-src / style-src などは astro.config.mjs の security.csp が出力し、ここでは <meta> で効かない指示を足す
const CSP = ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"].join('; ');

export const onRequest = defineMiddleware(async (_context, next) => {
  // fetch() 由来など immutable なレスポンスに備えてコピーする
  const res = await next();
  const out = new Response(res.body, res);
  const h = out.headers;
  if ((h.get('content-type') ?? '').includes('text/html')) {
    const base = h.get('Content-Security-Policy');
    h.set('Content-Security-Policy', base ? `${base.replace(/;\s*$/, '')}; ${CSP}` : CSP);
  }
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  h.set('X-Frame-Options', 'DENY');
  if (!import.meta.env.DEV) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return out;
});
