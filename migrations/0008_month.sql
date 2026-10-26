-- 制作月（1〜12、任意）。並びは年 → 月 → 登録日時の降順
ALTER TABLE works ADD COLUMN month INTEGER CHECK (month BETWEEN 1 AND 12);
DROP INDEX IF EXISTS idx_works_published_newest;
CREATE INDEX IF NOT EXISTS idx_works_published_newest ON works (published, year DESC, month DESC, created_at DESC, id DESC);
