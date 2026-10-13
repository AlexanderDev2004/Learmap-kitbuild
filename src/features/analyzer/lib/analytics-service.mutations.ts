import { Effect, Schema } from "effect";
import Papa from "papaparse";

import { ExportAnalyticsDataInput, ExportResultSchema } from "./analytics-service.shared";

export const exportAnalyticsData = Effect.fn("exportAnalyticsData")(function* (
	input: ExportAnalyticsDataInput,
) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "").substring(0, 15);

	if (input.format === "csv") {
		const csvData = [
			[
				"UserID",
				"UserEmail",
				"UserName",
				"AssignmentTitle",
				"StudyGroup",
				"Condition",
				"LearnerMapID",
				"Status",
				"Attempt",
				"Score",
				"Correct",
				"Missing",
				"Excessive",
				"TotalGoalPropositions",
				"SubmittedAt",
				"MapBuildDurationSeconds",
				"PreTestRaw",
				"PreTestTotal",
				"PreTestScore",
				"PreTestDurationSeconds",
				"PostTestRaw",
				"PostTestTotal",
				"PostTestScore",
				"PostTestDurationSeconds",
			],
		];

		// One row per student per assignment: study group, condition, map
		// diagnosis, and pre/post test results — the thesis measured variables —
		// so the file can be analyzed directly in Excel/R/SPSS.
		const value = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
		const analytics = input.analytics as {
			assignment: { title: string };
			learners: Array<Record<string, unknown>>;
			notStartedLearners?: Array<Record<string, unknown>> | null;
		};

		for (const learner of analytics.learners) {
			csvData.push([
				value(learner.userId),
				value(learner.userEmail),
				value(learner.userName),
				value(analytics.assignment.title),
				value(learner.studyGroup),
				value(learner.condition),
				value(learner.learnerMapId),
				value(learner.status),
				value(learner.attempt),
				value(learner.score),
				value(learner.correct),
				value(learner.missing),
				value(learner.excessive),
				value(learner.totalGoalPropositions),
				learner.submittedAt ? new Date(learner.submittedAt as number).toISOString() : "",
				value(learner.mapBuildDurationSeconds),
				value(learner.preTestRaw),
				value(learner.preTestTotal),
				value(learner.preTestScore),
				value(learner.preTestDurationSeconds),
				value(learner.postTestRaw),
				value(learner.postTestTotal),
				value(learner.postTestScore),
				value(learner.postTestDurationSeconds),
			]);
		}

		for (const learner of analytics.notStartedLearners ?? []) {
			csvData.push([
				value(learner.userId),
				value(learner.userEmail),
				value(learner.userName),
				value(analytics.assignment.title),
				value(learner.studyGroup),
				"",
				"",
				"",
				"not_started",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
			]);
		}

		const csv = Papa.unparse(csvData, { header: false });

		return yield* Schema.encode(ExportResultSchema)({
			filename: `KB-Analytics-${timestamp}.csv`,
			data: csv,
			contentType: "text/csv",
		});
	}

	const jsonData = {
		assignment: input.analytics.assignment,
		goalMap: input.analytics.goalMap,
		learners: input.analytics.learners,
		notStartedLearners: input.analytics.notStartedLearners ?? [],
		summary: input.analytics.summary,
		exportedAt: new Date().toISOString(),
	};

	return yield* Schema.encode(ExportResultSchema)({
		filename: `KB-Analytics-${timestamp}.json`,
		// @effect-diagnostics-next-line preferSchemaOverJson:off
		data: JSON.stringify(jsonData, null, 2),
		contentType: "application/json",
	});
});
