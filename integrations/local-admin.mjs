// @ts-check
/**
 * ローカル専用の管理画面。`astro dev` のときだけルートを追加し、本番ビルドには一切含めない。
 *   /admin, /admin/works/new, /admin/works/:slug   作品の一覧・作成・編集（画面は src/admin/routes/）
 *   /__dev/works, /__dev/works/:slug               作品の作成（POST）・更新（PATCH）・削除（DELETE）
 *   /__dev/media?slug=&kind=video|poster           動画・ポスターの保存（PUT）・削除（DELETE）
 * 保存先は src/content/works/<slug>/（work.yaml・preview.mp4・poster.*）。ファイルの書き込みは Node 側のここで行う。
 * 編集した内容は `pnpm run deploy` で本番に反映する（トップはビルド時にコンテンツコレクションから静的生成）。
 */
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import { SLUG_RE, workSchema } from '../src/content/work-schema.mjs';

const MAX_BYTES = 25 * 1024 * 1024; // 静的アセットの 1 ファイル上限
const KINDS = {
  video: { base: 'preview', types: { 'video/mp4': 'mp4' } },
  poster: { base: 'poster', types: { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' } },
};
// YAML に書く順番（読みやすさのため）
const FIELD_ORDER = ['title', 'category', 'device', 'platform', 'tools', 'year', 'month', 'url', 'repoUrl', 'published', 'addedAt', 'descriptionEn', 'description'];
const schema = workSchema(z);

/** @param {import('node:http').IncomingMessage} req */
async function readBody(req, limit = MAX_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('ファイルは 25MB までです'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * フォームの値（すべて文字列）を YAML 用の値に直す。空欄は項目ごと消す
 * @param {Record<string, unknown>} form
 */
function fromForm(form) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, raw] of Object.entries(form)) {
    if (k === 'slug') continue;
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (v === '' || v == null) out[k] = undefined;
    else if (k === 'month') out[k] = Number(v);
    else if (k === 'published') out[k] = v === true || v === 'true';
    else out[k] = v;
  }
  return out;
}

/** @param {Record<string, unknown>} data */
const toYaml = (data) => {
  /** @type {Record<string, unknown>} */
  const ordered = {};
  for (const k of FIELD_ORDER) if (data[k] !== undefined) ordered[k] = data[k] instanceof Date ? data[k].toISOString() : data[k];
  return stringify(ordered, { lineWidth: 0 });
};

const exists = (/** @type {string} */ p) => stat(p).then(() => true, () => false);

/** @returns {import('astro').AstroIntegration} */
export default function localAdmin() {
  return {
    name: 'local-admin',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        /** @param {string} pattern @param {string} file */
        const route = (pattern, file) => injectRoute({ pattern, entrypoint: `./src/admin/routes/${file}`, prerender: false });
        route('/admin', 'index.astro');
        route('/admin/works/new', 'new.astro');
        route('/admin/works/[slug]', 'edit.astro');
        route('/admin/__entry/[slug]', 'entry.ts');
      },
      'astro:server:setup': ({ server }) => {
        const root = join(server.config.root, 'src/content/works');
        // ファイルを書き換えたあと、画面側にその内容が反映されるまで待ってから応答する（最大 5 秒）。
        // 待たないと、直後に開いた画面に古い内容や 404 が出る
        /** @param {string} origin @param {string} slug @param {(state: { data: unknown; video: boolean; poster: boolean }) => boolean} ok */
        const reflected = async (origin, slug, ok) => {
          for (let i = 0; i < 50; i++) {
            const state = await fetch(`${origin}/admin/__entry/${slug}`).then((r) => r.json(), () => null);
            if (state && ok(state)) return;
            await new Promise((r) => setTimeout(r, 100));
          }
        };
        /** @param {unknown} expected */
        const hasData = (expected) => (/** @type {{ data: unknown }} */ { data }) => JSON.stringify(data) === JSON.stringify(expected);

        // ファイルを書き換えると dev サーバーが開いているページに全体の再読み込みを送り、保存中の fetch が中断される。
        // 保存処理の間はそれを止める（保存後は管理画面が自分で遷移・再読み込みする）
        let saving = 0;
        const hot = server.environments.client.hot;
        const sendHot = hot.send.bind(hot);
        hot.send = /** @type {typeof hot.send} */ ((/** @type {any} */ payload, /** @type {any} */ data) => {
          if (saving && typeof payload === 'object' && payload?.type === 'full-reload') return;
          return sendHot(payload, data);
        });

        server.middlewares.use('/__dev', async (req, res) => {
          /** @param {number} status @param {object} body */
          const send = (status, body) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(body));
          };
          saving++;
          res.on('close', () => setTimeout(() => saving--, 1000));
          try {
            // 他のサイトから localhost を叩かれないよう、同じオリジン＋専用ヘッダーのときだけ受け付ける
            const host = req.headers.host;
            if (req.headers['x-dev-admin'] !== '1' || (req.headers.origin && new URL(req.headers.origin).host !== host)) {
              return send(403, { ok: false, error: 'forbidden' });
            }
            const url = new URL(req.url ?? '', `http://${host}`);
            const [, area, param] = url.pathname.split('/'); // /works/:slug や /media

            // ---- 作品（work.yaml）----
            if (area === 'works') {
              if (param && !SLUG_RE.test(param)) return send(400, { ok: false, error: 'slug が不正です' });
              const dir = param ? join(root, param) : '';
              if (req.method === 'DELETE') {
                if (!(await exists(dir))) return send(404, { ok: false, error: 'not found' });
                await rm(dir, { recursive: true });
                await reflected(url.origin, param, hasData(null));
                return send(200, { ok: true });
              }
              const form = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
              const slug = String(form.slug ?? param ?? '').trim();
              if (!SLUG_RE.test(slug)) return send(400, { ok: false, error: 'slug は半角英小文字・数字・ハイフンのみ' });

              let base = {};
              if (req.method === 'POST') {
                base = { addedAt: new Date() };
              } else if (req.method === 'PATCH' && param) {
                if (!(await exists(join(dir, 'work.yaml')))) return send(404, { ok: false, error: 'not found' });
                base = parse(await readFile(join(dir, 'work.yaml'), 'utf8'));
              } else {
                return send(405, { ok: false, error: 'method not allowed' });
              }
              const parsed = schema.safeParse({ ...base, ...fromForm(form) });
              if (!parsed.success) return send(400, { ok: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' });

              const target = join(root, slug);
              if (slug !== param && (await exists(target))) return send(400, { ok: false, error: '同じ slug の作品が既にあります' });
              if (param && slug !== param) await rename(dir, target); // slug を変えたらフォルダごと（動画・ポスターも）移す
              await mkdir(target, { recursive: true });
              await writeFile(join(target, 'work.yaml'), toYaml(parsed.data));
              await Promise.all([reflected(url.origin, slug, hasData(parsed.data)), param && slug !== param ? reflected(url.origin, param, hasData(null)) : null]);
              return send(req.method === 'POST' ? 201 : 200, { ok: true, slug });
            }

            // ---- 動画・ポスター ----
            if (area === 'media') {
              const slug = url.searchParams.get('slug') ?? '';
              const kind = /** @type {keyof typeof KINDS | null} */ (url.searchParams.get('kind'));
              if (!SLUG_RE.test(slug)) return send(400, { ok: false, error: 'slug が不正です' });
              if (!kind || !(kind in KINDS)) return send(400, { ok: false, error: 'kind は video か poster' });
              const { base, types } = KINDS[kind];
              const dir = join(root, slug);
              if (!(await exists(join(dir, 'work.yaml')))) return send(404, { ok: false, error: '作品が見つかりません' });
              // 同じ種類の既存ファイル（poster.webp / poster.png など）を消す
              const clear = async () => {
                const names = await readdir(dir).catch(() => []);
                await Promise.all(names.filter((n) => n.startsWith(`${base}.`)).map((n) => rm(join(dir, n))));
              };
              if (req.method === 'DELETE') {
                await clear();
                await reflected(url.origin, slug, (state) => !state[kind]);
                return send(200, { ok: true });
              }
              if (req.method !== 'PUT') return send(405, { ok: false, error: 'method not allowed' });
              const type = (req.headers['content-type'] ?? '').split(';')[0].trim();
              const ext = /** @type {Record<string, string>} */ (types)[type];
              if (!ext) return send(400, { ok: false, error: `未対応の形式です: ${type || '(none)'}` });
              const body = await readBody(req);
              if (!body.length) return send(400, { ok: false, error: '空のファイルです' });
              await clear();
              const file = `${base}.${ext}`;
              await writeFile(join(dir, file), body);
              await reflected(url.origin, slug, (state) => state[kind]);
              return send(201, { ok: true, path: `src/content/works/${slug}/${file}` });
            }

            return send(404, { ok: false, error: 'not found' });
          } catch (e) {
            const status = /** @type {{ status?: number }} */ (e).status ?? 500;
            return send(status, { ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        });
      },
    },
  };
}
