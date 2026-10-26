-- 初期マイグレーション（ref/code/schema.sql）
CREATE TABLE IF NOT EXISTS works (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  icon         TEXT    NOT NULL DEFAULT 'square' CHECK (icon IN ('square', 'diamond', 'bolt')),
  device       TEXT    NOT NULL DEFAULT 'pc'     CHECK (device IN ('pc', 'sp')),
  description  TEXT,
  role         TEXT,
  tools        TEXT,
  year         TEXT,
  url          TEXT,
  video_key    TEXT,
  poster_key   TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_works_published_order ON works (published, sort_order);

CREATE TABLE IF NOT EXISTS contact_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  org         TEXT,
  email       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('work', 'collab', 'talk', 'other')),
  message     TEXT NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 初期データ（モックアップと同じ 3 件。文言はプレースホルダー）
INSERT INTO works (slug, title, category, icon, device, description, role, tools, year, url, sort_order, published) VALUES
  ('desktop-apps', 'Desktop Apps', 'SOFTWARE', 'square',  'pc', '[概要：課題・アプローチ・成果を2〜3行で]', '[担当：Design / Front-end など]', '[使用技術]', '[YEAR]', NULL, 1, 1),
  ('mobile-apps',  'Mobile Apps',  'SOFTWARE', 'diamond', 'sp', '[概要：課題・アプローチ・成果を2〜3行で]', '[担当：Design / Front-end など]', '[使用技術]', '[YEAR]', NULL, 2, 1),
  ('experiments',  'Experiments',  'LAB',      'bolt',    'pc', '[概要：課題・アプローチ・成果を2〜3行で]', '[担当：Design / Front-end など]', '[使用技術]', '[YEAR]', NULL, 3, 1);
