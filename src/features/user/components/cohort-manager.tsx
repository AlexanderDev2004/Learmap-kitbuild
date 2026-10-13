import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, UsersIcon } from "lucide-react";
import { useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useRpcMutation, useRpcQuery } from "@/hooks/use-rpc-query";
import { AssignmentRpc } from "@/server/rpc/assignment";
import { UserRpc } from "@/server/rpc/user";

export function CohortManager() {
	const queryClient = useQueryClient();
	const { data: cohorts, isLoading } = useRpcQuery(AssignmentRpc.getAvailableCohorts());

	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<{
		id: string;
		name: string;
		description: string;
	} | null>(null);
	const [deleting, setDeleting] = useState<{
		id: string;
		name: string;
		memberCount: number;
	} | null>(null);

	const invalidateCohorts = () => {
		void queryClient.invalidateQueries({
			queryKey: AssignmentRpc.getAvailableCohorts().queryKey,
		});
	};

	const createMutation = useRpcMutation(UserRpc.createCohort(), {
		operation: "create cohort",
		showSuccess: true,
		successMessage: "Cohort created successfully",
		onSuccess: () => {
			setCreateOpen(false);
			invalidateCohorts();
		},
	});

	const updateMutation = useRpcMutation(UserRpc.updateCohort(), {
		operation: "update cohort",
		showSuccess: true,
		successMessage: "Cohort updated successfully",
		onSuccess: () => {
			setEditing(null);
			invalidateCohorts();
		},
	});

	const deleteMutation = useRpcMutation(UserRpc.deleteCohort(), {
		operation: "delete cohort",
		showSuccess: true,
		successMessage: "Cohort deleted successfully",
		onSuccess: () => {
			setDeleting(null);
			invalidateCohorts();
		},
	});

	const isPending =
		createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="text-lg font-semibold">Cohorts</h3>
					<p className="text-sm text-muted-foreground">
						Groups of students. Assignments targeted at a cohort are visible to all its
						members. Manage members from the Users tab via Bulk → Assign Cohort.
					</p>
				</div>
				<Button size="sm" onClick={() => setCreateOpen(true)}>
					<Plus className="size-4" />
					New Cohort
				</Button>
			</div>

			{isLoading ? (
				<Skeleton className="h-64 w-full" />
			) : !cohorts || cohorts.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
					<UsersIcon className="size-8 text-muted-foreground" />
					<p className="font-medium">No cohorts yet</p>
					<p className="text-sm text-muted-foreground">
						Create a cohort to group students for assignment targeting
					</p>
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Description</TableHead>
							<TableHead className="w-24">Members</TableHead>
							<TableHead className="w-24 text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{cohorts.map((cohort) => (
							<TableRow key={cohort.id}>
								<TableCell className="font-medium">{cohort.name}</TableCell>
								<TableCell className="text-muted-foreground">
									{cohort.description ?? "—"}
								</TableCell>
								<TableCell>{cohort.memberCount}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
										<Button
											variant="ghost"
											size="icon"
											title="Edit cohort"
											onClick={() =>
												setEditing({
													id: cohort.id,
													name: cohort.name,
													description: cohort.description ?? "",
												})
											}
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											title="Delete cohort"
											onClick={() =>
												setDeleting({
													id: cohort.id,
													name: cohort.name,
													memberCount: cohort.memberCount,
												})
											}
										>
											<Trash2 className="size-4 text-destructive" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<CreateCohortDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				isSubmitting={createMutation.isPending}
				onSubmit={(name, description) => createMutation.mutate({ name, description })}
			/>

			<Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
				<DialogContent className="sm:max-w-[425px]">
					{editing && (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								updateMutation.mutate({
									cohortId: editing.id,
									name: editing.name,
									description: editing.description || undefined,
								});
							}}
						>
							<DialogHeader>
								<DialogTitle>Edit Cohort</DialogTitle>
								<DialogDescription>
									Rename the cohort or update its description.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid gap-2">
									<Label htmlFor="edit-cohort-name">Name</Label>
									<Input
										id="edit-cohort-name"
										value={editing.name}
										onChange={(e) =>
											setEditing((prev) =>
												prev ? { ...prev, name: e.target.value } : prev,
											)
										}
										required
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="edit-cohort-description">Description</Label>
									<Textarea
										id="edit-cohort-description"
										value={editing.description}
										onChange={(e) =>
											setEditing((prev) =>
												prev
													? { ...prev, description: e.target.value }
													: prev,
											)
										}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditing(null)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isPending || !editing.name.trim()}>
									{updateMutation.isPending ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											Saving…
										</>
									) : (
										"Save Changes"
									)}
								</Button>
							</DialogFooter>
						</form>
					)}
				</DialogContent>
			</Dialog>

			<Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
				<DialogContent className="sm:max-w-[425px]">
					{deleting && (
						<>
							<DialogHeader>
								<DialogTitle>Delete Cohort</DialogTitle>
								<DialogDescription>
									Delete cohort "{deleting.name}"?
									{deleting.memberCount > 0 && (
										<>
											{" "}
											Its {deleting.memberCount} member
											{deleting.memberCount > 1 ? "s" : ""} will be removed
											from it and will no longer see assignments targeted at
											this cohort.
										</>
									)}{" "}
									Existing assignments are not deleted.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDeleting(null)}>
									Cancel
								</Button>
								<Button
									variant="destructive"
									disabled={deleteMutation.isPending}
									onClick={() => deleteMutation.mutate({ cohortId: deleting.id })}
								>
									{deleteMutation.isPending ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											Deleting…
										</>
									) : (
										"Delete Cohort"
									)}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

interface CreateCohortDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isSubmitting: boolean;
	onSubmit: (name: string, description: string | undefined) => void;
}

function CreateCohortDialog({
	open,
	onOpenChange,
	isSubmitting,
	onSubmit,
}: CreateCohortDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		onSubmit(name.trim(), description.trim() || undefined);
		setName("");
		setDescription("");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>New Cohort</DialogTitle>
						<DialogDescription>
							Create a group of students, e.g. a class or an experiment group.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="new-cohort-name">Name</Label>
							<Input
								id="new-cohort-name"
								placeholder="e.g. 3A Marketing Management"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="new-cohort-description">Description</Label>
							<Textarea
								id="new-cohort-description"
								placeholder="Optional description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !name.trim()}>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Creating…
								</>
							) : (
								"Create Cohort"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
