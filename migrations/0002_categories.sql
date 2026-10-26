-- カテゴリを PERSONAL / PROFESSIONAL の 2 種に統一（旧 LAB → PERSONAL、それ以外 → PROFESSIONAL）
UPDATE works SET category = CASE WHEN category = 'LAB' THEN 'PERSONAL' ELSE 'PROFESSIONAL' END
  WHERE category NOT IN ('PERSONAL', 'PROFESSIONAL');
-- 初期データの年（プレースホルダー）を並び順確認用の仮の値に
UPDATE works SET year = '2026' WHERE slug = 'mobile-apps'   AND year = '[YEAR]';
UPDATE works SET year = '2025' WHERE slug = 'desktop-apps'  AND year = '[YEAR]';
UPDATE works SET year = '2024' WHERE slug = 'experiments'   AND year = '[YEAR]';
