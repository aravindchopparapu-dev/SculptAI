CREATE TABLE `mobile_pairings` (
	`device_hash` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_id` text,
	`display_name` text,
	`consumed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobile_pairings_code_unique` ON `mobile_pairings` (`code`);--> statement-breakpoint
CREATE TABLE `mobile_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`expires_at` integer NOT NULL
);
