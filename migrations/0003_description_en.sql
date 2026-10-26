-- モーダル本文を「英語 → 日本語」の 2 段にするため英語の説明列を追加（既存の description は日本語）
ALTER TABLE works ADD COLUMN description_en TEXT;
UPDATE works SET description_en = '[Overview in English: the problem, approach and outcome in 2–3 sentences.]' WHERE description_en IS NULL;
