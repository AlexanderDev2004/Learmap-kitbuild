import { and, eq, inArray, isNull } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { GoalMapNotFoundError } from "@/lib/errors";
import { randomString, safeParseJson } from "@/lib/utils";
import { Database } from "@/server/db/client";
import {
	assignments,
	assignmentTargets,
	forms,
	goalMaps,
	kits,
} from "@/server/db/schema/app-schema";

import {
	AssignmentAccessDeniedError,
	AssignmentFormNotFoundError,
	AssignmentNotFoundError,
	AssignmentTargetsEmptyError,
	CreateAssignmentInput,
	DeleteAssignmentInput,
	UpdateAssignmentFormsInput,
	UpdateAssignmentTargetsInput,
} from "./assignment-service.shared";

export const createAssignment = Effect.fn("createAssignment")(function* (
	userId: string,
	data: CreateAssignmentInput,
) {
	const db = yield* Database;

	const kitRows = yield* db
		.select({ id: kits.id, teacherId: kits.teacherId })
		.from(kits)
		.where(and(eq(kits.goalMapId, data.goalMapId), isNull(kits.deletedAt)))
		.limit(1);
	let kit = kitRows[0];

	if (!kit) {
		const gmRows = yield* db
			.select()
			.from(goalMaps)
			.where(and(eq(goalMaps.id, data.goalMapId), isNull(goalMaps.deletedAt)))
			.limit(1);
		const gm = gmRows[0];
		if (!gm) {
			return yield* new GoalMapNotFoundError({ goalMapId: data.goalMapId });
		}

		const nodes = Array.isArray(gm.nodes)
			? gm.nodes
			: typeof gm.nodes === "string"
				? yield* safeParseJson(gm.nodes, [], Schema.Array(Schema.Any))
				: [];

		const kitNodes = nodes.filter((n) => {
			if (typeof n !== "object" || n === null) return false;
			const node = n as { type?: string };
			return node.type === "text" || node.type === "connector";
		});

		const kitId = randomString();
		yield* db.insert(kits).values({
			id: kitId,
			kitId: randomString(),
			name: gm.title,
			goalMapId: data.goalMapId,
			teacherId: gm.teacherId ?? userId,
			layout: data.layout ?? "random",
			nodes: kitNodes,
			edges: [],
			textId: gm.textId,
		});
		kit = { id: kitId, teacherId: gm.teacherId ?? userId };
	} else if (data.layout) {
		yield* db
			.update(kits)
			.set({ layout: data.layout })
			.where(and(eq(kits.id, kit.id), isNull(kits.deletedAt)));
	}

	const assignmentId = randomString();

	yield* db.insert(assignments).values({
		id: assignmentId,
		goalMapId: data.goalMapId,
		kitId: kit.id,
		title: data.title,
		description: data.description,
		readingMaterial: null,
		timeLimitMinutes: null,
		startDate: data.startDate ? new Date(data.startDate) : new Date(),
		dueAt: data.endDate ? new Date(data.endDate) : null,
		preTestFormId: data.preTestFormId,
		postTestFormId: data.postTestFormId,
		delayedPostTestFormId: data.delayedPostTestFormId,
		delayedPostTestDelayDays: data.delayedPostTestDelayDays,
		createdBy: userId,
	});

	const targets: Array<{
		id: string;
		assignmentId: string;
		cohortId?: string;
		userId?: string;
	}> = [];

	for (const cohortId of data.cohortIds) {
		targets.push({
			id: randomString(),
			assignmentId,
			cohortId,
		});
	}

	for (const userId of data.userIds) {
		targets.push({
			id: randomString(),
			assignmentId,
			userId,
		});
	}

	if (targets.length > 0) {
		yield* db.insert(assignmentTargets).values(targets);
	}

	return true;
});

export const updateAssignmentTargets = Effect.fn("updateAssignmentTargets")(function* (
	userId: string,
	input: UpdateAssignmentTargetsInput,
	options: { isAdmin?: boolean } = {},
) {
	const db = yield* Database;

	const assignmentRows = yield* db
		.select({ createdBy: assignments.createdBy })
		.from(assignments)
		.where(and(eq(assignments.id, input.id), isNull(assignments.deletedAt)))
		.limit(1);

	const assignment = assignmentRows[0];
	if (!assignment) {
		return yield* new AssignmentNotFoundError({ assignmentId: input.id });
	}
	if (assignment.createdBy !== userId && !options.isAdmin) {
		return yield* new AssignmentAccessDeniedError({
			assignmentId: input.id,
			userId,
		});
	}

	if (input.cohortIds.length === 0 && input.userIds.length === 0) {
		return yield* new AssignmentTargetsEmptyError();
	}

	// Replace the target list: delete existing rows, then insert the new set.
	yield* db.delete(assignmentTargets).where(eq(assignmentTargets.assignmentId, input.id));

	const targets: Array<{
		id: string;
		assignmentId: string;
		cohortId?: string;
		userId?: string;
	}> = [];

	for (const cohortId of input.cohortIds) {
		targets.push({
			id: randomString(),
			assignmentId: input.id,
			cohortId,
		});
	}

	for (const userId of input.userIds) {
		targets.push({
			id: randomString(),
			assignmentId: input.id,
			userId,
		});
	}

	if (targets.length > 0) {
		yield* db.insert(assignmentTargets).values(targets);
	}

	return true;
});

export const updateAssignmentForms = Effect.fn("updateAssignmentForms")(function* (
	userId: string,
	input: UpdateAssignmentFormsInput,
	options: { isAdmin?: boolean } = {},
) {
	const db = yield* Database;

	const assignmentRows = yield* db
		.select({ createdBy: assignments.createdBy })
		.from(assignments)
		.where(and(eq(assignments.id, input.id), isNull(assignments.deletedAt)))
		.limit(1);

	const assignment = assignmentRows[0];
	if (!assignment) {
		return yield* new AssignmentNotFoundError({ assignmentId: input.id });
	}
	if (assignment.createdBy !== userId && !options.isAdmin) {
		return yield* new AssignmentAccessDeniedError({
			assignmentId: input.id,
			userId,
		});
	}

	const formIds = [
		input.preTestFormId,
		input.postTestFormId,
		input.delayedPostTestFormId,
		input.questionnaireFormId,
	].filter((id): id is string => typeof id === "string" && id.length > 0);

	if (formIds.length > 0) {
		const formRows = yield* db
			.select({ id: forms.id })
			.from(forms)
			.where(and(inArray(forms.id, formIds), isNull(forms.deletedAt)));
		const found = new Set(formRows.map((f) => f.id));
		const missing = formIds.find((id) => !found.has(id));
		if (missing) {
			return yield* new AssignmentFormNotFoundError({ formId: missing });
		}
	}

	yield* db
		.update(assignments)
		.set({
			preTestFormId: input.preTestFormId ?? null,
			postTestFormId: input.postTestFormId ?? null,
			delayedPostTestFormId: input.delayedPostTestFormId ?? null,
			questionnaireFormId: input.questionnaireFormId ?? null,
			delayedPostTestDelayDays: input.delayedPostTestDelayDays ?? null,
		})
		.where(and(eq(assignments.id, input.id), isNull(assignments.deletedAt)));

	return true;
});

export const deleteAssignment = Effect.fn("deleteAssignment")(function* (
	userId: string,
	input: DeleteAssignmentInput,
	options: { isAdmin?: boolean } = {},
) {
	const db = yield* Database;

	const assignmentRows = yield* db
		.select({ createdBy: assignments.createdBy })
		.from(assignments)
		.where(and(eq(assignments.id, input.id), isNull(assignments.deletedAt)))
		.limit(1);

	const assignment = assignmentRows[0];
	if (!assignment) {
		return yield* new AssignmentNotFoundError({ assignmentId: input.id });
	}
	// Admins may delete any assignment (the manage page lists all of them);
	// teachers are restricted to their own.
	if (assignment.createdBy !== userId && !options.isAdmin) {
		return yield* new AssignmentAccessDeniedError({
			assignmentId: input.id,
			userId,
		});
	}

	yield* db
		.update(assignments)
		.set({ deletedAt: new Date() })
		.where(and(eq(assignments.id, input.id), isNull(assignments.deletedAt)));

	return true;
});
