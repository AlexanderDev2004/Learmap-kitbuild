import { Hono } from "hono";
import { eq } from "drizzle-orm";

import type { DiagnosisResult, ParticipationTimings } from "@/shared/types";
import type { MapEdge, MapNode } from "@/shared/types";
import { db } from "@/server/db/client";
import { experiments, participations, users } from "@/server/db/schema";
import { authMiddleware, requireRole, type AppEnv } from "./middleware";

function asNodes(value: unknown): MapNode[] {
	return (value as MapNode[]) ?? [];
}
function asEdges(value: unknown): MapEdge[] {
	return (value as MapEdge[]) ?? [];
}

export const resultRoutes = new Hono<AppEnv>();
resultRoutes.use("*", authMiddleware, requireRole("peneliti"));

export interface ResultRow {
	participationId: string;
	experimentTitle: string;
	studentName: string;
	segmentModel: "paragraph" | "depth";
	phase: string;
	pretestScore: number | null;
	posttestScore: number | null;
	mapScore: number | null;
	correctPropositions: number | null;
	missingPropositions: number | null;
	excessivePropositions: number | null;
	buildDurationMs: number | null;
	totalDurationMs: number | null;
	startedAt: string;
	completedAt: string | null;
}

export async function collectResults(experimentId: string): Promise<ResultRow[]> {
	const rows = await db
		.select({
			participation: participations,
			userName: users.name,
			experimentTitle: experiments.title,
		})
		.from(participations)
		.innerJoin(users, eq(participations.userId, users.id))
		.innerJoin(experiments, eq(participations.experimentId, experiments.id))
		.where(eq(participations.experimentId, experimentId));

	return rows.map(({ participation, userName, experimentTitle }) => {
		const timings = (participation.timings as ParticipationTimings) ?? {};
		const buildDurationMs =
			timings.build?.startedAt && timings.build?.endedAt ? timings.build.endedAt - timings.build.startedAt : null;
		const totalDurationMs = participation.completedAt
			? new Date(participation.completedAt).getTime() - new Date(participation.startedAt).getTime()
			: null;
		const diagnosis = participation.diagnosis as DiagnosisResult | null;
		return {
			participationId: participation.id,
			experimentTitle,
			studentName: userName,
			segmentModel: participation.segmentModel as "paragraph" | "depth",
			phase: participation.phase,
			pretestScore: participation.pretestScore,
			posttestScore: participation.posttestScore,
			mapScore: participation.mapScore,
			correctPropositions: diagnosis?.correct ?? null,
			missingPropositions: diagnosis?.missing ?? null,
			excessivePropositions: diagnosis?.excessive ?? null,
			buildDurationMs,
			totalDurationMs,
			startedAt: new Date(participation.startedAt).toISOString(),
			completedAt: participation.completedAt ? new Date(participation.completedAt).toISOString() : null,
		};
	});
}

function toCsv(rows: ResultRow[]): string {
	const header = [
		"participation_id",
		"eksperimen",
		"siswa",
		"kelompok",
		"fase",
		"pretest",
		"posttest",
		"map_score",
		"prop_benar",
		"prop_missing",
		"prop_excessive",
		"durasi_build_ms",
		"durasi_total_ms",
		"mulai",
		"selesai",
	];
	const lines = rows.map((row) =>
		[
			row.participationId,
			row.experimentTitle,
			row.studentName,
			row.segmentModel,
			row.phase,
			row.pretestScore?.toFixed(4) ?? "",
			row.posttestScore?.toFixed(4) ?? "",
			row.mapScore?.toFixed(4) ?? "",
			row.correctPropositions ?? "",
			row.missingPropositions ?? "",
			row.excessivePropositions ?? "",
			row.buildDurationMs ?? "",
			row.totalDurationMs ?? "",
			row.startedAt,
			row.completedAt ?? "",
		]
			.map((value) => `"${String(value).replaceAll('"', '""')}"`)
			.join(","),
	);
	return [header.join(","), ...lines].join("\n");
}

resultRoutes.get("/", async (c) => {
	const experimentId = c.req.query("experimentId");
	if (!experimentId) return c.json({ error: "experimentId wajib diisi" }, 400);
	return c.json(await collectResults(experimentId));
});

/** Detail satu partisipan: peta siswa + rincian diagnosis (untuk dialog peneliti). */
resultRoutes.get("/:participationId", async (c) => {
	const rows = await db
		.select({ participation: participations })
		.from(participations)
		.innerJoin(users, eq(participations.userId, users.id))
		.where(eq(participations.id, c.req.param("participationId") ?? ""))
		.limit(1);
	const participation = rows[0]?.participation;
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);

	const diagnosis = participation.diagnosis as DiagnosisResult | null;
	return c.json({
		participationId: participation.id,
		segmentModel: participation.segmentModel,
		phase: participation.phase,
		pretestScore: participation.pretestScore,
		posttestScore: participation.posttestScore,
		mapScore: participation.mapScore,
		diagnosis,
		learnerMap:
			participation.learnerNodes != null
				? { nodes: asNodes(participation.learnerNodes), edges: asEdges(participation.learnerEdges) }
				: null,
	});
});

resultRoutes.get("/export", async (c) => {
	const experimentId = c.req.query("experimentId");
	if (!experimentId) return c.json({ error: "experimentId wajib diisi" }, 400);
	const csv = toCsv(await collectResults(experimentId));
	return c.body(csv, 200, {
		"Content-Type": "text/csv; charset=utf-8",
		"Content-Disposition": `attachment; filename="learnmap-results-${experimentId}.csv"`,
	});
});
