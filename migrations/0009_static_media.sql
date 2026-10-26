-- 動画・ポスターは R2 をやめ、src/assets/works/<slug>/ の静的アセットで配信するため列を削除
ALTER TABLE works DROP COLUMN video_key;
ALTER TABLE works DROP COLUMN poster_key;
