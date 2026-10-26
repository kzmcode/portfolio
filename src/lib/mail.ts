import { env } from './env';
import type { ContactInput } from './validation';

// 問い合わせの通知メール。Email Routing で検証済みの宛先（CONTACT_TO）に、send_email バインディングで送る
export async function notifyContact(input: ContactInput) {
  await env.SEND_EMAIL.send({
    from: { email: env.CONTACT_FROM, name: 'kzmcode.dev' },
    to: env.CONTACT_TO,
    replyTo: input.email, // 返信すると送信者に届く
    subject: `[Portfolio] ${input.name} さんからメッセージ`,
    text: [`お名前: ${input.name}`, `メール: ${input.email}`, '', input.message].join('\n'),
  });
}
