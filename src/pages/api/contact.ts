import type { APIRoute } from 'astro';
import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { contactMessages } from '../../db/schema';
import { badRequest, json, readBody, sha256Hex } from '../../lib/http';
import { notifyContact } from '../../lib/mail';
import { verifyTurnstile } from '../../lib/turnstile';
import { contactInput, firstIssue } from '../../lib/validation';

export const prerender = false;

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;

// トップは静的ページなので、フォームは contact.ts から JSON で送る（Turnstile も JS 必須）
export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readBody(request).catch(() => null);
  if (!body) return badRequest('リクエストの形式が正しくありません');

  const ip = request.headers.get('cf-connecting-ip');
  const token = typeof body['cf-turnstile-response'] === 'string' ? body['cf-turnstile-response'] : undefined;
  if (!(await verifyTurnstile(token, ip))) return badRequest('スパム対策の確認に失敗しました。ページを再読み込みしてもう一度お試しください。');

  const parsed = contactInput.safeParse(body);
  if (!parsed.success) return badRequest(firstIssue(parsed.error));
  const input = parsed.data;

  const ipHash = ip ? await sha256Hex(`portfolio:${ip}`) : null;
  if (ipHash) {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const [row] = await db()
      .select({ n: count() })
      .from(contactMessages)
      .where(and(eq(contactMessages.ipHash, ipHash), gt(contactMessages.createdAt, since)));
    if ((row?.n ?? 0) >= RATE_LIMIT) return json({ ok: false, error: '短時間に送信が集中しています。しばらく時間をおいてから再度お試しください。' }, { status: 429 });
  }

  await db().insert(contactMessages).values({
    name: input.name,
    email: input.email,
    message: input.message,
    ipHash,
    userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  });

  const mail = notifyContact(input).catch((e) => console.error('[contact] mail failed', e));
  if (locals.cfContext) locals.cfContext.waitUntil(mail);
  else await mail;

  return json({ ok: true });
};
