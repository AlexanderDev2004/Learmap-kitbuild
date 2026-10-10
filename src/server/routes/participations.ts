import { Hono } from "hono";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type {
	DiagnosisResult,
	McqQuestion,
	ParticipationPhase,
	ParticipationTimings,
	PhaseTiming,
	Segment,
	SegmentModel,
} from "@/shared/types";
import { PHASE_ORDER } from "@/shared/types";
import { diagnoseMap } from "@/server/lib/comparator";
import { segmentMap } from "@/server/lib/segmentation";
import type { MapEdge, MapNode } from "@/shared/types";
import { db } from "@/server/db/client";
import { experiments, goalMaps, materials, participations } from "@/server/db/schema";
import { authMiddleware, requireRole, type AppEnv } from "./middleware";

export const participationRoutes = new Hono<AppEnv>();
participationRoutes.use("*", authMiddleware);

function asNodes(value: unknown): MapNode[] {
	return (value as MapNode[]) ?? [];
}
function asEdges(value: unknown): MapEdge[] {
	return (value as MapEdge[]) ?? [];
}

/** Hilangkan kunci jawaban sebelum dikirim ke siswa. */
function publicizeQuestion(question: McqQuestion) {
	return { id: question.id, question: question.question, options: question.options };
}

function nextPhase(current: ParticipationPhase): ParticipationPhase {
	const index = PHASE_ORDER.indexOf(current);
	return PHASE_ORDER[Math.min(index + 1, PHASE_ORDER.length - 1)] as ParticipationPhase;
}

function scoreAnswers(questions: McqQuestion[], answers: Record<string, number>): number {
	if (questions.length === 0) return 0;
	const correct = questions.filter((q) => answers[q.id] === q.answerIndex).length;
	return correct / questions.length;
}

// ---------- Daftar eksperimen yang tersedia untuk siswa ----------

participationRoutes.get("/available", requireRole("siswa"), async (c) => {
	const user = c.get("user");
	const rows = await db
		.select({
			id: experiments.id,
			title: experiments.title,
			description: experiments.description,
			buildTimeLimitMinutes: experiments.buildTimeLimitMinutes,
		})
		.from(experiments)
		.orderBy(asc(experiments.createdAt));

	const mine = await db.select().from(participations).where(eq(participations.userId, user.id));
	const byExperiment = new Map(mine.map((p) => [p.experimentId, p]));
	return c.json(
		rows.map((experiment) => {
			const participation = byExperiment.get(experiment.id);
			return {
				...experiment,
				participationId: participation?.id ?? null,
				phase: participation?.phase ?? null,
				completedAt: participation?.completedAt ?? null,
			};
		}),
	);
});

// ---------- Mulai / lanjutkan partisipasi ----------

participationRoutes.post("/", requireRole("siswa"), async (c) => {
	const parsed = z.object({ experimentId: z.string() }).safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "experimentId wajib diisi" }, 400);
	const user = c.get("user");

	const existing = await db
		.select()
		.from(participations)
		.where(and(eq(participations.experimentId, parsed.data.experimentId), eq(participations.userId, user.id)))
		.limit(1);
	if (existing[0]) return c.json({ participationId: existing[0].id, segmentModel: existing[0].segmentModel, phase: existing[0].phase });

	const experimentRows = await db
		.select()
		.from(experiments)
		.where(eq(experiments.id, parsed.data.experimentId))
		.limit(1);
	if (!experimentRows[0]) return c.json({ error: "Eksperimen tidak ditemukan" }, 404);

	// Penetapan kelompok seimbang: pilih model dengan partisipan lebih sedikit.
	const counts = await db
		.select({ model: participations.segmentModel, total: sql<number>`count(*)` })
		.from(participations)
		.where(eq(participations.experimentId, parsed.data.experimentId))
		.groupBy(participations.segmentModel);
	const paragraphCount = counts.find((r) => r.model === "paragraph")?.total ?? 0;
	const depthCount = counts.find((r) => r.model === "depth")?.total ?? 0;
	const segmentModel: SegmentModel = paragraphCount <= depthCount ? "paragraph" : "depth";

	const row = {
		id: randomUUID(),
		experimentId: parsed.data.experimentId,
		userId: user.id,
		segmentModel,
		phase: "pretest" as ParticipationPhase,
		startedAt: new Date(),
		timings: {} as ParticipationTimings,
	};
	await db.insert(participations).values(row);
	return c.json({ participationId: row.id, segmentModel, phase: row.phase }, 201);
});

// ---------- Ambil status lengkap partisipasi ----------

participationRoutes.get("/:id", requireRole("siswa"), async (c) => {
	const user = c.get("user");
	const rows = await db
		.select()
		.from(participations)
		.where(and(eq(participations.id, (c.req.param("id") ?? "")), eq(participations.userId, user.id)))
		.limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);

	const experimentRows = await db
		.select()
		.from(experiments)
		.where(eq(experiments.id, participation.experimentId))
		.limit(1);
	const experiment = experimentRows[0];
	if (!experiment) return c.json({ error: "Eksperimen tidak ditemukan" }, 404);

	const goalMapRows = await db.select().from(goalMaps).where(eq(goalMaps.id, experiment.goalMapId)).limit(1);
	const goalMap = goalMapRows[0];
	if (!goalMap) return c.json({ error: "Goal map tidak ditemukan" }, 404);

	let materialContent: string | null = null;
	if (goalMap.materialId) {
		const materialRows = await db.select().from(materials).where(eq(materials.id, goalMap.materialId)).limit(1);
		materialContent = materialRows[0]?.content ?? null;
	}

	// Segmen kit sesuai model kelompok siswa: hanya daftar id simpul per segmen,
	// tanpa sisi — siswa harus menyusun relasinya sendiri.
	const graph = { nodes: asNodes(goalMap.nodes), edges: asEdges(goalMap.edges) };
	let segments: Segment[] = [];
	try {
		segments = segmentMap(graph, participation.segmentModel as SegmentModel);
	} catch {
		segments = [];
	}

	return c.json({
		id: participation.id,
		phase: participation.phase,
		segmentModel: participation.segmentModel,
		experiment: {
			id: experiment.id,
			title: experiment.title,
			description: experiment.description,
			buildTimeLimitMinutes: experiment.buildTimeLimitMinutes,
		},
		materialContent,
		segments,
		kitNodes: graph.nodes.map((node) => ({
			id: node.id,
			type: node.type,
			label: node.label,
			paragraph: node.paragraph ?? null,
		})),
		learnerMap:
			participation.learnerNodes != null
				? { nodes: asNodes(participation.learnerNodes), edges: asEdges(participation.learnerEdges) }
				: null,
		pretestScore: participation.pretestScore,
		posttestScore: participation.posttestScore,
		mapScore: participation.mapScore,
		diagnosis: participation.diagnosis as DiagnosisResult | null,
		pretest: participation.phase === "pretest" ? (experiment.pretest as McqQuestion[]).map(publicizeQuestion) : [],
		posttest:
			participation.phase === "posttest" ? (experiment.posttest as McqQuestion[]).map(publicizeQuestion) : [],
		questionnaire: participation.phase === "questionnaire" ? (experiment.questionnaire as unknown[]) : [],
		timings: (participation.timings as ParticipationTimings) ?? {},
	});
});

// ---------- Mulai fase membangun peta (menutup fase baca materi) ----------

participationRoutes.post("/:id/build/start", requireRole("siswa"), async (c) => {
	const rows = await db
		.select()
		.from(participations)
		.where(and(eq(participations.id, c.req.param("id") ?? ""), eq(participations.userId, c.get("user").id)))
		.limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);
	if (participation.phase !== "material" && participation.phase !== "build") {
		return c.json({ error: "Fase membaca materi belum selesai" }, 400);
	}

	const timings = { ...((participation.timings as ParticipationTimings) ?? {}) };
	timings.material = { ...(timings.material ?? {}), startedAt: timings.material?.startedAt ?? Date.now(), endedAt: Date.now() };
	timings.build = { ...(timings.build ?? {}), startedAt: Date.now() };

	await db
		.update(participations)
		.set({ phase: "build", timings })
		.where(eq(participations.id, participation.id));
	return c.json({ ok: true });
});

// ---------- Penandaan mulai/selesai fase (pencatatan waktu server) ----------

participationRoutes.post("/:id/phase", requireRole("siswa"), async (c) => {
	const parsed = z
		.object({ phase: z.enum(["pretest", "material", "build", "posttest", "questionnaire"]), action: z.enum(["start", "end"]) })
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Payload fase tidak valid" }, 400);

	const rows = await db.select().from(participations).where(eq(participations.id, (c.req.param("id") ?? ""))).limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);

	const timings = { ...((participation.timings as ParticipationTimings) ?? {}) };
	const timing: PhaseTiming = { ...(timings[parsed.data.phase] ?? {}) };
	if (parsed.data.action === "start") timing.startedAt = Date.now();
	else timing.endedAt = Date.now();
	timings[parsed.data.phase] = timing;

	await db.update(participations).set({ timings }).where(eq(participations.id, participation.id));
	return c.json({ ok: true });
});

// ---------- Simpan draf peta ----------

participationRoutes.post("/:id/build/save", requireRole("siswa"), async (c) => {
	const parsed = z
		.object({
			nodes: z.array(
				z.object({
					id: z.string(),
					type: z.enum(["concept", "link"]),
					label: z.string(),
					position: z.object({ x: z.number(), y: z.number() }),
				}),
			),
			edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() })),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Payload peta tidak valid" }, 400);

	const rows = await db.select().from(participations).where(eq(participations.id, (c.req.param("id") ?? ""))).limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);
	if (participation.phase !== "build") return c.json({ error: "Fase membangun peta sudah lewat" }, 400);

	await db
		.update(participations)
		.set({ learnerNodes: parsed.data.nodes, learnerEdges: parsed.data.edges })
		.where(eq(participations.id, participation.id));
	return c.json({ ok: true });
});

// ---------- Submit peta -> diagnosis otomatis ----------

participationRoutes.post("/:id/build/submit", requireRole("siswa"), async (c) => {
	const parsed = z
		.object({
			nodes: z.array(
				z.object({
					id: z.string(),
					type: z.enum(["concept", "link"]),
					label: z.string(),
					position: z.object({ x: z.number(), y: z.number() }),
				}),
			),
			edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() })),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Payload peta tidak valid" }, 400);

	const rows = await db.select().from(participations).where(eq(participations.id, (c.req.param("id") ?? ""))).limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);
	if (participation.phase !== "build") return c.json({ error: "Fase membangun peta sudah lewat" }, 400);

	const experimentRows = await db
		.select()
		.from(experiments)
		.where(eq(experiments.id, participation.experimentId))
		.limit(1);
	const goalMapRows = await db.select().from(goalMaps).where(eq(goalMaps.id, experimentRows[0]?.goalMapId ?? "")).limit(1);
	const goalMap = goalMapRows[0];
	if (!goalMap) return c.json({ error: "Goal map tidak ditemukan" }, 404);

	const diagnosis = diagnoseMap(
		{ nodes: asNodes(goalMap.nodes), edges: asEdges(goalMap.edges) },
		{ nodes: parsed.data.nodes, edges: parsed.data.edges },
	);

	const timings = { ...((participation.timings as ParticipationTimings) ?? {}) };
	timings.build = { ...(timings.build ?? {}), endedAt: Date.now() };

	await db
		.update(participations)
		.set({
			learnerNodes: parsed.data.nodes,
			learnerEdges: parsed.data.edges,
			diagnosis,
			mapScore: diagnosis.score,
			phase: nextPhase(participation.phase as ParticipationPhase),
			timings,
		})
		.where(eq(participations.id, participation.id));
	return c.json({ ok: true, diagnosis });
});

// ---------- Pretest / Posttest / Kuesioner ----------

const answersInput = z.object({ answers: z.record(z.string(), z.number()) });

async function submitAnswers(c: import("hono").Context<AppEnv>, kind: "pretest" | "posttest") {
	const parsed = answersInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Jawaban tidak valid" }, 400);

	const rows = await db.select().from(participations).where(eq(participations.id, (c.req.param("id") ?? ""))).limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);
	if (participation.phase !== kind) return c.json({ error: `Fase saat ini bukan ${kind}` }, 400);

	const experimentRows = await db
		.select()
		.from(experiments)
		.where(eq(experiments.id, participation.experimentId))
		.limit(1);
	const experiment = experimentRows[0];
	if (!experiment) return c.json({ error: "Eksperimen tidak ditemukan" }, 404);

	const questions = (kind === "pretest" ? (experiment.pretest as McqQuestion[]) : (experiment.posttest as McqQuestion[]));
	const score = scoreAnswers(questions, parsed.data.answers);

	const timings = { ...((participation.timings as ParticipationTimings) ?? {}) };
	timings[kind] = { ...(timings[kind] ?? {}), endedAt: Date.now() };

	await db
		.update(participations)
		.set(
			kind === "pretest"
				? { pretestAnswers: parsed.data.answers, pretestScore: score, phase: nextPhase(participation.phase as ParticipationPhase), timings }
				: { posttestAnswers: parsed.data.answers, posttestScore: score, phase: nextPhase(participation.phase as ParticipationPhase), timings },
		)
		.where(eq(participations.id, participation.id));
	return c.json({ ok: true, score });
}

participationRoutes.post("/:id/pretest", requireRole("siswa"), (c) => submitAnswers(c, "pretest"));
participationRoutes.post("/:id/posttest", requireRole("siswa"), (c) => submitAnswers(c, "posttest"));

participationRoutes.post("/:id/questionnaire", requireRole("siswa"), async (c) => {
	const parsed = z
		.object({ answers: z.record(z.string(), z.number().int().min(1).max(5)) })
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Jawaban tidak valid" }, 400);

	const rows = await db.select().from(participations).where(eq(participations.id, (c.req.param("id") ?? ""))).limit(1);
	const participation = rows[0];
	if (!participation) return c.json({ error: "Partisipasi tidak ditemukan" }, 404);
	if (participation.phase !== "questionnaire") return c.json({ error: "Fase saat ini bukan kuesioner" }, 400);

	const timings = { ...((participation.timings as ParticipationTimings) ?? {}) };
	timings.questionnaire = { ...(timings.questionnaire ?? {}), endedAt: Date.now() };

	await db
		.update(participations)
		.set({
			questionnaireAnswers: parsed.data.answers,
			phase: "completed",
			completedAt: new Date(),
			timings,
		})
		.where(eq(participations.id, participation.id));
	return c.json({ ok: true });
});
