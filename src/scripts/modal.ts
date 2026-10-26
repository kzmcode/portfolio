import type { WorkView } from '../lib/works';

/** Works タイル → 2 段組モーダル。動画は開いたときに読み込み、閉じたら解放する */
export function initWorkModal() {
  const root = document.getElementById('work-modal');
  const dataEl = document.getElementById('works-data');
  if (!root || !dataEl) return;
  const works = JSON.parse(dataEl.textContent || '[]') as WorkView[];
  const tiles = [...document.querySelectorAll<HTMLButtonElement>('[data-work-index]')];
  if (!works.length || !tiles.length) return;

  const dialog = root.querySelector<HTMLElement>('[role="dialog"]')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('.close')!;
  const slot = (name: string) => dialog.querySelector<HTMLElement>(`.info [data-slot="${name}"]`)!;
  const noPreview = dialog.querySelector<HTMLElement>('[data-no-preview]')!;
  const frames = {
    pc: dialog.querySelector<HTMLElement>('[data-frame="pc"]')!,
    sp: dialog.querySelector<HTMLElement>('[data-frame="sp"]')!,
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1;
  let opener: HTMLElement | null = null;
  let scrollY = 0;

  const releaseVideos = () => {
    dialog.querySelectorAll('video').forEach((v) => {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    });
  };

  const render = (i: number) => {
    const w = works[i];
    current = i;
    dialog.setAttribute('aria-label', `${w.title} のプレビュー`);
    slot('meta').textContent = `${w.num} / ${w.category}`;
    slot('title').textContent = w.title;
    slot('description-en').textContent = w.descriptionEn;
    slot('description-en').hidden = !w.descriptionEn;
    slot('description').textContent = w.description;
    slot('description').hidden = !w.description;
    slot('platform').textContent = w.platform;
    slot('tools').textContent = w.tools;
    slot('date').textContent = w.date;
    // 公開 URL・リポジトリは、ある作品だけボタンを出す
    for (const [name, href] of [['visit', w.url], ['repo', w.repoUrl]] as const) {
      const a = slot(name) as HTMLAnchorElement;
      a.hidden = !href;
      if (href) a.href = href;
      else a.removeAttribute('href');
    }

    releaseVideos();
    frames.pc.hidden = !w.video || w.device !== 'pc';
    frames.sp.hidden = !w.video || w.device !== 'sp';
    noPreview.hidden = !!w.video;
    if (w.video) {
      const screen = frames[w.device].querySelector<HTMLElement>('[data-slot="screen"]')!;
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.autoplay = !reduce.matches;
      v.controls = w.device === 'pc' || reduce.matches;
      v.preload = 'auto';
      v.setAttribute('aria-label', `${w.title} のプレビュー動画`);
      if (w.poster) v.poster = w.poster;
      v.src = w.video;
      screen.replaceChildren(v);
      if (!reduce.matches) v.play().catch(() => {});
    }
    dialog.scrollTop = 0;
  };

  const open = (i: number, from: HTMLElement) => {
    opener = from;
    scrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    root.classList.remove('closing');
    root.hidden = false;
    render(i);
    closeBtn.focus({ preventScroll: true });
  };

  const close = () => {
    if (root.hidden) return;
    releaseVideos();
    const done = () => {
      root.hidden = true;
      root.classList.remove('closing');
      document.documentElement.style.overflow = '';
      window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
      (tiles[current] ?? opener)?.focus({ preventScroll: true });
    };
    if (reduce.matches) return done();
    root.classList.add('closing');
    setTimeout(done, 200);
  };

  const step = (d: number) => render((current + d + works.length) % works.length);

  tiles.forEach((t) => t.addEventListener('click', () => open(Number(t.dataset.workIndex), t)));
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('[data-prev]')!.addEventListener('click', () => step(-1));
  root.querySelector('[data-next]')!.addEventListener('click', () => step(1));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const tag = (e.target as HTMLElement).tagName;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tag !== 'VIDEO') {
      e.preventDefault();
      step(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key === 'Tab') {
      // フォーカストラップ
      const f = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), video[controls], [tabindex="0"]')].filter(
        (el) => !el.closest('[hidden]') && el.offsetParent !== null,
      );
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
