-- 使っていない列を削除し、実際の並び順・レート制限の検索に合わせて索引を張り直す
DROP INDEX IF EXISTS idx_works_published_order;
ALTER TABLE works DROP COLUMN icon;
ALTER TABLE works DROP COLUMN role;
ALTER TABLE works DROP COLUMN sort_order;
CREATE INDEX IF NOT EXISTS idx_works_published_newest ON works (published, year DESC, created_at DESC, id DESC);

ALTER TABLE contact_messages DROP COLUMN org;
ALTER TABLE contact_messages DROP COLUMN type;
CREATE INDEX IF NOT EXISTS idx_contact_ip_created ON contact_messages (ip_hash, created_at);
