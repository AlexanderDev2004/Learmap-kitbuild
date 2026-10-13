/**
 * Photosynthesis demo seed — for lecturer/supervisor demonstration.
 *
 * Creates a complete "Fotosintesis" research demo on top of the base seed:
 *   - Topic + reading text (4 paragraphs) + goal map (14 propositions)
 *   - Pre-test / post-test forms (10 MCQ about photosynthesis)
 *   - TWO assignments over the SAME goal map, differing only in segmentation:
 *       Kelompok A — kit segmented by PARAGRAPH structure (Segmenting by Paragraph)
 *       Kelompok B — kit segmented by TOPIC DEPTH (Segmenting by Depth-Topic)
 *     Node colors visualize the segments (red/amber/sky/green).
 *   - Two demo students (Sari = experiment/paragraf, Rudi = control/depth)
 *     with submitted learner maps + automatic diagnoses + pre/post responses.
 *
 * Run AFTER `db:seed` (idempotent — safe to re-run):
 *   pnpm run db:seed:fotosintesis
 */
import { and, eq, inArray } from "drizzle-orm";
import { Effect, Layer, Logger } from "effect";

import { compareMaps, type Edge, type Node } from "@/features/learner-map/lib/comparator";
import { Auth } from "@/lib/auth";
import { RateLimiter } from "@/lib/rate-limiter";
import { randomString } from "@/lib/utils";
import { Database, DatabaseLive } from "@/server/db/client";
import {
	assignments,
	assignmentTargets,
	diagnoses,
	formProgress,
	formResponses,
	forms,
	goalMaps,
	kits,
	learnerMaps,
	questions,
	texts,
	topics,
} from "@/server/db/schema/app-schema";
import { cohortMembers, cohorts, user } from "@/server/db/schema/auth-schema";

import { GOAL_MAP_TO_MATERIAL } from "./data/materials.js";

const TEACHER_EMAIL = "alex@kitbuild.mail";
const MATERIAL_TITLE = "Fotosintesis";

// ---------------------------------------------------------------------------
// Segment colorings — the two research treatments over the SAME goal map.
// Colors match the kit text-node palette (red/amber/sky/green).
// ---------------------------------------------------------------------------

/** Kelompok A: segments follow the READING PARAGRAPH structure. */
const PARAGRAF_NODE_COLORS: Record<string, string> = {
	// Segmen 1 — Pengertian & letak (paragraf 1)
	fotos: "red",
	daun: "red",
	kloroplas: "red",
	// Segmen 2 — Syarat fotosintesis (paragraf 2)
	klorofil: "amber",
	cahaya: "amber",
	co2: "amber",
	stomata: "amber",
	air: "amber",
	// Segmen 3 — Proses (paragraf 3)
	"reaksi-terang": "sky",
	"reaksi-gelap": "sky",
	// Segmen 4 — Hasil (paragraf 4)
	glukosa: "green",
	oksigen: "green",
	energi: "green",
};

/** Kelompok B: segments follow the TOPIC DEPTH hierarchy (umum → spesifik). */
const DEPTH_NODE_COLORS: Record<string, string> = {
	// Level 0–1 — konsep inti (akar hierarki)
	fotos: "red",
	daun: "red",
	air: "red",
	glukosa: "red",
	oksigen: "red",
	// Level 2 — konsep menengah
	kloroplas: "amber",
	"reaksi-terang": "amber",
	"reaksi-gelap": "amber",
	energi: "amber",
	// Level 3 — konsep rincian
	klorofil: "sky",
	cahaya: "sky",
	co2: "sky",
	// Level 4 — paling spesifik
	stomata: "green",
};

type SeedQuestion = {
	questionText: string;
	options: Array<{ id: string; text: string }>;
	correctOptionId: string;
};

function mcq(
	questionIndex: number,
	texts_: [string, string, string, string],
	correctIndex: number,
): { options: Array<{ id: string; text: string }>; correctOptionId: string } {
	const options = texts_.map((text, idx) => ({
		id: `q${questionIndex}_opt${idx}`,
		text,
	}));
	return {
		options,
		correctOptionId: `q${questionIndex}_opt${correctIndex}`,
	};
}

function question(questionText: string, q: ReturnType<typeof mcq>): SeedQuestion {
	return { questionText, options: q.options, correctOptionId: q.correctOptionId };
}

const PHOTOSYNTHESIS_QUESTIONS: SeedQuestion[] = [
	question(
		"Di bagian tumbuhan manakah fotosintesis terjadi?",
		mcq(0, ["Daun", "Akar", "Batang", "Bunga"], 0),
	),
	question(
		"Organel sel tempat berlangsungnya fotosintesis adalah ...",
		mcq(1, ["Kloroplas", "Mitokondria", "Ribosom", "Vakuola"], 0),
	),
	question(
		"Pigmen hijau yang terdapat di dalam kloroplas disebut ...",
		mcq(2, ["Klorofil", "Karoten", "Xantofil", "Hemoglobin"], 0),
	),
	question(
		"Karbon dioksida (CO₂) masuk ke dalam daun melalui ...",
		mcq(3, ["Stomata", "Kutikula", "Xilem", "Floem"], 0),
	),
	question(
		"Selain karbon dioksida, bahan yang dibutuhkan fotosintesis adalah ...",
		mcq(4, ["Air", "Oksigen", "Glukosa", "Protein"], 0),
	),
	question(
		"Hasil dari reaksi terang fotosintesis adalah ...",
		mcq(5, ["Oksigen", "Karbon dioksida", "Glukosa", "Klorofil"], 0),
	),
	question(
		"Pada reaksi gelap, karbon dioksida diolah menjadi ...",
		mcq(6, ["Glukosa", "Oksigen", "Air", "Klorofil"], 0),
	),
	question(
		"Glukosa hasil fotosintesis disimpan oleh tumbuhan dalam bentuk ...",
		mcq(7, ["Energi kimia", "Energi panas", "Energi listrik", "Energi gerak"], 0),
	),
	question(
		"Sumber energi yang digunakan pada reaksi terang adalah ...",
		mcq(8, ["Cahaya matahari", "Angin", "Suhu udara", "Kelembapan tanah"], 0),
	),
	question(
		"Manfaat oksigen hasil fotosintesis bagi makhluk hidup lain adalah untuk ...",
		mcq(9, ["Pernapasan", "Fotosintesis", "Penyerapan air", "Penguapan"], 0),
	),
];

// Pre/post response patterns (1 = correct, 0 = wrong) per student per form.
const RESPONSE_SCORES: Record<string, Record<"pre" | "post", number[]>> = {
	"sari@kitbuild.mail": {
		pre: [1, 1, 0, 1, 0, 0, 1, 0, 1, 0], // 5/10
		post: [1, 1, 1, 1, 1, 1, 1, 0, 1, 1], // 9/10
	},
	"rudi@kitbuild.mail": {
		pre: [1, 0, 0, 1, 1, 0, 0, 1, 0, 0], // 4/10
		post: [1, 1, 1, 1, 1, 1, 0, 1, 0, 1], // 8/10
	},
};

type LearnerMapConfig = {
	studentEmail: string;
	assignmentKey: "paragraf" | "depth";
	correctEdgeIds: string[];
	excessiveEdges: Array<{ source: string; target: string }>;
};

// Sari (Kelompok A) nails the first 10 propositions; Rudi (Kelompok B) the first 8.
const LEARNER_MAP_CONFIGS: LearnerMapConfig[] = [
	{
		studentEmail: "sari@kitbuild.mail",
		assignmentKey: "paragraf",
		correctEdgeIds: Array.from({ length: 20 }, (_, i) => `e${i + 1}`),
		excessiveEdges: [
			{ source: "daun", target: "glukosa" },
			{ source: "cahaya", target: "air" },
		],
	},
	{
		studentEmail: "rudi@kitbuild.mail",
		assignmentKey: "depth",
		correctEdgeIds: Array.from({ length: 16 }, (_, i) => `e${i + 1}`),
		excessiveEdges: [{ source: "fotos", target: "energi" }],
	},
];

function mcqOptionsJson(q: SeedQuestion): string {
	return JSON.stringify({
		type: "mcq",
		options: q.options,
		correctOptionIds: [q.correctOptionId],
		shuffle: true,
	});
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureUser(input: {
	email: string;
	password: string;
	name: string;
	role: "admin" | "teacher" | "student";
	demographics?: {
		studentId: string;
		age: number;
		studyGroup: "experiment" | "control";
	};
}) {
	return Effect.gen(function* () {
		const db = yield* Database;
		const authService = yield* Auth;

		const existing = yield* db.select().from(user).where(eq(user.email, input.email)).limit(1);

		let userId: string;
		if (existing[0]) {
			userId = existing[0].id;
		} else {
			const signup = yield* Effect.tryPromise({
				try: () =>
					authService.api.signUpEmail({
						body: {
							email: input.email,
							password: input.password,
							name: input.name,
							studyGroup: input.demographics?.studyGroup ?? "experiment",
						},
					}),
				catch: (error) => {
					console.error(`Failed to create user ${input.email}:`, error);
					return { user: null };
				},
			});
			if (!signup.user) {
				return yield* Effect.fail(new Error(`Gagal membuat user ${input.email}`));
			}
			userId = signup.user.id;
			yield* Effect.log(`  Created user: ${input.email}`);
		}

		const current = yield* db.select().from(user).where(eq(user.id, userId)).limit(1);
		if (current[0]?.role !== input.role || input.demographics) {
			yield* db
				.update(user)
				.set({
					role: input.role,
					...(input.demographics
						? {
								studentId: input.demographics.studentId,
								age: input.demographics.age,
								studyGroup: input.demographics.studyGroup,
							}
						: {}),
				})
				.where(eq(user.id, userId));
		}

		return userId;
	});
}

function upsertForm(input: {
	title: string;
	description: string;
	type: "pre_test" | "post_test";
	teacherId: string;
	readingMaterialContent: string;
}) {
	return Effect.gen(function* () {
		const db = yield* Database;

		const existing = yield* db
			.select()
			.from(forms)
			.where(and(eq(forms.title, input.title)))
			.limit(1);

		const readingMaterialSections = [
			{
				id: `seed-reading-${input.title}`,
				title: MATERIAL_TITLE,
				startQuestion: 1,
				endQuestion: PHOTOSYNTHESIS_QUESTIONS.length,
				content: input.readingMaterialContent,
			},
		];

		let formId: string;
		if (existing[0]) {
			formId = existing[0].id;
			yield* db
				.update(forms)
				.set({
					description: input.description,
					type: input.type,
					audience: "all",
					status: "published",
					readingMaterialSections,
					createdBy: input.teacherId,
				})
				.where(eq(forms.id, formId));
		} else {
			formId = randomString();
			yield* db.insert(forms).values({
				id: formId,
				title: input.title,
				description: input.description,
				type: input.type,
				audience: "all",
				status: "published",
				readingMaterialSections,
				createdBy: input.teacherId,
			});
		}

		// Upsert questions
		const existingQuestions = yield* db
			.select()
			.from(questions)
			.where(eq(questions.formId, formId));

		for (const [index, q] of PHOTOSYNTHESIS_QUESTIONS.entries()) {
			const values = {
				formId,
				type: "mcq" as const,
				questionText: q.questionText,
				options: mcqOptionsJson(q),
				orderIndex: index,
				required: false,
			};
			const existingQuestion = existingQuestions[index];
			if (existingQuestion) {
				yield* db
					.update(questions)
					.set(values)
					.where(eq(questions.id, existingQuestion.id));
			} else {
				yield* db.insert(questions).values({ id: randomString(), ...values });
			}
		}
		if (existingQuestions.length > PHOTOSYNTHESIS_QUESTIONS.length) {
			const stale = existingQuestions.slice(PHOTOSYNTHESIS_QUESTIONS.length);
			yield* db.delete(questions).where(
				inArray(
					questions.id,
					stale.map((q) => q.id),
				),
			);
		}

		return formId;
	});
}

// ---------------------------------------------------------------------------
// Main program
// ---------------------------------------------------------------------------

const program = Effect.gen(function* () {
	const db = yield* Database;
	const material = GOAL_MAP_TO_MATERIAL[MATERIAL_TITLE];
	if (!material) {
		return yield* Effect.fail(
			new Error(`Material "${MATERIAL_TITLE}" tidak ditemukan di scripts/seed/data/`),
		);
	}

	yield* Effect.log("--- Seed demo Fotosintesis ---");

	// 1. Users -----------------------------------------------------------------
	const teacherId = yield* ensureUser({
		email: TEACHER_EMAIL,
		password: "alex12345",
		name: "Alex",
		role: "teacher",
	});
	const sariId = yield* ensureUser({
		email: "sari@kitbuild.mail",
		password: "sari12345",
		name: "Sari",
		role: "student",
		demographics: { studentId: "STD-002", age: 17, studyGroup: "experiment" },
	});
	const rudiId = yield* ensureUser({
		email: "rudi@kitbuild.mail",
		password: "rudi12345",
		name: "Rudi",
		role: "student",
		demographics: { studentId: "STD-003", age: 17, studyGroup: "control" },
	});

	// 2. Cohorts (reuse the base-seed cohorts, create when missing) -------------
	const cohortNames = ["2A Marketing Management", "2B Marketing Management"];
	const cohortIds: string[] = [];
	for (const name of cohortNames) {
		const existing = yield* db.select().from(cohorts).where(eq(cohorts.name, name)).limit(1);
		if (existing[0]) {
			cohortIds.push(existing[0].id);
		} else {
			const cohortId = randomString();
			yield* db.insert(cohorts).values({ id: cohortId, name, description: `${name} cohort` });
			cohortIds.push(cohortId);
			yield* Effect.log(`  Created cohort: ${name}`);
		}
	}
	for (const [studentId, label] of [
		[sariId, "sari"],
		[rudiId, "rudi"],
	] as const) {
		for (const cohortId of cohortIds) {
			const existing = yield* db
				.select()
				.from(cohortMembers)
				.where(
					and(eq(cohortMembers.cohortId, cohortId), eq(cohortMembers.userId, studentId)),
				)
				.limit(1);
			if (!existing[0]) {
				yield* db.insert(cohortMembers).values({
					id: randomString(),
					cohortId,
					userId: studentId,
					role: "member",
				});
				yield* Effect.log(`  Added ${label} to a cohort`);
			}
		}
	}

	// 3. Topic + text + goal map -------------------------------------------------
	const existingTopic = yield* db
		.select()
		.from(topics)
		.where(eq(topics.title, MATERIAL_TITLE))
		.limit(1);
	let topicId: string;
	if (existingTopic[0]) {
		topicId = existingTopic[0].id;
	} else {
		topicId = randomString();
		yield* db.insert(topics).values({
			id: topicId,
			title: MATERIAL_TITLE,
			description: material.description,
		});
		yield* Effect.log("  Created topic: Fotosintesis");
	}

	const existingText = yield* db
		.select()
		.from(texts)
		.where(eq(texts.title, material.title))
		.limit(1);
	let textId: string;
	if (existingText[0]) {
		textId = existingText[0].id;
		yield* db.update(texts).set({ content: material.content }).where(eq(texts.id, textId));
	} else {
		textId = randomString();
		yield* db.insert(texts).values({
			id: textId,
			title: material.title,
			content: material.content,
		});
	}

	const existingGoalMap = yield* db
		.select()
		.from(goalMaps)
		.where(eq(goalMaps.title, material.title))
		.limit(1);
	let goalMapId: string;
	const goalMapData = {
		nodes: material.nodes,
		edges: material.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
	};
	if (existingGoalMap[0]) {
		goalMapId = existingGoalMap[0].id;
		yield* db
			.update(goalMaps)
			.set({
				description: material.description,
				nodes: goalMapData.nodes,
				edges: goalMapData.edges,
				textId,
				topicId,
				teacherId,
			})
			.where(eq(goalMaps.id, goalMapId));
		yield* Effect.log("  Updated goal map: Fotosintesis");
	} else {
		goalMapId = randomString();
		yield* db.insert(goalMaps).values({
			id: goalMapId,
			teacherId,
			title: material.title,
			description: material.description,
			nodes: goalMapData.nodes,
			edges: goalMapData.edges,
			direction: "bi",
			type: "teacher",
			textId,
			topicId,
		});
		yield* Effect.log("  Created goal map: Fotosintesis");
	}

	// 4. Two kits over the SAME goal map — one per segmentation model -----------
	const recolor = (colors: Record<string, string>) =>
		goalMapData.nodes.map((node) => {
			const typed = node as { id: string; type: string; data: { label: string } };
			if (typed.type !== "text") return typed;
			return { ...typed, data: { ...typed.data, color: colors[typed.id] } };
		});

	const kitNodesBy: Record<"paragraf" | "depth", ReturnType<typeof recolor>> = {
		paragraf: recolor(PARAGRAF_NODE_COLORS),
		depth: recolor(DEPTH_NODE_COLORS),
	};

	const kitDefs = [
		{
			name: "Fotosintesis Kit — Segmen Paragraf",
			colors: PARAGRAF_NODE_COLORS,
			key: "paragraf" as const,
			assignmentTitle: "Fotosintesis — Kelompok A (Segmen Paragraf)",
			assignmentDescription:
				"Kit dipecah mengikuti struktur PARAGRAF materi: merah = paragraf 1 (pengertian & letak), kuning = paragraf 2 (syarat), biru = paragraf 3 (proses), hijau = paragraf 4 (hasil).",
		},
		{
			name: "Fotosintesis Kit — Segmen Depth Topik",
			colors: DEPTH_NODE_COLORS,
			key: "depth" as const,
			assignmentTitle: "Fotosintesis — Kelompok B (Segmen Depth Topik)",
			assignmentDescription:
				"Kit dipecah mengikuti KEDALAMAN HIERARKI topik (umum → spesifik): merah = konsep inti, kuning = konsep menengah, biru = konsep rincian, hijau = paling spesifik.",
		},
	];

	const assignmentIds: Record<"paragraf" | "depth", string> = {
		paragraf: "",
		depth: "",
	};
	const kitIds: Record<"paragraf" | "depth", string> = {
		paragraf: "",
		depth: "",
	};

	const startDate = new Date(Date.now() - 60 * 60 * 1000);
	const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const preTestFormId = yield* upsertForm({
		title: "Fotosintesis Pre-Test",
		description: "10 soal pilihan ganda tentang bacaan Fotosintesis (4 opsi) — Bloom L1–L2.",
		type: "pre_test",
		teacherId,
		readingMaterialContent: material.content,
	});
	const postTestFormId = yield* upsertForm({
		title: "Fotosintesis Post-Test",
		description:
			"10 soal pilihan ganda tentang bacaan Fotosintesis (4 opsi) — sama dengan pre-test.",
		type: "post_test",
		teacherId,
		readingMaterialContent: material.content,
	});

	for (const def of kitDefs) {
		const kitNodes = recolor(def.colors);

		const existingKit = yield* db.select().from(kits).where(eq(kits.name, def.name)).limit(1);
		let kitId: string;
		if (existingKit[0]) {
			kitId = existingKit[0].id;
			yield* db
				.update(kits)
				.set({
					kitId: existingKit[0].kitId,
					name: def.name,
					layout: "preset",
					enabled: true,
					goalMapId,
					teacherId,
					textId,
					nodes: JSON.stringify(kitNodes),
					edges: "[]",
				})
				.where(eq(kits.id, kitId));
		} else {
			kitId = randomString();
			yield* db.insert(kits).values({
				id: kitId,
				kitId: randomString(),
				name: def.name,
				layout: "preset",
				enabled: true,
				goalMapId,
				teacherId,
				textId,
				nodes: JSON.stringify(kitNodes),
				edges: "[]",
			});
		}
		yield* Effect.log(`  Kit ready: ${def.name}`);
		kitIds[def.key] = kitId;

		const existingAssignment = yield* db
			.select()
			.from(assignments)
			.where(eq(assignments.title, def.assignmentTitle))
			.limit(1);
		const assignmentValues = {
			goalMapId,
			kitId,
			title: def.assignmentTitle,
			description: def.assignmentDescription,
			readingMaterial: material.content,
			timeLimitMinutes: 30,
			startDate,
			dueAt,
			preTestFormId,
			postTestFormId,
			createdBy: teacherId,
		};
		let assignmentId: string;
		if (existingAssignment[0]) {
			assignmentId = existingAssignment[0].id;
			yield* db
				.update(assignments)
				.set(assignmentValues)
				.where(eq(assignments.id, assignmentId));
		} else {
			assignmentId = randomString();
			yield* db.insert(assignments).values({ id: assignmentId, ...assignmentValues });
		}
		assignmentIds[def.key] = assignmentId;
		yield* Effect.log(`  Assignment ready: ${def.assignmentTitle}`);

		// Target this assignment DIRECTLY to its demo student so each group
		// only sees its own segmentation variant:
		//   Kelompok A (paragraf) → Sari, Kelompok B (depth) → Rudi.
		yield* db.delete(assignmentTargets).where(eq(assignmentTargets.assignmentId, assignmentId));
		yield* db.insert(assignmentTargets).values({
			id: randomString(),
			assignmentId,
			cohortId: null,
			userId: def.key === "paragraf" ? sariId : rudiId,
		});
	}

	// 5. Demo submissions: learner maps + diagnoses + pre/post responses --------
	const edgeById: Record<string, { source: string; target: string }> = {};
	for (const edge of goalMapData.edges) edgeById[edge.id] = edge;
	const goalNodesTyped = goalMapData.nodes as unknown as Node[];
	const goalEdgesTyped = goalMapData.edges as unknown as Edge[];

	for (const config of LEARNER_MAP_CONFIGS) {
		const userId = config.studentEmail === "sari@kitbuild.mail" ? sariId : rudiId;
		const assignmentId = assignmentIds[config.assignmentKey];

		const existing = yield* db
			.select()
			.from(learnerMaps)
			.where(and(eq(learnerMaps.assignmentId, assignmentId), eq(learnerMaps.userId, userId)))
			.limit(1);
		if (existing[0]) {
			yield* Effect.log(`  Learner map for ${config.studentEmail} already exists`);
			continue;
		}

		const learnerEdges: Edge[] = [
			...config.correctEdgeIds.flatMap((edgeId, index) => {
				const edge = edgeById[edgeId];
				return edge
					? [{ id: `correct-${index + 1}`, source: edge.source, target: edge.target }]
					: [];
			}),
			...config.excessiveEdges.map((edge, index) => ({
				id: `excess-${index + 1}`,
				source: edge.source,
				target: edge.target,
			})),
		];

		const learnerMapId = randomString();
		yield* db.insert(learnerMaps).values({
			id: learnerMapId,
			assignmentId,
			goalMapId,
			kitId: kitIds[config.assignmentKey],
			userId,
			// Learner map nodes carry the group's kit colors so the result
			// canvas and analytics visualize the segmentation.
			nodes: JSON.stringify(kitNodesBy[config.assignmentKey]),
			edges: JSON.stringify(learnerEdges),
			status: "submitted",
			attempt: 1,
			submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
		});

		// Diagnosis via the same comparator the app uses. The learner edges
		// include the full text→connector→text chains, so triples compose the
		// same way they do for a real student submission.
		const result = compareMaps(goalNodesTyped, goalEdgesTyped, goalNodesTyped, learnerEdges);

		yield* db.insert(diagnoses).values({
			id: randomString(),
			goalMapId,
			learnerMapId,
			summary: `Score: ${Math.round(result.score * 100)}% (${result.correct.length}/${result.totalGoalPropositions} correct propositions)`,
			perLink: {
				correct: result.correct,
				missing: result.missing,
				excessive: result.excessive,
			},
			score: result.score,
			rubricVersion: "v1.0",
		});
		yield* Effect.log(
			`  Diagnosis ${config.studentEmail}: ${Math.round(result.score * 100)}% (${result.correct.length}/${result.totalGoalPropositions})`,
		);
	}

	// Pre/post form responses
	for (const config of LEARNER_MAP_CONFIGS) {
		const userId = config.studentEmail === "sari@kitbuild.mail" ? sariId : rudiId;
		const scores = RESPONSE_SCORES[config.studentEmail];
		if (!scores) continue;

		for (const [formId, pattern] of [
			[preTestFormId, scores.pre],
			[postTestFormId, scores.post],
		] as const) {
			const existingResponse = yield* db
				.select()
				.from(formResponses)
				.where(and(eq(formResponses.formId, formId), eq(formResponses.userId, userId)))
				.limit(1);
			if (existingResponse[0]) continue;

			const questionRows = yield* db
				.select()
				.from(questions)
				.where(eq(questions.formId, formId));
			const sorted = questionRows.sort((a, b) => a.orderIndex - b.orderIndex);

			const answers: Record<string, string> = {};
			for (const [index, score] of pattern.entries()) {
				const row = sorted[index];
				if (!row?.options) continue;
				// Options are stored pre-stringified (same convention as the
				// base seed), so parse the string value at runtime.
				const parsed = JSON.parse(row.options as unknown as string) as {
					options?: Array<{ id: string }>;
					correctOptionIds?: string[];
				};
				const options = parsed.options ?? [];
				const correctIds = parsed.correctOptionIds ?? [];
				if (options.length === 0) continue;
				answers[row.id] =
					score === 1
						? (correctIds[0] ?? options[0]?.id ?? "")
						: (options.find((o) => !correctIds.includes(o.id))?.id ??
							options[0]?.id ??
							"");
			}

			const submittedAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
			yield* db.insert(formResponses).values({
				id: randomString(),
				formId,
				userId,
				answers: JSON.stringify(answers),
				submittedAt,
				timeSpentSeconds: 480,
			});

			const existingProgress = yield* db
				.select()
				.from(formProgress)
				.where(and(eq(formProgress.formId, formId), eq(formProgress.userId, userId)))
				.limit(1);
			if (!existingProgress[0]) {
				yield* db.insert(formProgress).values({
					id: randomString(),
					formId,
					userId,
					status: "completed",
					completedAt: submittedAt,
				});
			}
		}
	}

	yield* Effect.log(
		"--- Seed demo Fotosintesis selesai ---\n" +
			"  Kelompok A (Segmen Paragraf): sari@kitbuild.mail / demo12345\n" +
			"  Kelompok B (Segmen Depth Topik): rudi@kitbuild.mail / demo12345\n" +
			"  Peneliti: alex@kitbuild.mail / alex12345\n" +
			"  Dua assignment 'Fotosintesis' kini tersedia di dashboard guru & siswa.",
	);
}).pipe(
	Effect.provide(
		Layer.mergeAll(
			Layer.provideMerge(Auth.Default, DatabaseLive),
			RateLimiter.Default,
			Logger.pretty,
		),
	),
);

void Effect.runPromise(program);
