/**
 * Dual-model test seed — one kit containing BOTH segmentation models.
 *
 * Creates a new topic "Uji Coba Dua Model Segmen" (material: Siklus Air):
 *   - Reading text (3 paragraphs) + goal map (9 concepts, 10 propositions)
 *   - ONE kit over that goal map
 *   - SIX segments on the goal map, both thesis models side by side:
 *       P1–P3  (type "paragraph")   — reading-paragraph structure
 *       D1–D3  (type "depth-topic") — hierarchy depth from the root
 *   - Pre-Test / Post-Test (5 MCQ about Siklus Air) + perception questionnaire
 *   - One assignment over the kit, targeted at the two Java cohorts
 *
 * Idempotent (safe to re-run). Run AFTER `db:seed`:
 *   npx tsx --env-file=.env scripts/seed/kit-test-dual.ts
 */
import { and, eq, inArray } from "drizzle-orm";
import { Effect, Layer, Logger } from "effect";

import { Auth } from "@/lib/auth";
import { RateLimiter } from "@/lib/rate-limiter";
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
import { cohortMembers, cohorts, user } from "@/server/db/schema/auth-schema";

const TEACHER_EMAIL = "alex@kitbuild.mail";
const TOPIC_TITLE = "Uji Coba Dua Model Segmen";
const MATERIAL_TITLE = "Siklus Air";

type SeedQuestion =
	| {
			type: "mcq";
			questionText: string;
			options: Array<{ id: string; text: string }>;
			correctOptionId: string;
	  }
	| { type: "likert"; questionText: string; scaleSize: number; labels: Record<string, string> }
	| { type: "text"; questionText: string; placeholder?: string };

const READING_TEXT = `## Siklus Air

Air di bumi tidak pernah berhenti bergerak. Perputaran air dari permukaan bumi ke atmosfer dan kembali lagi ke bumi disebut siklus air (siklus hidrologis). Matahari memanaskan air di laut, danau, dan sungai sehingga berubah menjadi uap air. Proses perubahan air menjadi uap air ini disebut evaporasi. Semakin tinggi suhu udara, semakin banyak uap air yang dihasilkan.

Uap air naik ke atmosfer dan mendingin, lalu berubah kembali menjadi titik-titik air melalui proses kondensasi. Titik-titik air yang berkumpul di atmosfer membentuk awan. Ketika titik air di awan semakin banyak dan berat, air turun ke bumi sebagai presipitasi, misalnya hujan.

Air hujan yang jatuh ke daratan sebagian meresap ke dalam tanah melalui infiltrasi dan menjadi air tanah. Sebagian lagi mengalir di permukaan tanah sebagai aliran permukaan (runoff) yang bermuara ke sungai, danau, dan laut — lalu siklus air dimulai kembali.`;

const DESCRIPTION =
	"Topik uji: satu goal map dengan DUA model segmentasi sekaligus (Paragraf P1–P3 dan Depth-Topic D1–D3) untuk mencoba perilaku kit per segmen.";

type ConceptNode = {
	id: string;
	type: "text";
	position: { x: number; y: number };
	data: { label: string; color?: string };
};

const NODES: ConceptNode[] = [
	{
		id: "siklus-air",
		type: "text",
		position: { x: 400, y: 40 },
		data: { label: "Siklus Air", color: "red" },
	},
	{
		id: "evaporasi",
		type: "text",
		position: { x: 150, y: 220 },
		data: { label: "Evaporasi", color: "red" },
	},
	{
		id: "kondensasi",
		type: "text",
		position: { x: 400, y: 220 },
		data: { label: "Kondensasi", color: "amber" },
	},
	{
		id: "presipitasi",
		type: "text",
		position: { x: 660, y: 220 },
		data: { label: "Presipitasi", color: "amber" },
	},
	{
		id: "uap-air",
		type: "text",
		position: { x: 60, y: 400 },
		data: { label: "Uap Air", color: "red" },
	},
	{
		id: "awan",
		type: "text",
		position: { x: 320, y: 400 },
		data: { label: "Awan", color: "amber" },
	},
	{
		id: "hujan",
		type: "text",
		position: { x: 580, y: 400 },
		data: { label: "Hujan", color: "amber" },
	},
	{
		id: "infiltrasi",
		type: "text",
		position: { x: 820, y: 400 },
		data: { label: "Infiltrasi", color: "green" },
	},
	{
		id: "aliran-permukaan",
		type: "text",
		position: { x: 960, y: 240 },
		data: { label: "Aliran Permukaan", color: "green" },
	},
];

const EDGES = [
	{ id: "e1", source: "siklus-air", target: "evaporasi" },
	{ id: "e2", source: "siklus-air", target: "kondensasi" },
	{ id: "e3", source: "siklus-air", target: "presipitasi" },
	{ id: "e4", source: "evaporasi", target: "uap-air" },
	{ id: "e5", source: "uap-air", target: "kondensasi" },
	{ id: "e6", source: "kondensasi", target: "awan" },
	{ id: "e7", source: "awan", target: "presipitasi" },
	{ id: "e8", source: "presipitasi", target: "hujan" },
	{ id: "e9", source: "hujan", target: "infiltrasi" },
	{ id: "e10", source: "hujan", target: "aliran-permukaan" },
];

// Both thesis models on the SAME goal map, clearly prefixed P/D.
const SEGMENTS: Array<{
	name: string;
	type: "paragraph" | "depth-topic";
	color: string;
	nodeIds: string[];
}> = [
	{
		name: "P1 — Pengertian & Penguapan",
		type: "paragraph",
		color: "#dc2626",
		nodeIds: ["siklus-air", "evaporasi", "uap-air"],
	},
	{
		name: "P2 — Kondensasi & Presipitasi",
		type: "paragraph",
		color: "#d97706",
		nodeIds: ["kondensasi", "awan", "presipitasi", "hujan"],
	},
	{
		name: "P3 — Air di Daratan",
		type: "paragraph",
		color: "#16a34a",
		nodeIds: ["infiltrasi", "aliran-permukaan"],
	},
	{
		name: "D1 — Level 0 (Konsep Inti)",
		type: "depth-topic",
		color: "#2563eb",
		nodeIds: ["siklus-air"],
	},
	{
		name: "D2 — Level 1 (Konsep Utama)",
		type: "depth-topic",
		color: "#0891b2",
		nodeIds: ["evaporasi", "kondensasi", "presipitasi"],
	},
	{
		name: "D3 — Level 2+ (Konsep Rincian)",
		type: "depth-topic",
		color: "#9333ea",
		nodeIds: ["uap-air", "awan", "hujan", "infiltrasi", "aliran-permukaan"],
	},
];

function mcq(
	questionIndex: number,
	questionText: string,
	texts_: [string, string, string, string],
	correctIndex: number,
): SeedQuestion {
	const options = texts_.map((text, idx) => ({ id: `q${questionIndex}_opt${idx}`, text }));
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

const SIKLUS_AIR_QUESTIONS: SeedQuestion[] = [
	mcq(
		0,
		"Proses perubahan air menjadi uap air karena panas matahari disebut ...",
		["Evaporasi", "Kondensasi", "Presipitasi", "Infiltrasi"],
		0,
	),
	mcq(
		1,
		"Perubahan uap air menjadi titik-titik air di atmosfer disebut ...",
		["Evaporasi", "Kondensasi", "Runoff", "Transpirasi"],
		1,
	),
	mcq(
		2,
		"Titik-titik air yang berkumpul di atmosfer akan membentuk ...",
		["Hujan", "Pelangi", "Awan", "Angin"],
		2,
	),
	mcq(
		3,
		"Air hujan yang meresap ke dalam tanah disebut ...",
		["Aliran permukaan", "Infiltrasi", "Evaporasi", "Presipitasi"],
		1,
	),
	mcq(
		4,
		"Aliran air di permukaan tanah yang bermuara ke sungai disebut ...",
		["Infiltrasi", "Kondensasi", "Uap air", "Aliran permukaan (runoff)"],
		3,
	),
];

const PERCEPTION_QUESTIONS: SeedQuestion[] = [
	likert("Aktivitas kit-build membantu saya memahami materi Siklus Air."),
	likert("Pembagian segmen membuat pekerjaan rebuild peta terasa lebih terarah."),
	likert("Saya bisa memprediksi konsep yang ada di segmen berikutnya."),
	likert("Warna segmen membantu saya mengelompokkan konsep."),
	likert("Mengerjakan per segmen mengurangi beban kognitif saya."),
	likert("Saya ingin belajar materi lain dengan metode kit-build."),
	likert("Secara keseluruhan, pengalaman kit-build ini menyenangkan."),
	{
		type: "text",
		questionText:
			"Apa yang paling membantu dan apa yang masih membingungkan saat rebuild peta per segmen?",
		placeholder: "Tulis pendapatmu di sini...",
	},
];

function upsertMcqForm(input: {
	title: string;
	description: string;
	type: "pre_test" | "post_test";
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

function upsertQuestionnaire(input: { teacherId: string; questions_: SeedQuestion[] }) {
	return Effect.gen(function* () {
		const db = yield* Database;
		const title = "Kuesioner Persepsi Siklus Air (Uji Dua Model)";
		const description =
			"Kuesioner persepsi terhadap aktivitas kit-build Siklus Air (7 pernyataan skala Likert 1–5 + 1 pertanyaan terbuka).";
		const existing = yield* db.select().from(forms).where(eq(forms.title, title)).limit(1);
		let formId: string;
		if (existing[0]) {
			formId = existing[0].id;
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
		return formId;
	});
}

const program = Effect.gen(function* () {
	const db = yield* Database;

	yield* Effect.log("--- Seed Uji Coba Dua Model (Siklus Air) ---");

	// 1. Teacher ---------------------------------------------------------------
	const existingTeacher = yield* db
		.select()
		.from(user)
		.where(eq(user.email, TEACHER_EMAIL))
		.limit(1);
	if (!existingTeacher[0]) {
		return yield* Effect.fail(
			new Error(`Teacher ${TEACHER_EMAIL} tidak ada — jalankan db:seed dulu`),
		);
	}
	const teacherId = existingTeacher[0].id;

	// 2. Topic -----------------------------------------------------------------
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
		yield* db
			.insert(topics)
			.values({ id: topicId, title: TOPIC_TITLE, description: DESCRIPTION });
		yield* Effect.log(`  Created topic: ${TOPIC_TITLE}`);
	}

	// 3. Reading text ------------------------------------------------------------
	const existingText = yield* db
		.select()
		.from(texts)
		.where(eq(texts.title, MATERIAL_TITLE))
		.limit(1);
	let textId: string;
	if (existingText[0]) {
		textId = existingText[0].id;
		yield* db.update(texts).set({ content: READING_TEXT }).where(eq(texts.id, textId));
	} else {
		textId = randomString();
		yield* db
			.insert(texts)
			.values({ id: textId, title: MATERIAL_TITLE, content: READING_TEXT });
	}

	// 4. Goal map ----------------------------------------------------------------
	const existingGoalMap = yield* db
		.select()
		.from(goalMaps)
		.where(eq(goalMaps.title, MATERIAL_TITLE))
		.limit(1);
	let goalMapId: string;
	const goalMapValues = {
		teacherId,
		title: MATERIAL_TITLE,
		description: DESCRIPTION,
		nodes: NODES,
		edges: EDGES,
		direction: "bi" as const,
		type: "teacher" as const,
		textId,
		topicId,
	};
	if (existingGoalMap[0]) {
		goalMapId = existingGoalMap[0].id;
		yield* db.update(goalMaps).set(goalMapValues).where(eq(goalMaps.id, goalMapId));
		yield* Effect.log("  Updated goal map: Siklus Air");
	} else {
		goalMapId = randomString();
		yield* db.insert(goalMaps).values({ id: goalMapId, ...goalMapValues });
		yield* Effect.log("  Created goal map: Siklus Air");
	}

	// 5. Segments — BOTH models on this goal map ---------------------------------
	for (const [index, seg] of SEGMENTS.entries()) {
		const existingSeg = yield* db
			.select()
			.from(mapSegments)
			.where(eq(mapSegments.name, seg.name))
			.limit(1);
		const values = {
			goalMapId,
			name: seg.name,
			type: seg.type,
			orderIndex: index,
			color: seg.color,
			nodeIds: seg.nodeIds,
		};
		if (existingSeg[0]) {
			yield* db.update(mapSegments).set(values).where(eq(mapSegments.id, existingSeg[0].id));
		} else {
			yield* db.insert(mapSegments).values({ id: randomString(), ...values });
		}
	}
	yield* Effect.log(`  Segments ready: ${SEGMENTS.length} (3 Paragraf + 3 Depth-Topic)`);

	// 6. Forms ---------------------------------------------------------------------
	const preTestFormId = yield* upsertMcqForm({
		title: "Siklus Air Pre-Test (Uji Dua Model)",
		description: "5 soal pilihan ganda tentang bacaan Siklus Air (4 opsi).",
		type: "pre_test",
		teacherId,
		questions_: SIKLUS_AIR_QUESTIONS,
	});
	const postTestFormId = yield* upsertMcqForm({
		title: "Siklus Air Post-Test (Uji Dua Model)",
		description: "5 soal pilihan ganda tentang bacaan Siklus Air — sama dengan pre-test.",
		type: "post_test",
		teacherId,
		questions_: SIKLUS_AIR_QUESTIONS,
	});
	const questionnaireFormId = yield* upsertQuestionnaire({
		teacherId,
		questions_: PERCEPTION_QUESTIONS,
	});
	yield* Effect.log("  Forms ready: Pre-Test, Post-Test, Kuesioner");

	// 7. Kit -----------------------------------------------------------------------
	const kitTitle = "Siklus Air Kit — Uji Dua Model";
	const existingKit = yield* db.select().from(kits).where(eq(kits.name, kitTitle)).limit(1);
	let kitId: string;
	if (existingKit[0]) {
		kitId = existingKit[0].id;
	} else {
		kitId = randomString();
		yield* db.insert(kits).values({
			id: kitId,
			kitId: randomString(),
			name: kitTitle,
			layout: "preset",
			enabled: true,
			goalMapId,
			teacherId,
			textId,
			nodes: NODES,
			edges: [],
		});
	}
	yield* Effect.log(`  Kit ready: ${kitTitle}`);

	// 8. Assignment ------------------------------------------------------------------
	const assignmentTitle = "Uji Coba Dua Model Segmen — Paragraf + Depth-Topic";
	const assignmentDescription =
		"KIT UJI: satu kit dengan enam segmen dari dua model sekaligus. P1–P3 mengikuti struktur PARAGRAF bacaan (merah = paragraf 1, kuning = paragraf 2, hijau = paragraf 3). D1–D3 mengikuti LEVEL KEDALAMAN topik dari akar hierarki (biru = konsep inti, cyan = konsep utama, ungu = konsep rincian). Coba kerjakan lewat pill segmen di editor dan bandingkan keduanya.";
	const startDate = new Date(Date.now() - 60 * 60 * 1000);
	const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

	const existingAssignment = yield* db
		.select()
		.from(assignments)
		.where(eq(assignments.title, assignmentTitle))
		.limit(1);
	const assignmentValues = {
		goalMapId,
		kitId,
		title: assignmentTitle,
		description: assignmentDescription,
		readingMaterial: READING_TEXT,
		timeLimitMinutes: 30,
		startDate,
		dueAt,
		preTestFormId,
		postTestFormId,
		questionnaireFormId,
		createdBy: teacherId,
	};
	let assignmentId: string;
	if (existingAssignment[0]) {
		assignmentId = existingAssignment[0].id;
		yield* db.update(assignments).set(assignmentValues).where(eq(assignments.id, assignmentId));
	} else {
		assignmentId = randomString();
		yield* db.insert(assignments).values({ id: assignmentId, ...assignmentValues });
	}

	// Demo students (tanaka/sari/rudi) may have been soft-deleted by earlier
	// E2E/admin runs, which would hide every assignment targeted at their
	// cohorts. Reactivate them and keep their demo-cohort membership active.
	const demoEmails = ["tanaka@kitbuild.mail", "sari@kitbuild.mail", "rudi@kitbuild.mail"];
	const demoCohortNames = ["2A Marketing Management", "2B Marketing Management"];
	yield* db
		.update(user)
		.set({ deletedAt: null })
		.where(and(inArray(user.email, demoEmails), eq(user.role, "student")));
	const demoCohortRows = yield* db
		.select()
		.from(cohorts)
		.where(inArray(cohorts.name, demoCohortNames));
	const demoStudents = yield* db.select().from(user).where(inArray(user.email, demoEmails));
	for (const s of demoStudents) {
		for (const c of demoCohortRows) {
			const membership = yield* db
				.select()
				.from(cohortMembers)
				.where(and(eq(cohortMembers.cohortId, c.id), eq(cohortMembers.userId, s.id)))
				.limit(1);
			if (membership[0]) {
				yield* db
					.update(cohortMembers)
					.set({ deletedAt: null })
					.where(eq(cohortMembers.id, membership[0].id));
			} else {
				yield* db.insert(cohortMembers).values({
					id: randomString(),
					cohortId: c.id,
					userId: s.id,
				});
			}
		}
	}

	// Target the two Java research cohorts so demo students see this assignment.
	// Fallback: in a fresh database (e.g. production) the cohorts may not
	// exist yet — target every student user instead so nobody is locked out.
	const cohortNames = [
		"Java 1 Belajar Java - Paragraph",
		"Java 2 Belajar Java - Depth-Topic",
		// demo cohorts (tanaka/sari/rudi) so the demo student account can try
		// the dual-model kit without a dedicated Java cohort account
		"2A Marketing Management",
		"2B Marketing Management",
	];
	const cohortRows = yield* db.select().from(cohorts).where(inArray(cohorts.name, cohortNames));
	let targets: Array<{ cohortId: string | null; userId: string | null }> = cohortRows.map(
		(c) => ({ cohortId: c.id, userId: null }),
	);
	if (targets.length === 0) {
		const students = yield* db.select().from(user).where(eq(user.role, "student"));
		targets = students.map((s) => ({ cohortId: null, userId: s.id }));
		yield* Effect.log(
			`  Cohorts not found — targeting ${students.length} student user(s) directly`,
		);
	}
	yield* db.delete(assignmentTargets).where(eq(assignmentTargets.assignmentId, assignmentId));
	for (const t of targets) {
		yield* db.insert(assignmentTargets).values({
			id: randomString(),
			assignmentId,
			cohortId: t.cohortId,
			userId: t.userId,
		});
	}
	yield* Effect.log(`  Assignment ready: ${assignmentTitle} (${targets.length} target)`);

	yield* Effect.log("--- Seed Uji Coba Dua Model selesai ---");
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
