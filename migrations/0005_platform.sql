-- モーダルの PLATFORM を自由記述に（例：PWA / iOS / Web）。空なら device から既定の表記を出す
ALTER TABLE works ADD COLUMN platform TEXT;
