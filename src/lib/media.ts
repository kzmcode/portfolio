/**
 * 作品の動画・ポスターはリポジトリに置き、デプロイで静的アセットとして配信する（R2 は使わない）。
 *   src/content/works/<slug>/preview.mp4             … モーダルのプレビュー動画
 *   src/content/works/<slug>/poster.(webp|jpg|png)   … カード背景・動画の poster
 * ビルド時に URL（ハッシュ付き・長期キャッシュ）へ解決される。差し替えたら再デプロイ。
 */
const files = import.meta.glob<string>('/src/content/works/*/{preview.mp4,poster.webp,poster.jpg,poster.png}', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

const bySlug = new Map<string, { video: string | null; poster: string | null }>();
for (const [path, url] of Object.entries(files)) {
  const [, slug, name] = path.match(/\/works\/([^/]+)\/(preview|poster)\./) ?? [];
  if (!slug) continue;
  const entry = bySlug.get(slug) ?? { video: null, poster: null };
  if (name === 'preview') {
    // 本番の動画は Range（206）に応える /video/ ルート経由で配る（src/pages/video/[file].ts）
    entry.video = import.meta.env.DEV ? url : `/video/${url.split('/').pop()}`;
  } else {
    entry.poster = url;
  }
  bySlug.set(slug, entry);
}

export const workMedia = (slug: string) => bySlug.get(slug) ?? { video: null, poster: null };
