ALTER TABLE `users` ADD `class_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `major` text;--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;