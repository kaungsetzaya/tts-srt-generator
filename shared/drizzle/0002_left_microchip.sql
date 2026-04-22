ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `tts_conversions` MODIFY COLUMN `id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `tts_conversions` MODIFY COLUMN `voice` varchar(50);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `text` text;--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `audio_url` varchar(500);--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `srt_content` text;--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `created_at` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `users` ADD `telegram_id` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `telegram_username` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `telegram_first_name` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `telegram_code` varchar(6);--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_telegram_id_unique` UNIQUE(`telegram_id`);--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `userId`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `inputText`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `tone`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `speed`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `aspectRatio`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `audioUrl`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `srtUrl`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `email`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastSignedIn`;