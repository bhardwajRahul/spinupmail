CREATE TABLE `apikeys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`user_id` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`rate_limit_enabled` integer DEFAULT true NOT NULL,
	`rate_limit_time_window` integer DEFAULT 86400000 NOT NULL,
	`rate_limit_max` integer DEFAULT 10 NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`permissions` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apikeys_key_unique` ON `apikeys` (`key`);--> statement-breakpoint
CREATE INDEX `apikeys_userId_idx` ON `apikeys` (`user_id`);--> statement-breakpoint
ALTER TABLE `email_addresses` ADD `user_id` text NOT NULL REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `email_addresses_userId_idx` ON `email_addresses` (`user_id`);