import { env } from './env';

export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    console.warn('[turnstile] TURNSTILE_SECRET が未設定');
    return false;
  }
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
