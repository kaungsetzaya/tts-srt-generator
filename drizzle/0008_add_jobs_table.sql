-- Create tts_jobs table for persistent job state (survives server restarts)
CREATE TABLE IF NOT EXISTS `tts_jobs` (
  `id` varchar(64) NOT NULL,
  `type` varchar(30) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT 0,
  `message` varchar(500) DEFAULT '',
  `input_json` text,
  `result_json` text,
  `error` varchar(1000),
  `user_id` varchar(36),
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `tts_jobs_id` PRIMARY KEY(`id`)
);
-- Index for fast user job lookups
CREATE INDEX `tts_jobs_user_id_idx` ON `tts_jobs` (`user_id`);
-- Index for status-based cleanup
CREATE INDEX `tts_jobs_status_idx` ON `tts_jobs` (`status`);
