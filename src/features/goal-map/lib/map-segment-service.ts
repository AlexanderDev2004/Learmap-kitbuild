import { and, asc, eq, isNull } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { computeDepthSegments } from "@/features/goal-map/lib/segmentation";
import { GoalMapNotFoundError } from "@/lib/errors";
import { NonEmpty } from "@/lib/validation-schemas";
import { Database } from "@/server/db/client";
import { goalMaps, mapSegments } from "@/server/db/schema/app-schema";

export const ListSegmentsInput = Schema.Struct({
	goalMapId: NonEmpty("Goal map ID"),
});
export type ListSegmentsInput = typeof ListSegmentsInput.Type;

// Persisted frame box chosen by dragging/resizing the segment frame in the
// goal-map editor. Null/undefined = auto-fit the box to its member nodes.
export const FrameBoundsInput = Schema.Struct({
	x: Schema.Number,
	y: Schema.Number,
	w: Schema.Number,
	h: Schema.Number,
});
export type FrameBoundsInput = typeof FrameBoundsInput.Type;

export const SaveSegmentInput = Schema.Struct({
	goalMapId: NonEmpty("Goal map ID"),
	id: Schema.optional(Schema.String),
	name: NonEmpty("Segment name"),
	type: Schema.Union(Schema.Literal("paragraph"), Schema.Literal("depth-topic")),
	orderIndex: Schema.Int,
	// Optional group color as a hex string (e.g. "#2563eb").
	color: Schema.optional(Schema.Union(Schema.Null, NonEmpty("Segment color"))),
	nodeIds: Schema.Array(Schema.String),
	frameBounds: Schema.optional(Schema.Union(Schema.Null, FrameBoundsInput)),
});
export type SaveSegmentInput = typeof SaveSegmentInput.Type;

export const DeleteSegmentInput = Schema.Struct({
	id: NonEmpty("Segment ID"),
});
export type DeleteSegmentInput = typeof DeleteSegmentInput.Type;

export const AutoSegmentInput = Schema.Struct({
	goalMapId: NonEmpty("Goal map ID"),
});
export type AutoSegmentInput = typeof AutoSegmentInput.Type;

export type MapSegmentOutput = {
	id: string;
	goalMapId: string;
	name: string;
	type: "paragraph" | "depth-topic";
	orderIndex: number;
	color: string | null;
	nodeIds: string[];
	frameBounds: FrameBoundsInput | null;
};

/** Default group colors used when none is chosen (auto depth-topic levels). */
export const SEGMENT_COLOR_PALETTE = [
	"#2563eb",
	"#16a34a",
	"#d97706",
	"#9333ea",
	"#dc2626",
	"#0891b2",
	"#65a30d",
	"#db2777",
] as const;

export const listSegments = Effect.fn("listSegments")(function* (input: ListSegmentsInput) {
	const db = yield* Database;
	const rows = yield* db
		.select()
		.from(mapSegments)
		.where(and(eq(mapSegments.goalMapId, input.goalMapId), isNull(mapSegments.deletedAt)))
		.orderBy(asc(mapSegments.orderIndex), asc(mapSegments.createdAt));

	return rows.map((row) => ({
		id: row.id,
		goalMapId: row.goalMapId,
		name: row.name,
		type: row.type as "paragraph" | "depth-topic",
		orderIndex: row.orderIndex,
		color: row.color,
		nodeIds: Array.isArray(row.nodeIds) ? row.nodeIds : [],
		frameBounds:
			row.frameBounds &&
			typeof row.frameBounds === "object" &&
			!Array.isArray(row.frameBounds)
				? (row.frameBounds as FrameBoundsInput)
				: null,
	}));
});

export const saveSegment = Effect.fn("saveSegment")(function* (input: SaveSegmentInput) {
	const db = yield* Database;

	const gmRows = yield* db
		.select({ id: goalMaps.id })
		.from(goalMaps)
		.where(and(eq(goalMaps.id, input.goalMapId), isNull(goalMaps.deletedAt)))
		.limit(1);
	if (!gmRows[0]) {
		return yield* new GoalMapNotFoundError({ goalMapId: input.goalMapId });
	}

	const values = {
		goalMapId: input.goalMapId,
		name: input.name,
		type: input.type,
		orderIndex: input.orderIndex,
		color: input.color ?? null,
		nodeIds: input.nodeIds,
		frameBounds: input.frameBounds ?? null,
	};

	if (input.id) {
		yield* db
			.update(mapSegments)
			.set(values)
			.where(and(eq(mapSegments.id, input.id), isNull(mapSegments.deletedAt)));
		return { id: input.id };
	}

	const [row] = yield* db
		.insert(mapSegments)
		.values({ ...values, id: crypto.randomUUID() })
		.returning({ id: mapSegments.id });
	return { id: row.id };
});

export const deleteSegment = Effect.fn("deleteSegment")(function* (input: DeleteSegmentInput) {
	const db = yield* Database;
	yield* db
		.update(mapSegments)
		.set({ deletedAt: new Date() })
		.where(and(eq(mapSegments.id, input.id), isNull(mapSegments.deletedAt)));
	return true;
});

/** Soft-delete existing depth-topic segments, then store the fresh grouping. */
export const replaceDepthSegments = Effect.fn("replaceDepthSegments")(function* (
	input: AutoSegmentInput,
	nodeIdGroups: string[][],
) {
	const db = yield* Database;

	const gmRows = yield* db
		.select({ id: goalMaps.id })
		.from(goalMaps)
		.where(and(eq(goalMaps.id, input.goalMapId), isNull(goalMaps.deletedAt)))
		.limit(1);
	if (!gmRows[0]) {
		return yield* new GoalMapNotFoundError({ goalMapId: input.goalMapId });
	}

	yield* db
		.update(mapSegments)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(mapSegments.goalMapId, input.goalMapId),
				eq(mapSegments.type, "depth-topic"),
				isNull(mapSegments.deletedAt),
			),
		);

	const created: MapSegmentOutput[] = [];
	for (const [index, nodeIds] of nodeIdGroups.entries()) {
		if (nodeIds.length === 0) continue;
		const name = `Depth Level ${index + 1}`;
		const color = SEGMENT_COLOR_PALETTE[index % SEGMENT_COLOR_PALETTE.length];
		const [row] = yield* db
			.insert(mapSegments)
			.values({
				id: crypto.randomUUID(),
				goalMapId: input.goalMapId,
				name,
				type: "depth-topic",
				orderIndex: index,
				color,
				nodeIds,
			})
			.returning({ id: mapSegments.id });
		created.push({
			id: row.id,
			goalMapId: input.goalMapId,
			name,
			type: "depth-topic",
			orderIndex: index,
			color,
			nodeIds,
			frameBounds: null,
		});
	}

	return created;
});

/**
 * Depth-topic auto segmentation: compute depth levels from the goal map
 * graph and store them, replacing previous depth-topic segments.
 * Paragraph segments are left untouched.
 */
export const autoSegmentByDepth = Effect.fn("autoSegmentByDepth")(function* (
	input: AutoSegmentInput,
) {
	const db = yield* Database;

	const gmRows = yield* db
		.select({ nodes: goalMaps.nodes, edges: goalMaps.edges })
		.from(goalMaps)
		.where(and(eq(goalMaps.id, input.goalMapId), isNull(goalMaps.deletedAt)))
		.limit(1);
	const gm = gmRows[0];
	if (!gm) {
		return yield* new GoalMapNotFoundError({ goalMapId: input.goalMapId });
	}

	const nodes = (Array.isArray(gm.nodes) ? gm.nodes : []) as Array<{
		id: string;
		type: string;
	}>;
	const edges = (Array.isArray(gm.edges) ? gm.edges : []) as Array<{
		id: string;
		source: string;
		target: string;
	}>;

	const nodeIdGroups = computeDepthSegments(nodes as never, edges as never);

	return yield* replaceDepthSegments(input, nodeIdGroups);
});
