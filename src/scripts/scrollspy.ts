/** サイドバーの現在地（斜めの帯）をスクロールに追従させる */
export function initScrollSpy() {
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!nav) return;
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('[data-spy]')];
  const sections = links
    .map((a) => document.getElementById(a.dataset.spy!))
    .filter((s): s is HTMLElement => !!s);
  const visible = new Set<string>();

  const setActive = (id: string | null) => {
    let active: HTMLAnchorElement | null = null;
    for (const a of links) {
      const on = a.dataset.spy === id;
      if (on) { a.setAttribute('aria-current', 'location'); active = a; } else a.removeAttribute('aria-current');
    }
    nav.classList.toggle('has-active', !!active);
    if (active) nav.style.setProperty('--band-top', getComputedStyle(active).top);
  };

  // 画面の上 40%〜45% の帯に入っているセクションを現在地とする
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
      const current = sections.find((s) => visible.has(s.id));
      setActive(current?.id ?? null);
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );
  sections.forEach((s) => io.observe(s));
  addEventListener('resize', () => {
    const a = nav.querySelector<HTMLElement>('[aria-current]');
    if (a) nav.style.setProperty('--band-top', getComputedStyle(a).top);
  }, { passive: true });
}
