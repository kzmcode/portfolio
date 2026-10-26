/**
 * Cloudflare バインディング・環境変数の取り出しはここだけで行う。
 * @astrojs/cloudflare v13+ では `cloudflare:workers` の `env` を直接 import する
 * （`Astro.locals.runtime` は廃止）。型は `wrangler types` が生成する Env。
 */
import { env as cfEnv } from 'cloudflare:workers';

export type AppEnv = Env & {
  ASSETS: Fetcher; // 静的アセット（アダプターが付与し、wrangler.jsonc には書かない）
};

export const env = cfEnv as AppEnv;
