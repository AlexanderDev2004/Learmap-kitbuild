/**
 * Java research seed — three-group experiment (Kelas A vs B vs control).
 *
 * Creates a complete "Pemrograman Java" research demo on top of the base seed:
 *   - Topic "Goal Maps for Pemrograman JAVA" + reading text (4 paragraphs)
 *     + goal map
 *   - Pre-test / post-test / delayed test (10 MCQ about Java) + perception
 *     questionnaire (7 Likert items + 1 open question)
 *   - ONE goal map, ONE kit, and BOTH segmentation models stored as segments:
 *       P1-P4 (type "paragraph")   — follows the reading structure
 *       D1-Dn (type "depth-topic") — computed from the goal-map hierarchy
 *   - THREE assignments over that single kit, differing only in segmentModel:
 *       Java 1 — "paragraph"   (Kelas A)
 *       Java 2 — "depth-topic" (Kelas B)
 *       Java 3 — "none"        (Kelas C, control: full map, no segment bar)
 *     Every group gets the same kit nodes and colors, so the only treatment
 *     difference is the segmentation shown to the learner.
 *   - Each assignment targets its own cohort:
 *       "Java 1 Belajar Java - Paragraph"
 *       "Java 2 Belajar Java - Depth-Topic"
 *       "Java 3 Belajar Java - Kontrol"
 *     (cohorts are reused when they already exist — safe to re-run).
 *
 * All three cohorts are experiment-condition users: Kelas C is a control for
 * SEGMENTATION, not for the kit-build activity itself.
 *
 * Run AFTER `db:seed` (idempotent):
 *   pnpm run db:seed:java
 */
import { eq, inArray } from "drizzle-orm";
import { Effect, Layer, Logger } from "effect";

import { computeDepthSegments } from "@/features/goal-map/lib/segmentation";
import { Auth } from "@/lib/auth";
import { RateLimiter } from "@/lib/rate-limiter";
import { type SegmentModel, type SegmentType } from "@/lib/segment-model";
import { randomString } from "@/lib/utils";
import { Database, DatabaseLive } from "@/server/db/client";
import {
	assignments,
	assignmentTargets,
	forms,
	goalMaps,
	kits,
	mapSegments,
	questions,
	texts,
	topics,
} from "@/server/db/schema/app-schema";
import { cohorts, user } from "@/server/db/schema/auth-schema";

import { GOAL_MAP_TO_MATERIAL } from "./data/materials.js";

const TEACHER_EMAIL = "alex@kitbuild.mail";
const MATERIAL_TITLE = "Pemrograman Java";
const TOPIC_TITLE = "Goal Maps for Pemrograman JAVA";

const COHORT_PARAGRAF = "Java 1 Belajar Java - Paragraph";
const COHORT_DEPTH = "Java 2 Belajar Java - Depth-Topic";
const COHORT_KONTROL = "Java 3 Belajar Java - Kontrol";

// ---------------------------------------------------------------------------
// Segmentation — the two thesis models over the SAME goal map.
// ---------------------------------------------------------------------------

type SegmentSeed = { name: string; type: SegmentType; color: string; nodeIds: string[] };

/** The three research arms; each maps to one cohort and one assignment. */
type GroupKey = Extract<SegmentModel, "paragraph" | "depth-topic" | "none">;

/** Kelas A: segments follow the READING PARAGRAPH structure. */
const PARAGRAPH_SEGMENTS: SegmentSeed[] = [
	{
		name: "P1 — Pengertian Java & JVM",
		type: "paragraph",
		color: "#dc2626",
		nodeIds: ["java", "jvm"],
	},
	{
		name: "P2 — Kompilasi & Eksekusi",
		type: "paragraph",
		color: "#d97706",
		nodeIds: ["source-code", "compiler", "bytecode"],
	},
	{
		name: "P3 — Struktur Program & OOP",
		type: "paragraph",
		color: "#0284c7",
		nodeIds: ["class", "main-method", "method", "objek"],
	},
	{
		name: "P4 — Variabel, Tipe Data & Library",
		type: "paragraph",
		color: "#16a34a",
		nodeIds: ["variabel", "tipe-data", "output", "library"],
	},
];

/** Kelas B: one color per hierarchy level, ordered general → specific. */
const DEPTH_LEVEL_COLORS = ["#2563eb", "#0891b2", "#9333ea", "#db2777", "#65a30d"] as const;

type SeedQuestion =
	| {
			type: "mcq";
			questionText: string;
			options: Array<{ id: string; text: string }>;
			correctOptionId: string;
	  }
	| { type: "likert"; questionText: string; scaleSize: number; labels: Record<string, string> }
	| { type: "text"; questionText: string; placeholder?: string };

function mcq(
	questionIndex: number,
	questionText: string,
	texts_: [string, string, string, string],
	correctIndex: number,
): SeedQuestion {
	const options = texts_.map((text, idx) => ({
		id: `q${questionIndex}_opt${idx}`,
		text,
	}));
	return {
		type: "mcq",
		questionText,
		options,
		correctOptionId: `q${questionIndex}_opt${correctIndex}`,
	};
}

function likert(questionText: string): SeedQuestion {
	return {
		type: "likert",
		questionText,
		scaleSize: 5,
		labels: {
			"1": "Sangat Tidak Setuju",
			"2": "Tidak Setuju",
			"3": "Netral",
			"4": "Setuju",
			"5": "Sangat Setuju",
		},
	};
}

const JAVA_TEST_QUESTIONS: SeedQuestion[] = [
	mcq(
		0,
		"Siapa yang mengembangkan bahasa pemrograman Java?",
		["James Gosling", "Dennis Ritchie", "Guido van Rossum", "Bjarne Stroustrup"],
		0,
	),
	mcq(
		1,
		"Java secara resmi dirilis pertama kali pada tahun ...",
		["1985", "1995", "2000", "2005"],
		1,
	),
	mcq(
		2,
		"Berkas source code bahasa Java memiliki ekstensi ...",
		[".class", ".jar", ".java", ".exe"],
		2,
	),
	mcq(
		3,
		"Perintah yang digunakan untuk mengompilasi source code Java adalah ...",
		["java", "javac", "javadoc", "jar"],
		1,
	),
	mcq(
		4,
		"Hasil kompilasi source code Java berupa ...",
		["Bytecode (.class)", "Machine code (.exe)", "Kode sumber (.java)", "Berkas arsip (.jar)"],
		0,
	),
	mcq(
		5,
		"Tugas Java Virtual Machine (JVM) adalah ...",
		[
			"Mengedit source code",
			"Membuat antarmuka grafis",
			"Mengeksekusi bytecode Java",
			"Mendesain basis data",
		],
		2,
	),
	mcq(
		6,
		"Setiap program Java minimal harus memiliki satu buah ...",
		["Variabel global", "Class", "Berkas header", "Paket impor"],
		1,
	),
	mcq(
		7,
		"Method yang menjadi titik awal (pintu masuk) eksekusi program Java adalah ...",
		["start()", "init()", "run()", "main()"],
		3,
	),
	mcq(
		8,
		"Tempat penyimpanan data di memori yang memiliki tipe data tertentu disebut ...",
		["Variabel", "Konstanta", "Array", "Method"],
		0,
	),
	mcq(
		9,
		"Perintah yang umum digunakan untuk mencetak output ke layar pada Java adalah ...",
		["echo", "cout <<", "System.out.println()", "document.write()"],
		2,
	),
];

const PERCEPTION_QUESTIONS: SeedQuestion[] = [
	likert("Pembagian segmen pada kit membuat saya lebih mudah memahami konsep pemrograman Java."),
	likert(
		"Aktivitas membangun peta konsep (kit-build) membantu saya memahami hubungan antar konsep Java.",
	),
	likert("Aktivitas kit-build ini menyenangkan dan menarik untuk diikuti."),
	likert(
		"Jumlah konsep pada setiap segmen kit sesuai dengan kemampuan saya, sehingga saya tidak merasa kewalahan.",
	),
	likert("Waktu yang diberikan cukup untuk menyelesaikan peta konsep."),
	likert(
		"Setelah melihat skor kesesuaian (Map Score), saya menjadi lebih percaya diri terhadap pemahaman saya.",
	),
	likert(
		"Saya merekomendasikan aktivitas kit-build ini untuk pembelajaran mata kuliah pemrograman.",
	),
	{
		type: "text",
		questionText:
			"Tuliskan saran atau komentar Anda tentang aktivitas pembelajaran kit-build ini.",
		placeholder: "Tulis saran/komentar Anda di sini...",
	},
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureUser(input: {
	email: string;
	password: string;
	name: string;
	role: "admin" | "teacher" | "student";
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
							studyGroup: "experiment",
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

		if (existing[0]?.role !== input.role) {
			yield* db.update(user).set({ role: input.role }).where(eq(user.id, userId));
		}
		return userId;
	});
}

// ---------------------------------------------------------------------------
// Forms helpers
// ---------------------------------------------------------------------------

function upsertMcqForm(input: {
	title: string;
	description: string;
	type: "pre_test" | "post_test" | "delayed_test";
	teacherId: string;
	questions_: SeedQuestion[];
}) {
	return Effect.gen(function* () {
		const db = yield* Database;

		const existing = yield* db
			.select()
			.from(forms)
			.where(eq(forms.title, input.title))
			.limit(1);

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
				createdBy: input.teacherId,
			});
		}

		const existingQuestions = yield* db
			.select()
			.from(questions)
			.where(eq(questions.formId, formId));

		for (const [index, q] of input.questions_.entries()) {
			if (q.type !== "mcq") continue;
			const values = {
				formId,
				type: "mcq" as const,
				questionText: q.questionText,
				// Questions.options is a mode:"json" column — pass the object and
				// let drizzle serialize it (single-encoded).
				options: {
					type: "mcq",
					options: q.options,
					correctOptionIds: [q.correctOptionId],
					shuffle: true,
				},
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
		if (existingQuestions.length > input.questions_.length) {
			const stale = existingQuestions.slice(input.questions_.length);
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

function upsertPerceptionForm(input: { teacherId: string; questions_: SeedQuestion[] }) {
	return Effect.gen(function* () {
		const db = yield* Database;
		const title = "Kuesioner Persepsi Pemrograman Java";
		const description =
			"Kuesioner persepsi mahasiswa terhadap aktivitas kit-build Pemrograman Java (7 pernyataan skala Likert 1â€“5 + 1 pertanyaan terbuka).";

		const existing = yield* db.select().from(forms).where(eq(forms.title, title)).limit(1);

		let formId: string;
		if (existing[0]) {
			formId = existing[0].id;
			yield* db
				.update(forms)
				.set({
					description,
					type: "questionnaire",
					audience: "all",
					status: "published",
					createdBy: input.teacherId,
				})
				.where(eq(forms.id, formId));
		} else {
			formId = randomString();
			yield* db.insert(forms).values({
				id: formId,
				title,
				description,
				type: "questionnaire",
				audience: "all",
				status: "published",
				createdBy: input.teacherId,
			});
		}

		const existingQuestions = yield* db
			.select()
			.from(questions)
			.where(eq(questions.formId, formId));

		for (const [index, q] of input.questions_.entries()) {
			const values = {
				formId,
				type: q.type,
				questionText: q.questionText,
				options:
					q.type === "likert"
						? { type: "likert", scaleSize: q.scaleSize, labels: q.labels }
						: q.type === "text"
							? { type: "text", placeholder: q.placeholder }
							: null,
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
		if (existingQuestions.length > input.questions_.length) {
			const stale = existingQuestions.slice(input.questions_.length);
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

	yield* Effect.log("--- Seed demo Pemrograman Java ---");

	// 1. Teacher --------------------------------------------------------------
	const teacherId = yield* ensureUser({
		email: TEACHER_EMAIL,
		password: "alex12345",
		name: "Alex",
		role: "teacher",
	});

	// 2. Cohorts (reuse when they already exist — the lecturer created them) ---
	const cohortIds: Record<GroupKey, string> = { paragraph: "", "depth-topic": "", none: "" };
	for (const [name, key] of [
		[COHORT_PARAGRAF, "paragraph"],
		[COHORT_DEPTH, "depth-topic"],
		[COHORT_KONTROL, "none"],
	] as const) {
		const existing = yield* db.select().from(cohorts).where(eq(cohorts.name, name)).limit(1);
		if (existing[0]) {
			cohortIds[key] = existing[0].id;
		} else {
			const cohortId = randomString();
			yield* db.insert(cohorts).values({ id: cohortId, name, description: `${name} cohort` });
			cohortIds[key] = cohortId;
			yield* Effect.log(`  Created cohort: ${name}`);
		}
	}

	// 3. Topic (reuse the topic the lecturer created) ---------------------------
	const existingTopic = yield* db
		.select()
		.from(topics)
		.where(eq(topics.title, TOPIC_TITLE))
		.limit(1);
	let topicId: string;
	if (existingTopic[0]) {
		topicId = existingTopic[0].id;
	} else {
		topicId = randomString();
		yield* db.insert(topics).values({
			id: topicId,
			title: TOPIC_TITLE,
			description: material.description,
		});
		yield* Effect.log(`  Created topic: ${TOPIC_TITLE}`);
	}

	// 4. Reading text + goal map ------------------------------------------------
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

	const goalMapData = {
		nodes: material.nodes,
		edges: material.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
	};
	const existingGoalMap = yield* db
		.select()
		.from(goalMaps)
		.where(eq(goalMaps.title, material.title))
		.limit(1);
	let goalMapId: string;
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
		yield* Effect.log("  Updated goal map: Pemrograman Java");
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
		yield* Effect.log("  Created goal map: Pemrograman Java");
	}

	// 5. Segments — both models on the same goal map -----------------------------
	// Depth levels come from the same algorithm the product uses for
	// "auto-segment by depth", so the seeded treatment matches the feature.
	const depthSegments: SegmentSeed[] = computeDepthSegments(material.nodes, material.edges).map(
		(nodeIds, index) => ({
			name: `D${index + 1} — Level ${index}${index === 0 ? " (Konsep Inti)" : ""}`,
			type: "depth-topic",
			color: DEPTH_LEVEL_COLORS[index % DEPTH_LEVEL_COLORS.length],
			nodeIds,
		}),
	);

	const existingSegments = yield* db
		.select()
		.from(mapSegments)
		.where(eq(mapSegments.goalMapId, goalMapId));
	for (const [index, seg] of [...PARAGRAPH_SEGMENTS, ...depthSegments].entries()) {
		const match = existingSegments.find((row) => row.name === seg.name);
		const values = {
			goalMapId,
			name: seg.name,
			type: seg.type,
			orderIndex: index,
			color: seg.color,
			nodeIds: seg.nodeIds,
			deletedAt: null,
		};
		if (match) {
			yield* db.update(mapSegments).set(values).where(eq(mapSegments.id, match.id));
		} else {
			yield* db.insert(mapSegments).values({ id: randomString(), ...values });
		}
	}
	yield* Effect.log(
		`  Segments ready: ${PARAGRAPH_SEGMENTS.length} Paragraf + ${depthSegments.length} Depth-Topic`,
	);

	// 6. Forms: pre-test, post-test, delayed test, perception questionnaire -----
	const preTestFormId = yield* upsertMcqForm({
		title: "Pemrograman Java Pre-Test",
		description:
			"10 soal pilihan ganda tentang bacaan Pemrograman Java (4 opsi) — Bloom L1–L2.",
		type: "pre_test",
		teacherId,
		questions_: JAVA_TEST_QUESTIONS,
	});
	const postTestFormId = yield* upsertMcqForm({
		title: "Pemrograman Java Post-Test",
		description:
			"10 soal pilihan ganda tentang bacaan Pemrograman Java (4 opsi) — sama dengan pre-test.",
		type: "post_test",
		teacherId,
		questions_: JAVA_TEST_QUESTIONS,
	});
	const delayedTestFormId = yield* upsertMcqForm({
		title: "Pemrograman Java Delayed Test",
		description:
			"10 soal pilihan ganda tentang bacaan Pemrograman Java — dikerjakan setelah jeda untuk mengukur retensi.",
		type: "delayed_test",
		teacherId,
		questions_: JAVA_TEST_QUESTIONS,
	});
	const questionnaireFormId = yield* upsertPerceptionForm({
		teacherId,
		questions_: PERCEPTION_QUESTIONS,
	});
	yield* Effect.log("  Forms ready: Pre-Test, Post-Test, Delayed Test, Kuesioner Persepsi");

	// 7. ONE kit for all three groups -------------------------------------------
	// Same nodes and colors for every arm: the only difference between groups
	// is the segmentation their assignment exposes.
	const kitName = "Pemrograman Java Kit — A/B/C";
	const kitNodes = goalMapData.nodes.filter(
		(node) => node.type === "text" || node.type === "connector",
	);
	const existingKit = yield* db.select().from(kits).where(eq(kits.name, kitName)).limit(1);
	let kitId: string;
	if (existingKit[0]) {
		kitId = existingKit[0].id;
		yield* db
			.update(kits)
			.set({
				layout: "preset",
				enabled: true,
				goalMapId,
				teacherId,
				textId,
				nodes: kitNodes,
				edges: [],
			})
			.where(eq(kits.id, kitId));
	} else {
		kitId = randomString();
		yield* db.insert(kits).values({
			id: kitId,
			kitId: randomString(),
			name: kitName,
			layout: "preset",
			enabled: true,
			goalMapId,
			teacherId,
			textId,
			nodes: kitNodes,
			edges: [],
		});
	}
	yield* Effect.log(`  Kit ready: ${kitName} (shared by Kelas A, B, C)`);

	// 8. Three assignments over that kit — one per research arm ------------------
	const startDate = new Date(Date.now() - 60 * 60 * 1000);
	const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const assignmentDefs: Array<{
		key: GroupKey;
		title: string;
		description: string;
	}> = [
		{
			key: "paragraph",
			title: "Pemrograman Java — Java 1 (Segmen Paragraf)",
			description:
				"KELAS A. Kit sama dengan kelompok lain; segmen mengikuti struktur PARAGRAF bacaan: merah = paragraf 1 (pengertian Java & JVM), kuning = paragraf 2 (kompilasi & eksekusi), biru = paragraf 3 (struktur program & OOP), hijau = paragraf 4 (variabel, tipe data, output, library).",
		},
		{
			key: "depth-topic",
			title: "Pemrograman Java — Java 2 (Segmen Depth-Topic)",
			description:
				"KELAS B. Kit sama dengan kelompok lain; segmen mengikuti KEDALAMAN HIERARKI topik dari konsep inti ke konsep paling rinci.",
		},
		{
			key: "none",
			title: "Pemrograman Java — Java 3 (Kontrol, Tanpa Segmen)",
			description:
				"KELAS C (kontrol segmentasi). Kit dan aktivitas sama, tetapi peta ditampilkan utuh tanpa bilah segmen — pembanding untuk melihat apakah segmentasi itu sendiri membantu.",
		},
	];

	for (const def of assignmentDefs) {
		const existingAssignment = yield* db
			.select()
			.from(assignments)
			.where(eq(assignments.title, def.title))
			.limit(1);
		const assignmentValues = {
			goalMapId,
			kitId,
			title: def.title,
			description: def.description,
			readingMaterial: material.content,
			timeLimitMinutes: 30,
			startDate,
			dueAt,
			preTestFormId,
			postTestFormId,
			delayedPostTestFormId: delayedTestFormId,
			questionnaireFormId,
			segmentModel: def.key,
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

		// Target this assignment to its cohort so each class sees only its own
		// segmentation variant.
		yield* db.delete(assignmentTargets).where(eq(assignmentTargets.assignmentId, assignmentId));
		yield* db.insert(assignmentTargets).values({
			id: randomString(),
			assignmentId,
			cohortId: cohortIds[def.key],
			userId: null,
		});
		yield* Effect.log(`  Assignment ready: ${def.title} (segmentModel=${def.key})`);
	}

	yield* Effect.log("--- Seed Pemrograman Java selesai ---");
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
