export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...init.headers },
  });

export const badRequest = (error: string) => json({ ok: false, error }, { status: 400 });

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const data = await request.json().catch(() => null);
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form) if (typeof v === 'string') out[k] = v;
  return out;
}

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
