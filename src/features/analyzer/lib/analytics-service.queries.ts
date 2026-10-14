import { and, avg, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { isCorrectMcqAnswer } from "@/features/form/lib/form-scoring";
import { QuestionOptions } from "@/features/form/lib/form-service.shared";
import {
	classifyEdges,
	compareMaps,
	EdgeSchema,
	NodeSchema,
} from "@/features/learner-map/lib/comparator";
import { safeParseJson } from "@/lib/utils";
import { Database } from "@/server/db/client";
import {
	assignments,
	assignmentTargets,
	diagnoses,
	formResponses,
	goalMaps,
	kits,
	learnerMaps,
	questions,
} from "@/server/db/schema/app-schema";
import { cohortMembers, user } from "@/server/db/schema/auth-schema";

import {
	AssignmentNotFoundError,
	GetAnalyticsForAssignmentInput,
	GetLearnerMapForAnalyticsInput,
	GetLearnerSummaryTextInput,
	GetMultipleLearnerMapsInput,
	GoalMapDirectionSchema,
	GoalMapNotFoundError,
	LearnerAnalyticsSchema,
	LearnerMapNotFoundError,
	LearnerSummaryTextSchema,
	PerLinkDiagnosisSchema,
} from "./analytics-service.shared";

export type LearnerMapResult = Awaited<
	Effect.Effect.Success<ReturnType<typeof getLearnerMapForAnalytics>>
>;

export const getTeacherAssignments = Effect.fn("getTeacherAssignments")(function* (
	userId: string,
	opts: { isAdmin?: boolean } = {},
) {
	const db = yield* Database;

	const assignmentsWithStats = yield* db
		.select({
			id: assignments.id,
			title: assignments.title,
			goalMapId: assignments.goalMapId,
			goalMapTitle: goalMaps.title,
			// Alias: an unaliased kits.id would collide with assignments.id on
			// the "id" result column and overwrite it (see goal-map-service.queries).
			kitId: sql<string | null>`kits.id`.as("kit_id"),
			createdAt: assignments.createdAt,
			dueAt: assignments.dueAt,
			submissionCount: count(learnerMaps.id),
			avgScore: avg(diagnoses.score),
		})
		.from(assignments)
		.leftJoin(goalMaps, and(eq(assignments.goalMapId, goalMaps.id), isNull(goalMaps.deletedAt)))
		.leftJoin(kits, and(eq(assignments.kitId, kits.id), isNull(kits.deletedAt)))
		.leftJoin(
			learnerMaps,
			and(eq(learnerMaps.assignmentId, assignments.id), isNull(learnerMaps.deletedAt)),
		)
		.leftJoin(diagnoses, eq(diagnoses.learnerMapId, learnerMaps.id))
		.where(
			and(
				// Admins oversee every class, so they get all assignments; teachers
				// only see the ones they created themselves.
				...(opts.isAdmin ? [] : [eq(assignments.createdBy, userId)]),
				isNull(assignments.deletedAt),
			),
		)
		.groupBy(assignments.id, goalMaps.title, kits.id, assignments.createdAt, assignments.dueAt)
		.orderBy(desc(assignments.createdAt));

	return assignmentsWithStats.map((row) => ({
		id: row.id,
		title: row.title,
		goalMapId: row.goalMapId,
		goalMapTitle: row.goalMapTitle,
		kitId: row.kitId,
		totalSubmissions: Number(row.submissionCount ?? 0),
		avgScore: row.avgScore ? Number(row.avgScore) : null,
		createdAt: row.createdAt?.getTime() ?? 0,
		dueAt: row.dueAt?.getTime() ?? null,
	}));
});

export const getAnalyticsForAssignment = Effect.fn("getAnalyticsForAssignment")(function* (
	userId: string,
	input: GetAnalyticsForAssignmentInput,
	opts: { isAdmin?: boolean } = {},
) {
	const db = yield* Database;

	const assignmentRows = yield* db
		.select({
			id: assignments.id,
			title: assignments.title,
			goalMapId: assignments.goalMapId,
			kitId: assignments.kitId,
			preTestFormId: assignments.preTestFormId,
			postTestFormId: assignments.postTestFormId,
			createdAt: assignments.createdAt,
			dueAt: assignments.dueAt,
		})
		.from(assignments)
		.where(
			and(
				// Keep in sync with getTeacherAssignments: admins can inspect any
				// assignment, teachers only their own.
				...(opts.isAdmin ? [] : [eq(assignments.createdBy, userId)]),
				eq(assignments.id, input.assignmentId),
				isNull(assignments.deletedAt),
			),
		)
		.limit(1);

	const assignment = assignmentRows[0];
	if (!assignment) {
		return yield* new AssignmentNotFoundError({
			assignmentId: input.assignmentId,
		});
	}

	const goalMapRows = yield* db
		.select({
			id: goalMaps.id,
			title: goalMaps.title,
			nodes: goalMaps.nodes,
			edges: goalMaps.edges,
			direction: goalMaps.direction,
		})
		.from(goalMaps)
		.where(and(eq(goalMaps.id, assignment.goalMapId), isNull(goalMaps.deletedAt)))
		.limit(1);

	const goalMap = goalMapRows[0];
	if (!goalMap) {
		return yield* new GoalMapNotFoundError({
			goalMapId: assignment.goalMapId,
		});
	}

	const [parsedGoalMapNodes, parsedGoalMapEdges] = yield* Effect.all(
		[
			safeParseJson(goalMap.nodes, [], Schema.Array(NodeSchema)),
			safeParseJson(goalMap.edges, [], Schema.Array(EdgeSchema)),
		],
		{ concurrency: 10 },
	);

	const learnerMapsData = yield* db
		.select({
			id: learnerMaps.id,
			userId: learnerMaps.userId,
			status: learnerMaps.status,
			attempt: learnerMaps.attempt,
			submittedAt: learnerMaps.submittedAt,
			firstInteractionAt: learnerMaps.firstInteractionAt,
			score: diagnoses.score,
			perLink: diagnoses.perLink,
			userName: user.name,
			userEmail: user.email,
			studyGroup: user.studyGroup,
		})
		.from(learnerMaps)
		.innerJoin(user, and(eq(learnerMaps.userId, user.id), isNull(user.deletedAt)))
		.leftJoin(diagnoses, eq(diagnoses.learnerMapId, learnerMaps.id))
		.where(and(eq(learnerMaps.assignmentId, input.assignmentId), isNull(learnerMaps.deletedAt)))
		.orderBy(desc(learnerMaps.attempt), desc(learnerMaps.updatedAt));

	const testFormIds = [assignment.preTestFormId, assignment.postTestFormId].filter(
		(formId): formId is string => formId !== null,
	);
	const questionRows = testFormIds.length
		? yield* db
				.select({ id: questions.id, formId: questions.formId, options: questions.options })
				.from(questions)
				.where(and(inArray(questions.formId, testFormIds), isNull(questions.deletedAt)))
		: [];
	const responseRows = testFormIds.length
		? yield* db
				.select({
					formId: formResponses.formId,
					userId: formResponses.userId,
					answers: formResponses.answers,
					timeSpentSeconds: formResponses.timeSpentSeconds,
				})
				.from(formResponses)
				.where(
					and(
						inArray(formResponses.formId, testFormIds),
						isNull(formResponses.deletedAt),
					),
				)
		: [];

	const questionsByForm = new Map<string, typeof questionRows>();
	for (const question of questionRows) {
		const list = questionsByForm.get(question.formId) ?? [];
		list.push(question);
		questionsByForm.set(question.formId, list);
	}
	const responsesByFormAndUser = new Map<string, (typeof responseRows)[number]>();
	for (const response of responseRows) {
		responsesByFormAndUser.set(`${response.formId}:${response.userId}`, response);
	}

	const scoreTestResponse = (formId: string | null, userId: string) =>
		Effect.gen(function* () {
			if (!formId) return null;
			const response = responsesByFormAndUser.get(`${formId}:${userId}`);
			if (!response) return null;
			const answers = yield* safeParseJson(
				response.answers,
				{},
				Schema.Record({ key: Schema.String, value: Schema.Unknown }),
			);
			let correct = 0;
			let total = 0;
			for (const question of questionsByForm.get(formId) ?? []) {
				const options = yield* safeParseJson(
					question.options,
					null,
					Schema.NullOr(QuestionOptions),
				);
				const isCorrect = isCorrectMcqAnswer(
					options?.type === "mcq"
						? { type: "mcq", correctOptionIds: options.correctOptionIds }
						: null,
					answers[question.id],
				);
				if (isCorrect !== null) {
					total += 1;
					if (isCorrect) correct += 1;
				}
			}
			return {
				raw: correct,
				total,
				score: total > 0 ? (correct / total) * 100 : null,
				durationSeconds: response.timeSpentSeconds,
			};
		});

	const finalLearners = yield* Effect.all(
		learnerMapsData.map((lm) =>
			Effect.gen(function* () {
				const [preTest, postTest] = yield* Effect.all([
					scoreTestResponse(assignment.preTestFormId, lm.userId),
					scoreTestResponse(assignment.postTestFormId, lm.userId),
				]);
				let correct = 0;
				let missing = 0;
				let excessive = 0;
				let totalGoalPropositions = 0;

				if (lm.perLink) {
					const parsed = yield* safeParseJson(lm.perLink, {}, PerLinkDiagnosisSchema);
					correct = parsed.correct?.length ?? 0;
					missing = parsed.missing?.length ?? 0;
					excessive = parsed.excessive?.length ?? 0;
					totalGoalPropositions = parsed.totalGoalPropositions ?? 0;
				}

				// Build duration: first modification until submit. Null when the
				// learner never edited (imported rows) or the condition is
				// summarizing (no map to build).
				const mapBuildDurationSeconds =
					lm.submittedAt !== null && lm.firstInteractionAt !== null
						? Math.round(
								(lm.submittedAt.getTime() - lm.firstInteractionAt.getTime()) / 1000,
							)
						: null;

				return yield* Schema.encode(LearnerAnalyticsSchema)({
					userId: lm.userId,
					userName: lm.userName,
					userEmail: lm.userEmail,
					learnerMapId: lm.id,
					studyGroup:
						lm.studyGroup === "experiment"
							? "experiment"
							: lm.studyGroup === "control"
								? "control"
								: undefined,
					condition:
						lm.studyGroup === "experiment"
							? "concept_map"
							: lm.studyGroup === "control"
								? "summarizing"
								: undefined,
					status: lm.status,
					score: lm.score,
					attempt: lm.attempt,
					submittedAt: lm.submittedAt?.getTime() ?? null,
					mapBuildDurationSeconds,
					correct,
					missing,
					excessive,
					totalGoalPropositions,
					preTestRaw: preTest?.raw ?? null,
					preTestTotal: preTest?.total ?? null,
					preTestScore: preTest?.score ?? null,
					preTestDurationSeconds: preTest?.durationSeconds ?? null,
					postTestRaw: postTest?.raw ?? null,
					postTestTotal: postTest?.total ?? null,
					postTestScore: postTest?.score ?? null,
					postTestDurationSeconds: postTest?.durationSeconds ?? null,
				});
			}),
		),
		{ concurrency: 10 },
	);

	// Include targeted students who never started (no learner map row) so the
	// export covers the full participant list, not only those who began.
	const targetRows = yield* db
		.select({ userId: assignmentTargets.userId, cohortId: assignmentTargets.cohortId })
		.from(assignmentTargets)
		.where(
			and(
				eq(assignmentTargets.assignmentId, input.assignmentId),
				isNull(assignmentTargets.deletedAt),
			),
		);
	const cohortIds = targetRows.flatMap((t) => (t.cohortId ? [t.cohortId] : []));
	const cohortUserIds =
		cohortIds.length > 0
			? yield* db
					.select({ userId: cohortMembers.userId })
					.from(cohortMembers)
					.where(
						and(
							inArray(cohortMembers.cohortId, cohortIds),
							isNull(cohortMembers.deletedAt),
						),
					)
			: [];
	const startedUserIds = new Set(learnerMapsData.map((lm) => lm.userId));
	const targetUserIds = Array.from(
		new Set([
			...targetRows.flatMap((t) => (t.userId ? [t.userId] : [])),
			...cohortUserIds.map((row) => row.userId),
		]),
	);
	const notStartedIds = targetUserIds.filter((id) => !startedUserIds.has(id));
	const notStartedLearners =
		notStartedIds.length > 0
			? yield* db
					.select({
						userId: user.id,
						userName: user.name,
						userEmail: user.email,
						studyGroup: user.studyGroup,
					})
					.from(user)
					.where(and(inArray(user.id, notStartedIds), isNull(user.deletedAt)))
			: [];

	const scores: number[] = [];
	for (const l of finalLearners) {
		if (l.score !== null) scores.push(l.score);
	}

	const summary = {
		totalLearners: finalLearners.length,
		submittedCount: finalLearners.filter((l) => l.status === "submitted").length,
		draftCount: finalLearners.filter((l) => l.status === "draft").length,
		avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
		medianScore:
			scores.length > 0 ? scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] : null,
		highestScore: scores.length > 0 ? Math.max(...scores) : null,
		lowestScore: scores.length > 0 ? Math.min(...scores) : null,
	};

	return {
		assignment: {
			id: assignment.id,
			title: assignment.title,
			goalMapId: assignment.goalMapId,
			goalMapTitle: goalMap.title,
			kitId: assignment.kitId,
			totalSubmissions: summary.submittedCount,
			createdAt: assignment.createdAt?.getTime() ?? 0,
			dueAt: assignment.dueAt?.getTime() ?? null,
		},
		goalMap: {
			id: goalMap.id,
			title: goalMap.title,
			nodes: parsedGoalMapNodes,
			edges: parsedGoalMapEdges,
			direction: yield* Schema.encode(GoalMapDirectionSchema)(goalMap.direction),
		},
		learners: finalLearners,
		notStartedLearners,
		summary,
	};
});

export const getLearnerMapForAnalytics = Effect.fn("getLearnerMapForAnalytics")(function* (
	input: GetLearnerMapForAnalyticsInput,
) {
	const db = yield* Database;

	const learnerMapRows = yield* db
		.select({
			id: learnerMaps.id,
			userId: learnerMaps.userId,
			goalMapId: learnerMaps.goalMapId,
			status: learnerMaps.status,
			attempt: learnerMaps.attempt,
			submittedAt: learnerMaps.submittedAt,
			nodes: learnerMaps.nodes,
			edges: learnerMaps.edges,
			userName: user.name,
		})
		.from(learnerMaps)
		.innerJoin(user, and(eq(learnerMaps.userId, user.id), isNull(user.deletedAt)))
		.where(and(eq(learnerMaps.id, input.learnerMapId), isNull(learnerMaps.deletedAt)))
		.limit(1);

	const learnerMap = learnerMapRows[0];
	if (!learnerMap) {
		return yield* new LearnerMapNotFoundError({
			learnerMapId: input.learnerMapId,
		});
	}

	const goalMapRows = yield* db
		.select({
			id: goalMaps.id,
			title: goalMaps.title,
			nodes: goalMaps.nodes,
			edges: goalMaps.edges,
			direction: goalMaps.direction,
		})
		.from(goalMaps)
		.where(and(eq(goalMaps.id, learnerMap.goalMapId), isNull(goalMaps.deletedAt)))
		.limit(1);

	const goalMap = goalMapRows[0];
	if (!goalMap) {
		return yield* new GoalMapNotFoundError({
			goalMapId: learnerMap.goalMapId,
		});
	}

	const [parsedGoalMapNodes, parsedGoalMapEdges, parsedLearnerMapNodes, parsedLearnerMapEdges] =
		yield* Effect.all(
			[
				safeParseJson(goalMap.nodes, [], Schema.Array(NodeSchema)),
				safeParseJson(goalMap.edges, [], Schema.Array(EdgeSchema)),
				safeParseJson(learnerMap.nodes, [], Schema.Array(NodeSchema)),
				safeParseJson(learnerMap.edges, [], Schema.Array(EdgeSchema)),
			],
			{ concurrency: 10 },
		);

	const diagnosis = compareMaps(
		parsedGoalMapNodes,
		parsedGoalMapEdges,
		parsedLearnerMapNodes,
		parsedLearnerMapEdges,
	);
	const edgeClassifications = classifyEdges(parsedGoalMapEdges, parsedLearnerMapEdges);

	return {
		learnerMap: {
			id: learnerMap.id,
			userId: learnerMap.userId,
			userName: learnerMap.userName,
			status: learnerMap.status,
			attempt: learnerMap.attempt,
			submittedAt: learnerMap.submittedAt?.getTime() ?? null,
			nodes: parsedLearnerMapNodes,
			edges: parsedLearnerMapEdges,
		},
		goalMap: {
			id: goalMap.id,
			title: goalMap.title,
			nodes: parsedGoalMapNodes,
			edges: parsedGoalMapEdges,
			direction: yield* Schema.encode(GoalMapDirectionSchema)(goalMap.direction),
		},
		diagnosis,
		edgeClassifications,
	};
});

export const getMultipleLearnerMaps = Effect.fn("getMultipleLearnerMaps")(function* (
	input: GetMultipleLearnerMapsInput,
) {
	if (input.learnerMapIds.length === 0) {
		return [];
	}

	const results = yield* Effect.all(
		input.learnerMapIds.map((id) =>
			getLearnerMapForAnalytics({ learnerMapId: id }).pipe(
				Effect.tapError((error) =>
					Effect.logError("Failed to get learner map for analytics", error).pipe(
						Effect.annotateLogs({ learnerMapId: id }),
					),
				),
				Effect.catchAll(() => Effect.succeed(null)),
			),
		),
		{ concurrency: 10 },
	);

	return results.filter((r) => r !== null);
});

export const getLearnerSummaryText = Effect.fn("getLearnerSummaryText")(function* (
	input: GetLearnerSummaryTextInput,
) {
	const db = yield* Database;

	const learnerMapRows = yield* db
		.select({
			learnerMapId: learnerMaps.id,
			learnerId: learnerMaps.userId,
			learnerName: user.name,
			status: learnerMaps.status,
			submittedAt: learnerMaps.submittedAt,
			controlText: learnerMaps.controlText,
		})
		.from(learnerMaps)
		.innerJoin(user, and(eq(learnerMaps.userId, user.id), isNull(user.deletedAt)))
		.where(and(eq(learnerMaps.id, input.learnerMapId), isNull(learnerMaps.deletedAt)))
		.limit(1);

	const learnerMap = learnerMapRows[0];
	if (!learnerMap) {
		return yield* new LearnerMapNotFoundError({
			learnerMapId: input.learnerMapId,
		});
	}

	return yield* Schema.encode(LearnerSummaryTextSchema)({
		learnerMapId: learnerMap.learnerMapId,
		learnerId: learnerMap.learnerId,
		learnerName: learnerMap.learnerName,
		status: learnerMap.status,
		submittedAt: learnerMap.submittedAt?.getTime() ?? null,
		controlText: learnerMap.controlText ?? null,
	});
});
