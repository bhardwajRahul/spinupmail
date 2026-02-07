CREATE TABLE `email_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`local_part` text NOT NULL,
	`domain` text NOT NULL,
	`tag` text,
	`meta` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer,
	`auto_created` integer DEFAULT false NOT NULL,
	`last_received_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_addresses_address_unique` ON `email_addresses` (`address`);--> statement-breakpoint
CREATE INDEX `email_addresses_domain_idx` ON `email_addresses` (`domain`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`address_id` text NOT NULL,
	`message_id` text,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`subject` text,
	`headers` text,
	`raw` text,
	`raw_size` integer,
	`raw_truncated` integer DEFAULT false NOT NULL,
	`received_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`address_id`) REFERENCES `email_addresses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `emails_addressId_idx` ON `emails` (`address_id`);--> statement-breakpoint
CREATE INDEX `emails_receivedAt_idx` ON `emails` (`received_at`);