CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text,
	`email` varchar(320) UNIQUE,
	`passwordHash` varchar(255),
	`role` enum('admin','engenheiro','cliente') NOT NULL DEFAULT 'engenheiro',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
