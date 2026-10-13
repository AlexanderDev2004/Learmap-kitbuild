import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import { Loader2, Pencil, Trash2 } from "lucide-react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRpcMutation } from "@/hooks/use-rpc-query";
import { MinLength } from "@/lib/validation-schemas";
import { TopicRpc } from "@/server/rpc/topic";

import type { Topic } from "../lib/topic-service";

const TopicFormSchema = Schema.Struct({
	title: MinLength("Title", 4),
	description: MinLength("Description", 4),
});

interface TopicActionsProps {
	topic: Topic;
	isDeleteOpen: boolean;
	isEditOpen: boolean;
	onDeleteOpenChange: (open: boolean) => void;
	onEditOpenChange: (open: boolean) => void;
	onDeleted?: () => void;
	onUpdated?: () => void;
}

export function TopicActions({
	topic,
	isDeleteOpen,
	isEditOpen,
	onDeleteOpenChange,
	onEditOpenChange,
	onDeleted,
	onUpdated,
}: TopicActionsProps) {
	const { mutate: updateTopic, isPending: isUpdating } = useRpcMutation(TopicRpc.updateTopic(), {
		operation: "update topic",
		showSuccess: true,
		successMessage: "Topic updated successfully",
		onSuccess: () => {
			onEditOpenChange(false);
			onUpdated?.();
		},
	});
	const { mutate: deleteTopic, isPending: isDeleting } = useRpcMutation(TopicRpc.deleteTopic(), {
		operation: "delete topic",
		showSuccess: true,
		successMessage: "Topic deleted successfully",
		onSuccess: () => {
			onDeleteOpenChange(false);
			onDeleted?.();
		},
	});

	const form = useForm({
		defaultValues: {
			title: topic.title,
			description: topic.description ?? "",
		},
		validators: {
			onSubmit: Schema.standardSchemaV1(TopicFormSchema),
		},
		onSubmit: async ({ value }) => {
			updateTopic({
				topicId: topic.id,
				title: value.title,
				description: value.description,
			});
		},
	});

	return (
		<>
			<div className="flex items-center gap-0.5">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7"
					aria-label={`Edit topic ${topic.title}`}
					onClick={(e) => {
						e.stopPropagation();
						form.reset({ title: topic.title, description: topic.description ?? "" });
						onEditOpenChange(true);
					}}
				>
					<Pencil className="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7 text-destructive hover:text-destructive"
					aria-label={`Delete topic ${topic.title}`}
					onClick={(e) => {
						e.stopPropagation();
						onDeleteOpenChange(true);
					}}
				>
					<Trash2 className="size-3.5" />
				</Button>
			</div>

			{/* Edit dialog */}
			<Dialog open={isEditOpen} onOpenChange={onEditOpenChange}>
				<DialogContent className="sm:max-w-[425px]">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
					>
						<DialogHeader>
							<DialogTitle>Edit Topic</DialogTitle>
							<DialogDescription>
								Update the topic name and description.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<form.Field name="title">
								{(field) => (
									<div className="grid gap-2">
										<Label htmlFor={`topic-title-${topic.id}`}>Title</Label>
										<Input
											id={`topic-title-${topic.id}`}
											placeholder="Topic title"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
										/>
										{field.state.meta.errors.length > 0 && (
											<p className="text-sm text-destructive">
												{field.state.meta.errors[0]?.message}
											</p>
										)}
									</div>
								)}
							</form.Field>
							<form.Field name="description">
								{(field) => (
									<div className="grid gap-2">
										<Label htmlFor={`topic-description-${topic.id}`}>
											Description
										</Label>
										<Input
											id={`topic-description-${topic.id}`}
											placeholder="Topic description"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
										/>
										{field.state.meta.errors.length > 0 && (
											<p className="text-sm text-destructive">
												{field.state.meta.errors[0]?.message}
											</p>
										)}
									</div>
								)}
							</form.Field>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={isUpdating}
								onClick={() => onEditOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isUpdating}>
								{isUpdating ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										Saving…
									</>
								) : (
									"Save"
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation */}
			<AlertDialog open={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete topic "{topic.title}"?</AlertDialogTitle>
						<AlertDialogDescription>
							This will hide the topic and its goal maps from the dashboard. This
							action cannot be undone from the interface.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeleting}
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={(e) => {
								e.preventDefault();
								deleteTopic({ topicId: topic.id });
							}}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Deleting…
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
