import { site } from '../content/site';
import type { WorkView } from './works';

/**
 * トップの構造化データ（JSON-LD / schema.org）。検索エンジンに「サイト・人物・作品」の関係を伝える。
 * 画像や URL は絶対 URL にする。
 */
export function homeJsonLd(works: WorkView[], origin: URL) {
  const abs = (path: string) => new URL(path, origin).toString();
  const home = abs('/');
  const personId = `${home}#person`;

  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${home}#website`,
      url: home,
      name: site.seoTitle,
      description: site.description,
      inLanguage: site.lang,
      author: { '@id': personId },
    },
    {
      '@type': 'Person',
      '@id': personId,
      name: site.name,
      url: home,
      jobTitle: site.about.role,
      description: site.about.messageEn,
      image: abs(site.about.portrait),
      sameAs: site.sns.map((s) => s.href),
    },
    {
      '@type': 'ItemList',
      '@id': `${home}#works`,
      name: 'Works',
      itemListElement: works.map((w, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'CreativeWork',
          name: w.title,
          description: w.descriptionEn || w.description || undefined,
          genre: w.category,
          dateCreated: w.date.replace('.', '-'),
          keywords: w.tools || undefined,
          url: w.url ?? w.repoUrl ?? undefined,
          image: w.poster ? abs(w.poster) : undefined,
          creator: { '@id': personId },
        },
      })),
    },
  ];
  return { '@context': 'https://schema.org', '@graph': graph };
}
