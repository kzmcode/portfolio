// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import localAdmin from './integrations/local-admin.mjs';

const TURNSTILE = 'https://challenges.cloudflare.com';

export default defineConfig({
  site: 'https://kzmcode.dev',
  output: 'server',
  // /privacy を /privacy/ にリダイレクトさせず、そのまま配る
  build: { format: 'file' },
  adapter: cloudflare({ imageService: 'passthrough' }),
  // 管理画面はローカル（astro dev）専用。本番には含めない
  integrations: [localAdmin()],
  // セッションは使わない（KV の自動プロビジョニングを避ける）
  session: false,
  devToolbar: { enabled: false },
  security: {
    checkOrigin: true,
    // Astro が小さなスクリプト・スタイルをインライン化するため、ハッシュ付き CSP を <meta> で出力する。
    // <meta> で指定できない frame-ancestors 等は middleware のヘッダーで付与
    csp: {
      directives: [
        "default-src 'self'",
        `frame-src ${TURNSTILE}`,
        "connect-src 'self'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "font-src 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", TURNSTILE] },
      styleDirective: { resources: ["'self'"] },
    },
  },
});
