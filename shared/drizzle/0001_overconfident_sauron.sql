CREATE TABLE `tts_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`inputText` text NOT NULL,
	`voice` varchar(50) NOT NULL,
	`tone` decimal(5,2) DEFAULT '0',
	`speed` decimal(5,2) DEFAULT '1',
	`aspectRatio` varchar(10) DEFAULT '16:9',
	`audioUrl` text,
	`srtUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tts_conversions_id` PRIMARY KEY(`id`)
);
