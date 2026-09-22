CREATE TABLE `admin_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`published_version` integer NOT NULL,
	`draft` text NOT NULL,
	`published` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_versions` (
	`version` integer PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	`published_at` text NOT NULL,
	`published_by` text NOT NULL
);
