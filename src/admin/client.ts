// 管理画面の共通処理。保存先は integrations/local-admin.mjs の /__dev/*（X-Dev-Admin ヘッダー必須）
export async function api<T = unknown>(url: string, opts: { method: string; body?: unknown; raw?: BodyInit; type?: string }): Promise<T> {
  const res = await fetch(url, {
    method: opts.method,
    headers: { 'X-Dev-Admin': '1', 'Content-Type': opts.raw ? (opts.type ?? 'application/octet-stream') : 'application/json' },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function flash(msg: string, error = false) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', error);
  el.hidden = false;
  el.setAttribute('role', error ? 'alert' : 'status');
}
