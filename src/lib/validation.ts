import { z } from 'zod';

// 問い合わせフォームの入力検証

export const contactInput = z.object({
  name: z.string().trim().min(1, 'お名前（ニックネームでも OK）を入力してください').max(100, 'お名前は100文字以内で入力してください'),
  email: z.email('メールアドレスの形式が正しくありません').max(254),
  message: z.string().trim().min(1, 'メッセージを入力してください').max(4000, 'メッセージは4000文字以内で入力してください'),
});
export type ContactInput = z.infer<typeof contactInput>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? '入力内容を確認してください';
}
