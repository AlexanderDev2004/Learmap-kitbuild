import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { exportAnalyticsData } from "./analytics-service.mutations";

const mockAnalytics = {
	assignment: { title: "Test Assignment" },
	goalMap: { id: "gm-1", title: "Test Goal Map" },
	learners: [
		{
			userId: "u1",
			userName: "Alice",
			userEmail: "alice@kitbuild.mail",
			learnerMapId: "lm-1",
			studyGroup: "experiment" as const,
			condition: "concept_map" as const,
			status: "submitted" as const,
			attempt: 1,
			score: 0.8,
			correct: 4,
			missing: 1,
			excessive: 0,
			totalGoalPropositions: 5,
			submittedAt: Date.now(),
			preTestRaw: 3,
			preTestTotal: 5,
			preTestScore: 60,
			preTestDurationSeconds: 120,
			postTestRaw: 5,
			postTestTotal: 5,
			postTestScore: 100,
			postTestDurationSeconds: 90,
		},
		{
			userId: "u2",
			userName: "Bob",
			userEmail: "bob@kitbuild.mail",
			learnerMapId: "lm-2",
			studyGroup: "control" as const,
			condition: "summarizing" as const,
			status: "submitted" as const,
			attempt: 1,
			score: 0.6,
			correct: 3,
			missing: 2,
			excessive: 1,
			totalGoalPropositions: 5,
			submittedAt: Date.now(),
			preTestRaw: null,
			preTestTotal: null,
			preTestScore: null,
			preTestDurationSeconds: null,
			postTestRaw: null,
			postTestTotal: null,
			postTestScore: null,
			postTestDurationSeconds: null,
		},
	],
	notStartedLearners: [
		{
			userId: "u3",
			userName: "Carol",
			userEmail: "carol@kitbuild.mail",
			studyGroup: "experiment" as const,
		},
	],
	summary: {
		totalLearners: 2,
		submittedCount: 2,
		draftCount: 0,
		avgScore: 0.7,
		medianScore: 0.7,
		highestScore: 0.8,
		lowestScore: 0.6,
	},
};

describe("exportAnalyticsData", () => {
	it("should export as CSV with correct headers and rows", () => {
		const result = Effect.runSync(
			exportAnalyticsData({ analytics: mockAnalytics, format: "csv" }),
		);
		expect(result.contentType).toBe("text/csv");
		expect(result.filename).toMatch(/^KB-Analytics-[^.]+.csv$/);
		expect(result.data).toContain("u1");
		expect(result.data).toContain("Alice");
		expect(result.data).toContain("alice@kitbuild.mail");
		expect(result.data).toContain("experiment");
		expect(result.data).toContain("concept_map");
		expect(result.data).toContain("u2");
		expect(result.data).toContain("Bob");
		expect(result.data).toContain("summarizing");
		expect(result.data).toContain("Test Assignment");
		// Pre/post test columns carry the measured scores.
		expect(result.data).toContain("60");
		expect(result.data).toContain("100");
		// Targeted students who never started still get a row.
		expect(result.data).toContain("u3");
		expect(result.data).toContain("not_started");
		// Header row: UserID first, PostTestDurationSeconds last (Papa uses CRLF).
		const header = result.data.split(/\r?\n/)[0];
		expect(header.startsWith("UserID,UserEmail,UserName")).toBe(true);
		expect(header.endsWith("PostTestDurationSeconds")).toBe(true);
	});

	it("should export as JSON with all sections", () => {
		const result = Effect.runSync(
			exportAnalyticsData({ analytics: mockAnalytics, format: "json" }),
		);
		expect(result.contentType).toBe("application/json");
		expect(result.filename).toMatch(/^KB-Analytics-[^.]+.json$/);
		const parsed = JSON.parse(result.data);
		expect(parsed.assignment.title).toBe("Test Assignment");
		expect(parsed.goalMap.title).toBe("Test Goal Map");
		expect(parsed.learners).toHaveLength(2);
		expect(parsed.notStartedLearners).toHaveLength(1);
		expect(parsed.summary.avgScore).toBe(0.7);
		expect(parsed.exportedAt).toBeDefined();
	});

	it("should handle single learner", () => {
		const single = {
			...mockAnalytics,
			learners: [mockAnalytics.learners[0]],
			summary: { ...mockAnalytics.summary, totalLearners: 1 },
		};
		const result = Effect.runSync(exportAnalyticsData({ analytics: single, format: "json" }));
		const parsed = JSON.parse(result.data);
		expect(parsed.learners).toHaveLength(1);
	});

	it("should handle empty learners array", () => {
		const empty = {
			...mockAnalytics,
			learners: [],
			summary: { ...mockAnalytics.summary, totalLearners: 0, submittedCount: 0 },
		};
		const csvResult = Effect.runSync(exportAnalyticsData({ analytics: empty, format: "csv" }));
		expect(csvResult.data).toBeDefined();

		const jsonResult = Effect.runSync(
			exportAnalyticsData({ analytics: empty, format: "json" }),
		);
		const parsed = JSON.parse(jsonResult.data);
		expect(parsed.learners).toEqual([]);
	});
});
