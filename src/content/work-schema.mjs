// @ts-check
/**
 * 作品データ（src/content/works/<slug>/work.yaml）のスキーマ。
 * コンテンツコレクション（content.config.ts）とローカル管理画面の保存処理（integrations/local-admin.mjs）で共有する。
 * zod は呼び出し側から渡す（Astro は astro/zod、Node 側は zod を使うため）。
 */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WORK_CATEGORIES = /** @type {const} */ (['INDIE', 'PROFESSIONAL']);
export const WORK_DEVICES = /** @type {const} */ (['pc', 'sp']);

/** @param {typeof import('zod').z} z */
export function workSchema(z) {
  const text = (/** @type {number} */ max) => z.string().trim().max(max).optional();
  const url = z.url({ protocol: /^https?$/, error: 'URL は http(s):// から入力してください' }).max(500).optional();
  return z.object({
    title: z.string().trim().min(1, 'タイトルを入力してください').max(120),
    category: z.enum(WORK_CATEGORIES),
    device: z.enum(WORK_DEVICES),
    platform: text(100), // 空なら device から既定表記
    tools: text(200),
    year: z.coerce.string().regex(/^\d{4}$/, '年は西暦4桁で入力してください'),
    month: z.number().int().min(1, '月は1〜12で選んでください').max(12, '月は1〜12で選んでください').optional(),
    url,
    repoUrl: url,
    published: z.boolean(),
    addedAt: z.coerce.date(), // 同じ年月の作品の並び順（新しい順）に使う
    descriptionEn: text(4000),
    description: text(4000), // 日本語
  });
}
