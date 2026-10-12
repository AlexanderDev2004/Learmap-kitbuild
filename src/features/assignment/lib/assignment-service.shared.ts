import { Data, Schema } from "effect";

import { NonEmpty } from "@/lib/validation-schemas";

export const CreateAssignmentInput = Schema.Struct({
	title: NonEmpty("Title"),
	description: Schema.optionalWith(NonEmpty("Description"), {
		nullable: true,
	}),
	goalMapId: NonEmpty("Goal map ID"),
	layout: Schema.optionalWith(Schema.Literal("preset", "random"), {
		default: () => "random" as const,
	}),
	startDate: Schema.optionalWith(Schema.Number, { nullable: true }),
	endDate: Schema.optionalWith(Schema.Number, { nullable: true }),
	cohortIds: Schema.Array(NonEmpty("Cohort ID")),
	userIds: Schema.Array(NonEmpty("User ID")),
	preTestFormId: Schema.String,
	postTestFormId: Schema.optionalWith(Schema.String, { nullable: true }),
	delayedPostTestFormId: Schema.optionalWith(Schema.String, { nullable: true }),
	delayedPostTestDelayDays: Schema.optionalWith(Schema.Number, {
		nullable: true,
	}),
});

export type CreateAssignmentInput = typeof CreateAssignmentInput.Type;

export const DeleteAssignmentInput = Schema.Struct({
	id: NonEmpty("Assignment ID"),
});

export type DeleteAssignmentInput = typeof DeleteAssignmentInput.Type;

export const UpdateAssignmentTargetsInput = Schema.Struct({
	id: NonEmpty("Assignment ID"),
	cohortIds: Schema.Array(Schema.String),
	userIds: Schema.Array(Schema.String),
});

export type UpdateAssignmentTargetsInput = typeof UpdateAssignmentTargetsInput.Type;

export class AssignmentNotFoundError extends Data.TaggedError("AssignmentNotFoundError")<{
	readonly assignmentId: string;
}> {}

export class AssignmentAccessDeniedError extends Data.TaggedError("AssignmentAccessDeniedError")<{
	readonly assignmentId: string;
	readonly userId: string;
}> {}

export class KitNotFoundError extends Data.TaggedError("KitNotFoundError")<{
	readonly goalMapId: string;
}> {}

export class AssignmentTargetsEmptyError extends Data.TaggedError(
	"AssignmentTargetsEmptyError",
)<{}> {}
