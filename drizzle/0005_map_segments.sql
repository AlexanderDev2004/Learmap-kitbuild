CREATE TABLE `map_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_map_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'paragraph' NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`node_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`goal_map_id`) REFERENCES `goal_maps`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `map_segments_goalMapId_idx` ON `map_segments` (`goal_map_id`);
