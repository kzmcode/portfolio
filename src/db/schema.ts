import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// migrations/ の最新状態と一致させること
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const contactMessages = sqliteTable(
  'contact_messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    message: text('message').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('idx_contact_ip_created').on(t.ipHash, t.createdAt)],
);

