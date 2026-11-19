CREATE TABLE `segment_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`segment_id` text NOT NULL,
	`visits` integer DEFAULT 0 NOT NULL,
	`total_ms` integer DEFAULT 0 NOT NULL,
	`first_viewed_at` integer NOT NULL,
	`last_viewed_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `map_segments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `segment_activity_assignmentId_idx` ON `segment_activity` (`assignment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `segment_activity_assignment_user_segment_unique` ON `segment_activity` (`assignment_id`,`user_id`,`segment_id`);--> statement-breakpoint
ALTER TABLE `assignments` ADD `segment_model` text DEFAULT 'both' NOT NULL;