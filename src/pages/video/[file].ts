import type { APIRoute } from 'astro';
import { waitUntil } from 'cloudflare:workers';
import { env } from '../../lib/env';

export const prerender = false;

// 静的アセットの配信は Range に 206 で応えない（常に全体を 200 で返す）ため、Safari では動画が再生されない。
// プレビュー動画だけはこのルートを通し、/_astro/ の静的ファイルを切り出して 206 で返す
const RANGE_RE = /^bytes=(\d*)-(\d*)$/;

export const GET: APIRoute = async ({ params, request }) => {
  const file = params.file ?? '';
  if (!/^[\w.-]+\.mp4$/.test(file)) return new Response('Not found', { status: 404 });

  // 1 回目に全体をエッジのキャッシュへ入れ、以降の Range はキャッシュが 206 で返す（毎回全体を読み込まない）
  const cache = (caches as unknown as { default: Cache }).default; // DOM の型と重なるため Workers の caches.default を明示
  const key = new URL(`/video/${file}`, request.url).toString();
  const range = request.headers.get('range');
  const hit = await cache.match(new Request(key, { headers: range ? { range } : {} }));
  if (hit) return hit;

  const asset = await env.ASSETS.fetch(new URL(`/_astro/${file}`, request.url));
  if (!asset.ok) return new Response('Not found', { status: 404 });
  const body = await asset.arrayBuffer();
  const size = body.byteLength;

  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable', // ファイル名にハッシュが付くので不変
  });

  headers.set('Content-Length', String(size));
  waitUntil(cache.put(key, new Response(body.slice(0), { status: 200, headers })));

  const m = range?.match(RANGE_RE);
  if (!m || (!m[1] && !m[2])) return new Response(body, { status: 200, headers });
  // bytes=start-end / bytes=start- / bytes=-suffix
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size || start > end) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
};
