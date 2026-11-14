/**
 * 作品の動画・ポスターはリポジトリに置き、デプロイで静的アセットとして配信する（R2 は使わない）。
 *   src/content/works/<slug>/preview.mp4             … モーダルのプレビュー動画
 *   src/content/works/<slug>/poster.(webp|jpg|png)   … カード背景
 *   src/content/works/<slug>/frame.webp              … 動画の 1 コマ目（モーダルの動画の poster。管理画面で動画を登録すると自動で作る）
 * ビルド時に URL（ハッシュ付き・長期キャッシュ）へ解決される。差し替えたら再デプロイ。
 */
const files = import.meta.glob<string>('/src/content/works/*/{preview.mp4,frame.webp,poster.webp,poster.jpg,poster.png}', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

type Media = { video: string | null; poster: string | null; frame: string | null };
const bySlug = new Map<string, Media>();
for (const [path, url] of Object.entries(files)) {
  const [, slug, name] = path.match(/\/works\/([^/]+)\/(preview|poster|frame)\./) ?? [];
  if (!slug) continue;
  const entry = bySlug.get(slug) ?? { video: null, poster: null, frame: null };
  if (name === 'preview') {
    // 本番の動画は Range（206）に応える /video/ ルート経由で配る（src/pages/video/[file].ts）
    entry.video = import.meta.env.DEV ? url : `/video/${url.split('/').pop()}`;
  } else if (name === 'frame') {
    entry.frame = url;
  } else {
    entry.poster = url;
  }
  bySlug.set(slug, entry);
}

export const workMedia = (slug: string): Media => bySlug.get(slug) ?? { video: null, poster: null, frame: null };
