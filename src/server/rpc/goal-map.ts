import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import {
	deleteGoalMap,
	saveGoalMap,
	updateMaterial,
} from "@/features/goal-map/lib/goal-map-service.mutations";
import {
	getGoalMap,
	listGoalMaps,
	listGoalMapsByTopic,
} from "@/features/goal-map/lib/goal-map-service.queries";
import {
	DeleteGoalMapInput,
	GetGoalMapInput,
	ListGoalMapsByTopicInput,
	SaveGoalMapInput,
	UpdateMaterialInput,
} from "@/features/goal-map/lib/goal-map-service.shared";
import {
	AutoSegmentInput,
	DeleteSegmentInput,
	ListSegmentsInput,
	SaveSegmentInput,
	autoSegmentByDepth,
	deleteSegment,
	listSegments,
	saveSegment,
} from "@/features/goal-map/lib/map-segment-service";
import { authMiddleware, requireRoleMiddleware } from "@/middlewares/auth";

import { AppRuntime } from "../app-runtime";
import {
	Rpc,
	TIMEOUT_DURATION,
	logRpcError,
	logAndReturnError,
	logAndReturnDefect,
} from "../rpc-helper";

export const getGoalMapRpc = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((raw) => Schema.decodeUnknownSync(GetGoalMapInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			getGoalMap(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("getGoalMap"),
				Effect.tapError(logRpcError("getGoalMap")),
				Effect.catchAll(logAndReturnError("getGoalMap")),
				Effect.catchAllDefect(logAndReturnDefect("getGoalMap")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const saveGoalMapRpc = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((raw) => Schema.decodeUnknownSync(SaveGoalMapInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			saveGoalMap(context.user.id, data, { isAdmin: context.user.role === "admin" }).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("saveGoalMap"),
				Effect.tapError(logRpcError("saveGoalMap")),
				Effect.catchTags({
					GoalMapValidationError: (e: { errors: string[] }) =>
						Rpc.err(`Validation failed: ${e.errors.join(", ")}`),
					GoalMapAccessDeniedError: (e: { goalMapId: string }) =>
						Rpc.forbidden(`Access denied to goal map ${e.goalMapId}`),
				}),
				Effect.catchAll(logAndReturnError("saveGoalMap")),
				Effect.catchAllDefect(logAndReturnDefect("saveGoalMap")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const listGoalMapsRpc = createServerFn()
	.middleware([authMiddleware])
	.handler(({ context }) =>
		AppRuntime.runPromise(
			listGoalMaps(context.user.id).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("listGoalMaps"),
				Effect.tapError(logRpcError("listGoalMaps")),
				Effect.catchAll(logAndReturnError("listGoalMaps")),
				Effect.catchAllDefect(logAndReturnDefect("listGoalMaps")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const listGoalMapsByTopicRpc = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((raw) => Schema.decodeUnknownSync(ListGoalMapsByTopicInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			listGoalMapsByTopic(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("listGoalMapsByTopic"),
				Effect.tapError(logRpcError("listGoalMapsByTopic")),
				Effect.catchAll(logAndReturnError("listGoalMapsByTopic")),
				Effect.catchAllDefect(logAndReturnDefect("listGoalMapsByTopic")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const deleteGoalMapRpc = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((raw) => Schema.decodeUnknownSync(DeleteGoalMapInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			deleteGoalMap(context.user.id, data, { isAdmin: context.user.role === "admin" }).pipe(
				Effect.map(() => Rpc.ok(true)),
				Effect.withSpan("deleteGoalMap"),
				Effect.tapError(logRpcError("deleteGoalMap")),
				Effect.catchTags({
					GoalMapNotFoundError: () => Rpc.notFound("Goal map"),
					GoalMapAccessDeniedError: (e: { goalMapId: string }) =>
						Rpc.forbidden(`Access denied to goal map ${e.goalMapId}`),
				}),
				Effect.catchAll(logAndReturnError("deleteGoalMap")),
				Effect.catchAllDefect(logAndReturnDefect("deleteGoalMap")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const updateMaterialRpc = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((raw) => Schema.decodeUnknownSync(UpdateMaterialInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			updateMaterial(context.user.id, data, { isAdmin: context.user.role === "admin" }).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("updateMaterial"),
				Effect.tapError(logRpcError("updateMaterial")),
				Effect.catchTags({
					GoalMapNotFoundError: () => Rpc.notFound("Goal map"),
					GoalMapAccessDeniedError: (e: { goalMapId: string }) =>
						Rpc.forbidden(`Access denied to goal map ${e.goalMapId}`),
				}),
				Effect.catchAll(logAndReturnError("updateMaterial")),
				Effect.catchAllDefect(logAndReturnDefect("updateMaterial")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const listSegmentsRpc = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((raw) => Schema.decodeUnknownSync(ListSegmentsInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			listSegments(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("listSegments"),
				Effect.tapError(logRpcError("listSegments")),
				Effect.catchAll(logAndReturnError("listSegments")),
				Effect.catchAllDefect(logAndReturnDefect("listSegments")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const saveSegmentRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(SaveSegmentInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			saveSegment(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("saveSegment"),
				Effect.tapError(logRpcError("saveSegment")),
				Effect.catchTags({
					GoalMapNotFoundError: () => Rpc.notFound("Goal map"),
				}),
				Effect.catchAll(logAndReturnError("saveSegment")),
				Effect.catchAllDefect(logAndReturnDefect("saveSegment")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const deleteSegmentRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(DeleteSegmentInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			deleteSegment(data).pipe(
				Effect.map(() => Rpc.ok(true)),
				Effect.withSpan("deleteSegment"),
				Effect.tapError(logRpcError("deleteSegment")),
				Effect.catchAll(logAndReturnError("deleteSegment")),
				Effect.catchAllDefect(logAndReturnDefect("deleteSegment")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const autoSegmentByDepthRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(AutoSegmentInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			autoSegmentByDepth(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("autoSegmentByDepth"),
				Effect.tapError(logRpcError("autoSegmentByDepth")),
				Effect.catchTags({
					GoalMapNotFoundError: () => Rpc.notFound("Goal map"),
				}),
				Effect.catchAll(logAndReturnError("autoSegmentByDepth")),
				Effect.catchAllDefect(logAndReturnDefect("autoSegmentByDepth")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const GoalMapRpc = {
	goalMap: () => ["goal-map"],
	getGoalMap: (data: GetGoalMapInput) =>
		queryOptions({
			queryKey: [...GoalMapRpc.goalMap(), data.goalMapId],
			queryFn: () => getGoalMapRpc({ data }),
		}),
	listGoalMaps: () =>
		queryOptions({
			queryKey: [...GoalMapRpc.goalMap(), "list"],
			queryFn: () => listGoalMapsRpc(),
		}),
	listGoalMapsByTopic: (data: ListGoalMapsByTopicInput) =>
		queryOptions({
			queryKey: [...GoalMapRpc.goalMap(), "by-topic", data.topicId ?? "null"],
			queryFn: () => listGoalMapsByTopicRpc({ data }),
		}),
	saveGoalMap: () =>
		mutationOptions({
			mutationKey: [...GoalMapRpc.goalMap()],
			mutationFn: (data: SaveGoalMapInput) => saveGoalMapRpc({ data }),
		}),
	deleteGoalMap: () =>
		mutationOptions({
			mutationKey: [...GoalMapRpc.goalMap()],
			mutationFn: (data: DeleteGoalMapInput) => deleteGoalMapRpc({ data }),
		}),
	updateMaterial: () =>
		mutationOptions({
			mutationKey: [...GoalMapRpc.goalMap(), "material"],
			mutationFn: (data: UpdateMaterialInput) => updateMaterialRpc({ data }),
		}),
	segments: () => [...GoalMapRpc.goalMap(), "segments"],
	listSegments: (data: ListSegmentsInput) =>
		queryOptions({
			queryKey: [...GoalMapRpc.segments(), data.goalMapId],
			queryFn: () => listSegmentsRpc({ data }),
		}),
	saveSegment: () =>
		mutationOptions({
			mutationKey: [...GoalMapRpc.segments()],
			mutationFn: (data: SaveSegmentInput) => saveSegmentRpc({ data }),
		}),
	deleteSegment: () =>
		mutationOptions({
			mutationKey: [...GoalMapRpc.segments()],
			mutationFn: (data: DeleteSegmentInput) => deleteSegmentRpc({ data }),
		}),
	autoSegmentByDepth: () =>
		mutationOptions({
			mutationKey: [...GoalMapRpc.segments(), "auto-depth"],
			mutationFn: (data: AutoSegmentInput) => autoSegmentByDepthRpc({ data }),
		}),
};
