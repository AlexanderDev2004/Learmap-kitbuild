import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { safeParseJson } from "@/lib/utils";
import { Database } from "@/server/db/client";
import { goalMaps, kits, texts } from "@/server/db/schema/app-schema";

import {
	EdgeSchema,
	GetGoalMapInput,
	ListGoalMapsByTopicInput,
	MaterialImageSchema,
	NodeSchema,
} from "./goal-map-service.shared";

export const getGoalMap = Effect.fn("getGoalMap")(function* (input: GetGoalMapInput) {
	const db = yield* Database;
	const rows = yield* db
		.select({
			id: goalMaps.id,
			title: goalMaps.title,
			description: goalMaps.description,
			nodes: goalMaps.nodes,
			edges: goalMaps.edges,
			teacherId: goalMaps.teacherId,
			topicId: goalMaps.topicId,
			textId: goalMaps.textId,
			// Alias the column: selecting kits.id unaliased produces a second
			// result column named "id", which overwrites goalMaps.id when the
			// driver keys rows by column name (the map id became the kit id).
			kitId: sql<string | null>`kits.id`.as("kit_id"),
			materialText: texts.content,
			materialImages: texts.images,
		})
		.from(goalMaps)
		.leftJoin(kits, and(eq(kits.goalMapId, goalMaps.id), isNull(kits.deletedAt)))
		.leftJoin(texts, and(eq(goalMaps.textId, texts.id), isNull(texts.deletedAt)))
		.where(and(eq(goalMaps.id, input.goalMapId), isNull(goalMaps.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	const [nodes, edges, materialImages] = yield* Effect.all(
		[
			safeParseJson(row.nodes, [], Schema.Array(NodeSchema)),
			safeParseJson(row.edges, [], Schema.Array(EdgeSchema)),
			row.materialImages
				? safeParseJson(row.materialImages, [], Schema.Array(MaterialImageSchema))
				: Effect.succeed([]),
		],
		{ concurrency: 10 },
	);

	return {
		id: row.id,
		title: row.title,
		description: row.description,
		nodes,
		edges,
		teacherId: row.teacherId,
		topicId: row.topicId,
		materialText: row.materialText,
		materialImages,
		kitExists: row.kitId !== null,
	};
});

export const listGoalMaps = Effect.fn("listGoalMaps")(function* (userId: string) {
	const db = yield* Database;
	const rows = yield* db
		.select({
			id: goalMaps.id,
			title: goalMaps.title,
			description: goalMaps.description,
			teacherId: goalMaps.teacherId,
			topicId: goalMaps.topicId,
			nodes: goalMaps.nodes,
			edges: goalMaps.edges,
			createdAt: goalMaps.createdAt,
			updatedAt: goalMaps.updatedAt,
		})
		.from(goalMaps)
		.where(and(eq(goalMaps.teacherId, userId), isNull(goalMaps.deletedAt)))
		.orderBy(desc(goalMaps.updatedAt));

	return yield* Effect.all(
		rows.map((row) =>
			Effect.gen(function* () {
				const [nodes, edges] = yield* Effect.all(
					[
						safeParseJson(row.nodes, [], Schema.Array(NodeSchema)),
						safeParseJson(row.edges, [], Schema.Array(EdgeSchema)),
					],
					{ concurrency: 10 },
				);

				return {
					...row,
					nodes,
					edges,
					createdAt: row.createdAt?.getTime(),
					updatedAt: row.updatedAt?.getTime(),
				};
			}),
		),
	);
});

export const listGoalMapsByTopic = Effect.fn("listGoalMapsByTopic")(function* (
	input: ListGoalMapsByTopicInput,
) {
	const db = yield* Database;
	// Drizzle's query builder is immutable: `.where(...)` returns a new builder
	// and does not mutate the one it is called on, so the condition must be
	// passed inline (or the result assigned). Passing it inline keeps the
	// deletedAt / topicId filters from being silently dropped.
	const rows = yield* db
		.select({
			id: goalMaps.id,
			title: goalMaps.title,
			description: goalMaps.description,
			teacherId: goalMaps.teacherId,
			topicId: goalMaps.topicId,
			createdAt: goalMaps.createdAt,
			updatedAt: goalMaps.updatedAt,
			nodes: goalMaps.nodes,
			edges: goalMaps.edges,
			// Alias for the same reason as in getGoalMap above.
			kitId: sql<string | null>`kits.id`.as("kit_id"),
		})
		.from(goalMaps)
		.leftJoin(kits, eq(kits.goalMapId, goalMaps.id))
		.where(
			input.topicId
				? and(
						eq(goalMaps.topicId, input.topicId),
						isNull(goalMaps.deletedAt),
						isNull(kits.deletedAt),
					)
				: and(isNull(goalMaps.topicId), isNull(goalMaps.deletedAt), isNull(kits.deletedAt)),
		)
		.orderBy(desc(goalMaps.updatedAt));

	return yield* Effect.all(
		rows.map((row) =>
			Effect.gen(function* () {
				const [nodes, edges] = yield* Effect.all(
					[
						safeParseJson(row.nodes, [], Schema.Array(NodeSchema)),
						safeParseJson(row.edges, [], Schema.Array(EdgeSchema)),
					],
					{ concurrency: 10 },
				);

				return {
					...row,
					nodes,
					edges,
					createdAt: row.createdAt?.getTime(),
					updatedAt: row.updatedAt?.getTime(),
				};
			}),
		),
	);
});
