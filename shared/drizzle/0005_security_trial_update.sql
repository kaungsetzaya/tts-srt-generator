-- 🔐 Dynamic OTP: Add expiry timestamp for login codes
ALTER TABLE users ADD COLUMN telegram_code_expires_at TIMESTAMP NULL;

-- 🎁 Trial: Track total trial usage (not daily) for trial users
ALTER TABLE tts_conversions ADD COLUMN input_text TEXT NULL;
