import { getCollection, type CollectionEntry } from 'astro:content';
import { workMedia } from './media';

export type WorkEntry = CollectionEntry<'works'>;
type WorkData = WorkEntry['data'];

export interface WorkView {
  slug: string;
  num: string;
  title: string;
  category: string;
  device: WorkData['device'];
  platform: string;
  descriptionEn: string;
  description: string;
  tools: string;
  date: string; // 2026.01（月が無ければ 2026）
  url: string | null;
  repoUrl: string | null;
  video: string | null;
  poster: string | null;
}

export const PLATFORM_LABEL: Record<WorkData['device'], string> = {
  pc: 'Desktop',
  sp: 'Mobile (iOS / Android)',
};

export const formatDate = (w: Pick<WorkData, 'year' | 'month'>) =>
  w.month ? `${w.year}.${String(w.month).padStart(2, '0')}` : w.year;

// 新しい順：制作年 → 月（未入力は後ろ）→ 追加日時
const newestFirst = (a: WorkEntry, b: WorkEntry) =>
  b.data.year.localeCompare(a.data.year) ||
  (b.data.month ?? 0) - (a.data.month ?? 0) ||
  b.data.addedAt.getTime() - a.data.addedAt.getTime() ||
  a.id.localeCompare(b.id);

/** 作品を新しい順に返す。管理画面は非公開も含める */
export async function listWorks({ drafts = false } = {}) {
  const all = await getCollection('works', (w) => drafts || w.data.published);
  return all.sort(newestFirst);
}

// No. は古い順の通し番号（一番古い公開作品が 01）。新しい作品を足しても既存の番号は変わらない。
// works は新しい順に並んでいる前提
export const workNum = (i: number, total: number) => String(total - i).padStart(2, '0');

export function toView(w: WorkEntry, i: number, all: WorkEntry[]): WorkView {
  const d = w.data;
  return {
    slug: w.id,
    num: workNum(i, all.length),
    title: d.title,
    category: d.category,
    device: d.device,
    platform: d.platform || PLATFORM_LABEL[d.device],
    descriptionEn: d.descriptionEn ?? '',
    description: d.description ?? '',
    tools: d.tools ?? '',
    date: formatDate(d),
    url: d.url ?? null,
    repoUrl: d.repoUrl ?? null,
    ...workMedia(w.id),
  };
}
