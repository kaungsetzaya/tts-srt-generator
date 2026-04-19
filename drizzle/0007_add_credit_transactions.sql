-- Create credit_transactions table if it doesn't already exist
-- This table is referenced throughout routers.ts but had no migration file
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `user_id` varchar(36) NOT NULL,
  `amount` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `description` varchar(255),
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
