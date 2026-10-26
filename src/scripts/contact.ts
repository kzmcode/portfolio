declare global {
  interface Window { turnstile?: { reset(el?: string | HTMLElement): void } }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Turnstile（外部スクリプト）は初期表示に要らないので、フォームが近づくか触れたときに読み込む
function loadTurnstileNear(target: HTMLElement) {
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    io.disconnect();
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    document.head.appendChild(s);
  };
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) load(); }, { rootMargin: '600px 0px' });
  io.observe(target);
  target.addEventListener('focusin', load, { once: true });
}

/** 問い合わせフォームの fetch 送信 */
export function initContact() {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  const thanks = document.getElementById('contact-thanks');
  const errorEl = document.getElementById('contact-error');
  const submit = document.getElementById('contact-submit') as HTMLButtonElement | null;
  const back = document.getElementById('contact-back');
  if (!form || !thanks || !errorEl || !submit || !back) return;
  const label = submit.querySelector<HTMLElement>('[data-label]')!;
  loadTurnstileNear(document.getElementById('contact') ?? form);

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (!form.checkValidity()) {
      const bad = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(':invalid');
      bad?.setAttribute('aria-invalid', 'true');
      bad?.focus();
      showError(bad?.validationMessage || '入力内容を確認してください');
      return;
    }
    const body = Object.fromEntries(new FormData(form));
    if (!body['cf-turnstile-response']) {
      showError('スパム対策の確認が完了していません。数秒おいてから再度お試しください。');
      return;
    }
    submit.disabled = true;
    label.textContent = 'SENDING…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || '送信に失敗しました。時間をおいて再度お試しください。');
      form.reset();
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
    } catch (err) {
      showError(err instanceof Error ? err.message : '送信に失敗しました。');
    } finally {
      submit.disabled = false;
      label.textContent = 'SEND';
      window.turnstile?.reset();
    }
  });

  back.addEventListener('click', (e) => {
    e.preventDefault();
    thanks.hidden = true;
    form.hidden = false;
    form.querySelector<HTMLInputElement>('input')?.focus();
  });
}
