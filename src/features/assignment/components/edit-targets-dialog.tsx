import { UserIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRpcMutation, useRpcQuery } from "@/hooks/use-rpc-query";
import { AssignmentRpc } from "@/server/rpc/assignment";

type EditTargetsDialogProps = {
	assignmentId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentCohortIds: string[];
	currentUserIds: string[];
	onSaved: () => void;
};

export function EditTargetsDialog({
	assignmentId,
	open,
	onOpenChange,
	currentCohortIds,
	currentUserIds,
	onSaved,
}: EditTargetsDialogProps) {
	const { data: cohortsData } = useRpcQuery(AssignmentRpc.getAvailableCohorts());
	const { data: usersData } = useRpcQuery(AssignmentRpc.getAvailableUsers());
	const cohorts = cohortsData ?? [];
	const students = (usersData ?? []).filter((u) => u.role === "student");

	const [selectedCohortIds, setSelectedCohortIds] =
		useState<string[]>(currentCohortIds);
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>(currentUserIds);

	useEffect(() => {
		if (open) {
			setSelectedCohortIds(currentCohortIds);
			setSelectedUserIds(currentUserIds);
		}
	}, [open, currentCohortIds, currentUserIds]);

	const saveMutation = useRpcMutation(AssignmentRpc.updateAssignmentTargets(), {
		operation: "update assignment targets",
		showSuccess: true,
		successMessage: "Assignment targets updated",
		onSuccess: () => {
			onOpenChange(false);
			onSaved();
		},
	});

	const nothingSelected =
		selectedCohortIds.length === 0 && selectedUserIds.length === 0;

	const toggle = (
		list: string[],
		id: string,
		setList: (ids: string[]) => void,
	) => {
		setList(
			list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Targets</DialogTitle>
					<DialogDescription>
						Choose which cohorts and students are assigned to this assignment.
						Saving replaces the current target list.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-md bg-muted px-3 py-2 text-sm">
						{nothingSelected ? (
							<span className="text-muted-foreground">
								Nothing selected — pick at least one cohort or student below.
							</span>
						) : (
							<span>
								Selected: <strong>{selectedCohortIds.length} cohort(s)</strong> and{" "}
								<strong>{selectedUserIds.length} student(s)</strong>
							</span>
						)}
					</div>

					<div className="space-y-2">
						<Label className="flex items-center gap-2">
							<UsersIcon className="size-4" />
							Cohorts
							<span className="text-xs font-normal text-muted-foreground">
								({selectedCohortIds.length}/{cohorts.length})
							</span>
							{cohorts.length > 0 && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="ml-auto h-6 px-2 text-xs"
									onClick={() =>
										setSelectedCohortIds(
											selectedCohortIds.length === cohorts.length
												? []
												: cohorts.map((c) => c.id),
										)
									}
								>
									{selectedCohortIds.length === cohorts.length
										? "Deselect all"
										: "Select all"}
								</Button>
							)}
						</Label>
						<div className="rounded-lg border p-3 max-h-40 overflow-y-auto">
							{cohorts.length > 0 ? (
								<div className="space-y-2">
									{cohorts.map((cohort) => (
										<label
											key={cohort.id}
											className="flex cursor-pointer items-center gap-2"
										>
											<input
												type="checkbox"
												className="rounded"
												checked={selectedCohortIds.includes(cohort.id)}
												onChange={() =>
													toggle(
														selectedCohortIds,
														cohort.id,
														setSelectedCohortIds,
													)
												}
											/>
											<span>{cohort.name}</span>
											<span className="text-xs text-muted-foreground">
												({cohort.memberCount} members)
											</span>
										</label>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									No cohorts available
								</p>
							)}
						</div>
					</div>

					<div className="space-y-2">
						<Label className="flex items-center gap-2">
							<UserIcon className="size-4" />
							Individual Students
							<span className="text-xs font-normal text-muted-foreground">
								({selectedUserIds.length}/{students.length})
							</span>
							{students.length > 0 && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="ml-auto h-6 px-2 text-xs"
									onClick={() =>
										setSelectedUserIds(
											selectedUserIds.length === students.length
												? []
												: students.map((u) => u.id),
										)
									}
								>
									{selectedUserIds.length === students.length
										? "Deselect all"
										: "Select all"}
								</Button>
							)}
						</Label>
						<div className="rounded-lg border p-3 max-h-40 overflow-y-auto">
							{students.length > 0 ? (
								<div className="space-y-2">
									{students.map((student) => (
										<label
											key={student.id}
											className="flex cursor-pointer items-center gap-2"
										>
											<input
												type="checkbox"
												className="rounded"
												checked={selectedUserIds.includes(student.id)}
												onChange={() =>
													toggle(
														selectedUserIds,
														student.id,
														setSelectedUserIds,
													)
												}
											/>
											<span>{student.name}</span>
											<span className="text-xs text-muted-foreground">
												({student.email})
											</span>
										</label>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									No students available
								</p>
							)}
						</div>
					</div>

					{nothingSelected && (
						<p className="text-sm text-warning">
							Please select at least one cohort or student to assign this to.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={() =>
							saveMutation.mutate({
								id: assignmentId,
								cohortIds: selectedCohortIds,
								userIds: selectedUserIds,
							})
						}
						disabled={nothingSelected || saveMutation.isPending}
					>
						{saveMutation.isPending ? "Saving..." : "Save Targets"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
