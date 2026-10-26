import { drizzle } from 'drizzle-orm/d1';
import { env } from '../lib/env';
import * as schema from './schema';

// 本番の D1 は問い合わせの保存とレート制限だけに使う（作品は src/content/works/ のファイル）
export const db = () => drizzle(env.DB, { schema });
