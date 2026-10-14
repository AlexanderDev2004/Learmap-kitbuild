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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useRpcMutation, useRpcQuery } from "@/hooks/use-rpc-query";
import { AssignmentRpc } from "@/server/rpc/assignment";
import { FormRpc } from "@/server/rpc/form";

type EditFormsDialogProps = {
	assignmentId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentPreTestFormId: string | null;
	currentPostTestFormId: string | null;
	currentDelayedPostTestFormId: string | null;
	currentQuestionnaireFormId: string | null;
	currentDelayedPostTestDelayDays: number | null;
	onSaved: () => void;
};

type FormSlotKey =
	| "preTestFormId"
	| "postTestFormId"
	| "delayedPostTestFormId"
	| "questionnaireFormId";

type FormSlot = {
	key: FormSlotKey;
	label: string;
	description: string;
};

const FORM_SLOTS: FormSlot[] = [
	{
		key: "preTestFormId",
		label: "Pre-Test",
		description: "Taken before students work on the kit-build",
	},
	{
		key: "postTestFormId",
		label: "Post-Test",
		description: "Taken after students submit the kit-build",
	},
	{
		key: "delayedPostTestFormId",
		label: "Delayed Post-Test",
		description: "Optional retention test unlocked after a delay",
	},
	{
		key: "questionnaireFormId",
		label: "Kuesioner",
		description:
			"Perception questionnaire attached to this assignment; students fill it from My Forms",
	},
];

export function EditFormsDialog({
	assignmentId,
	open,
	onOpenChange,
	currentPreTestFormId,
	currentPostTestFormId,
	currentDelayedPostTestFormId,
	currentQuestionnaireFormId,
	currentDelayedPostTestDelayDays,
	onSaved,
}: EditFormsDialogProps) {
	const { data: formsData } = useRpcQuery(FormRpc.listForms());
	const forms = formsData ?? [];

	const [selectedForms, setSelectedForms] = useState<Record<FormSlotKey, string | undefined>>({
		preTestFormId: currentPreTestFormId ?? undefined,
		postTestFormId: currentPostTestFormId ?? undefined,
		delayedPostTestFormId: currentDelayedPostTestFormId ?? undefined,
		questionnaireFormId: currentQuestionnaireFormId ?? undefined,
	});
	const [delayDays, setDelayDays] = useState(
		currentDelayedPostTestDelayDays != null ? String(currentDelayedPostTestDelayDays) : "",
	);

	useEffect(() => {
		if (open) {
			setSelectedForms({
				preTestFormId: currentPreTestFormId ?? undefined,
				postTestFormId: currentPostTestFormId ?? undefined,
				delayedPostTestFormId: currentDelayedPostTestFormId ?? undefined,
				questionnaireFormId: currentQuestionnaireFormId ?? undefined,
			});
			setDelayDays(
				currentDelayedPostTestDelayDays != null
					? String(currentDelayedPostTestDelayDays)
					: "",
			);
		}
	}, [
		open,
		currentPreTestFormId,
		currentPostTestFormId,
		currentDelayedPostTestFormId,
		currentQuestionnaireFormId,
		currentDelayedPostTestDelayDays,
	]);

	const saveMutation = useRpcMutation(AssignmentRpc.updateAssignmentForms(), {
		operation: "update assignment forms",
		showSuccess: true,
		successMessage: "Assignment forms updated",
		onSuccess: () => {
			onOpenChange(false);
			onSaved();
		},
	});

	const selectForm = (key: FormSlotKey, value: string) => {
		setSelectedForms((prev) => ({
			...prev,
			[key]: value === "none" ? undefined : value,
		}));
	};

	const handleSave = () => {
		const parsedDelayDays = delayDays.trim() === "" ? null : Number(delayDays);
		const validDelayDays =
			selectedForms.delayedPostTestFormId != null &&
			parsedDelayDays != null &&
			Number.isFinite(parsedDelayDays) &&
			parsedDelayDays > 0
				? parsedDelayDays
				: undefined;
		saveMutation.mutate({
			id: assignmentId,
			preTestFormId: selectedForms.preTestFormId,
			postTestFormId: selectedForms.postTestFormId,
			delayedPostTestFormId: selectedForms.delayedPostTestFormId,
			questionnaireFormId: selectedForms.questionnaireFormId,
			delayedPostTestDelayDays: validDelayDays,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Associated Forms</DialogTitle>
					<DialogDescription>
						Attach published forms to this assignment. Choosing "None" removes a form
						slot.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{FORM_SLOTS.map((slot) => (
						<div key={slot.key} className="space-y-1.5">
							<Label htmlFor={`form-slot-${slot.key}`}>{slot.label}</Label>
							<Select
								value={selectedForms[slot.key] ?? "none"}
								onValueChange={(value) => selectForm(slot.key, value)}
							>
								<SelectTrigger id={`form-slot-${slot.key}`} className="w-full">
									<SelectValue placeholder="Select a form" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{forms.map((form) => (
										<SelectItem key={form.id} value={form.id}>
											{form.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">{slot.description}</p>
						</div>
					))}

					<div className="space-y-1.5">
						<Label htmlFor="delayed-post-test-delay-days">
							Delayed Post-Test unlock delay (days)
						</Label>
						<Input
							id="delayed-post-test-delay-days"
							type="number"
							min={1}
							value={delayDays}
							onChange={(e) => setDelayDays(e.target.value)}
							placeholder="e.g. 7"
						/>
						<p className="text-xs text-muted-foreground">
							Only applies when a Delayed Post-Test is selected.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={saveMutation.isPending}
					>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saveMutation.isPending}>
						{saveMutation.isPending ? "Saving…" : "Save Forms"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
