-- Add resolved_at timestamp to error_logs (was missing, causing runtime SQL errors)
ALTER TABLE `error_logs` ADD COLUMN `resolved_at` TIMESTAMP NULL DEFAULT NULL;
