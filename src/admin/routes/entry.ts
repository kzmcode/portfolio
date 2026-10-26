import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { workMedia } from '../../lib/media';

export const prerender = false;

// dev 専用：画面側に今見えている作品データと動画・ポスターの有無を返す。
// 保存処理（integrations/local-admin.mjs）が、書き込んだ内容が反映されたかの確認に使う
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? '';
  const entry = await getEntry('works', slug);
  const media = workMedia(slug);
  return new Response(JSON.stringify({ data: entry?.data ?? null, video: !!media.video, poster: !!media.poster }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
