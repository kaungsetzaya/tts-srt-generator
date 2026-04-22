-- Add payment_method and payment_slip columns to subscriptions table
ALTER TABLE `subscriptions` ADD COLUMN `payment_method` varchar(30) DEFAULT NULL;
ALTER TABLE `subscriptions` ADD COLUMN `payment_slip` text DEFAULT NULL;
