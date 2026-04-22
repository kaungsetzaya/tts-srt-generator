CREATE TABLE `error_logs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`feature` varchar(30),
	`error_code` varchar(50),
	`error_message` text,
	`stack_trace` text,
	`severity` varchar(10) DEFAULT 'error',
	`resolved` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key_name` varchar(100) NOT NULL,
	`value` varchar(500) NOT NULL,
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `settings_key_name` PRIMARY KEY(`key_name`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`plan` varchar(50) NOT NULL,
	`starts_at` timestamp NOT NULL,
	`expires_at` timestamp,
	`created_by_admin` varchar(36),
	`note` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `feature` varchar(30) DEFAULT 'tts';--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `character` varchar(50);--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `char_count` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `duration_ms` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `video_duration_sec` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `aspect_ratio` varchar(10);--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `status` varchar(10) DEFAULT 'success';--> statement-breakpoint
ALTER TABLE `tts_conversions` ADD `error_msg` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `role` varchar(20) DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `banned_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `session_token` varchar(36);--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` timestamp;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `text`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `audio_url`;--> statement-breakpoint
ALTER TABLE `tts_conversions` DROP COLUMN `srt_content`;