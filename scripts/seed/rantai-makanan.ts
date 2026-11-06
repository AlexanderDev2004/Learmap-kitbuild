/**
 * Dual-model test seed #2 - one kit containing BOTH segmentation models on a
 * new, more complex topic: "Rantai Makanan" (food chain).
 *
 * Creates:
 *   - Reading text (4 paragraphs) + goal map (13 concepts, 14 propositions)
 *   - ONE kit over that goal map
 *   - EIGHT segments on the goal map, both thesis models side by side, each
 *     with a pre-modeled frame (frame_bounds) computed from node positions:
 *       P1-P4  (type "paragraph")   - reading-paragraph structure
 *       D1-D4  (type "depth-topic") - BFS depth levels from the root,
 *             mirroring the app's auto Depth-Topic segmentation
 *   - Forms: Pre-Test / Post-Test / Delayed Test (5 MCQ each) +
 *     perception questionnaire (7 Likert + 1 open) + TAM questionnaire (6 Likert)
 *   - One assignment over the kit wiring all five forms, targeted at the Java
 *     research cohorts (fallback: every student)
 *
 * Idempotent (safe to re-run). Run AFTER `db:seed`:
 *   npx tsx --env-file=.env scripts/seed/rantai-makanan.ts
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
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
const TOPIC_TITLE = "Rantai Makanan - Uji Dua Model Segmen";
const MATERIAL_TITLE = "Rantai Makanan";

type SeedQuestion =
	| {
			type: "mcq";
			questionText: string;
			options: Array<{ id: string; text: string }>;
			correctOptionId: string;
	  }
	| { type: "likert"; questionText: string; scaleSize: number; labels: Record<string, string> }
	| { type: "text"; questionText: string; placeholder?: string };

const READING_TEXT = `## Rantai Makanan

Semua makhluk hidup membutuhkan energi untuk bertahan hidup, dan sumber energi utama di bumi adalah matahari. Energi tersebut masuk ke dalam rantai makanan melalui produsen, yaitu organisme yang mampu menyusun makanannya sendiri. Contoh produsen adalah tumbuhan hijau. Tumbuhan membuat makanan berupa zat organik melalui proses fotosintesis, yaitu pengolahan air dan karbon dioksida menjadi glukosa dan oksigen dengan bantuan cahaya matahari dan klorofil.

Organisme yang tidak dapat menyusun makanannya sendiri disebut konsumen. Konsumen tingkat I atau herbivora adalah pemakan tumbuhan, misalnya sapi, kambing, kelinci, dan belalang. Konsumen tingkat I kemudian menjadi sumber energi bagi konsumen tingkat II atau karnivora, yaitu pemakan herbivora seperti katak, ular, dan elang. Urutan makan dan dimakan ini membentuk sebuah rantai makanan, misalnya rumput dimakan belalang, belalang dimakan katak, dan katak dimakan ular.

Di ujung rantai makanan terdapat konsumen tingkat III yang sering disebut predator puncak, misalnya harimau dan elang besar, karena tidak ada hewan lain yang memangsanya. Selain ketiga tingkat konsumen tersebut, ada juga omnivora, yaitu hewan pemakan tumbuhan dan hewan lain secara bersamaan, contohnya ayam, beruang, dan tikus.

Ketika produsen dan konsumen mati, jasadnya tidak menumpuk di bumi karena diuraikan oleh pengurai atau dekomposer, yaitu bakteri dan jamur. Pengurai mengembalikan unsur hara ke dalam tanah sehingga dapat digunakan kembali oleh tumbuhan. Jika beberapa rantai makanan saling berhubungan satu sama lain, terbentuklah jaring makanan. Perpindahan energi dari produsen menuju konsumen inilah yang disebut aliran energi.`;

const DESCRIPTION =
	"Topik uji 2: goal map rantai makanan yang lebih kompleks dengan DUA model segmentasi sekaligus (Paragraf P1-P4 dan Depth-Topic D1-D4) lengkap dengan frame yang sudah dimodelkan teacher.";

type ConceptNode = {
	id: string;
	type: "text";
	position: { x: number; y: number };
	data: { label: string; color?: string };
};

const NODES: ConceptNode[] = [
	{
		id: "rantai-makanan",
		type: "text",
		position: { x: 850, y: 40 },
		data: { label: "Rantai Makanan", color: "red" },
	},
	{
		id: "produsen",
		type: "text",
		position: { x: 200, y: 240 },
		data: { label: "Produsen", color: "amber" },
	},
	{
		id: "konsumen",
		type: "text",
		position: { x: 700, y: 240 },
		data: { label: "Konsumen", color: "amber" },
	},
	{
		id: "pengurai",
		type: "text",
		position: { x: 1140, y: 240 },
		data: { label: "Pengurai", color: "amber" },
	},
	{
		id: "aliran-energi",
		type: "text",
		position: { x: 1520, y: 240 },
		data: { label: "Aliran Energi", color: "amber" },
	},
	{
		id: "tumbuhan",
		type: "text",
		position: { x: 60, y: 440 },
		data: { label: "Tumbuhan", color: "green" },
	},
	{
		id: "konsumen-1",
		type: "text",
		position: { x: 380, y: 440 },
		data: { label: "Konsumen I (Herbivora)", color: "green" },
	},
	{
		id: "konsumen-2",
		type: "text",
		position: { x: 620, y: 440 },
		data: { label: "Konsumen II (Karnivora)", color: "green" },
	},
	{
		id: "konsumen-3",
		type: "text",
		position: { x: 860, y: 440 },
		data: { label: "Konsumen III (Predator Puncak)", color: "green" },
	},
	{
		id: "omnivora",
		type: "text",
		position: { x: 1100, y: 440 },
		data: { label: "Omnivora", color: "green" },
	},
	{
		id: "bakteri-jamur",
		type: "text",
		position: { x: 1340, y: 440 },
		data: { label: "Bakteri & Jamur", color: "green" },
	},
	{
		id: "jaring-makanan",
		type: "text",
		position: { x: 1580, y: 440 },
		data: { label: "Jaring Makanan", color: "green" },
	},
	{
		id: "fotosintesis",
		type: "text",
		position: { x: 60, y: 640 },
		data: { label: "Fotosintesis", color: "purple" },
	},
];

// Propositions follow the KitBuild model concept -> connector(linking word) ->
// concept: every proposition is two edges through a connector node, the same
// shape the Siklus Air goal map uses and the comparator scores by.
const CONNECTORS: Array<{
	id: string;
	type: "connector";
	position: { x: number; y: number };
	data: { label: string };
}> = [
	{ id: "link-1", type: "connector", position: { x: 525, y: 230 }, data: { label: "meliputi" } },
	{ id: "link-2", type: "connector", position: { x: 775, y: 270 }, data: { label: "meliputi" } },
	{ id: "link-3", type: "connector", position: { x: 995, y: 230 }, data: { label: "meliputi" } },
	{ id: "link-4", type: "connector", position: { x: 1185, y: 270 }, data: { label: "meliputi" } },
	{ id: "link-5", type: "connector", position: { x: 130, y: 430 }, data: { label: "yaitu" } },
	{
		id: "link-6",
		type: "connector",
		position: { x: 60, y: 670 },
		data: { label: "menghasilkan" },
	},
	{ id: "link-7", type: "connector", position: { x: 540, y: 430 }, data: { label: "yaitu" } },
	{ id: "link-8", type: "connector", position: { x: 660, y: 470 }, data: { label: "yaitu" } },
	{ id: "link-9", type: "connector", position: { x: 780, y: 430 }, data: { label: "yaitu" } },
	{
		id: "link-10",
		type: "connector",
		position: { x: 900, y: 470 },
		data: { label: "meliputi juga" },
	},
	{
		id: "link-11",
		type: "connector",
		position: { x: 500, y: 530 },
		data: { label: "dimangsa oleh" },
	},
	{
		id: "link-12",
		type: "connector",
		position: { x: 740, y: 530 },
		data: { label: "dimangsa oleh" },
	},
	{
		id: "link-13",
		type: "connector",
		position: { x: 1240, y: 430 },
		data: { label: "contohnya" },
	},
	{
		id: "link-14",
		type: "connector",
		position: { x: 1550, y: 430 },
		data: { label: "berlangsung dalam" },
	},
];

const EDGES = [
	{ id: "link-1-in", source: "rantai-makanan", target: "link-1" },
	{ id: "link-1-out", source: "link-1", target: "produsen" },
	{ id: "link-2-in", source: "rantai-makanan", target: "link-2" },
	{ id: "link-2-out", source: "link-2", target: "konsumen" },
	{ id: "link-3-in", source: "rantai-makanan", target: "link-3" },
	{ id: "link-3-out", source: "link-3", target: "pengurai" },
	{ id: "link-4-in", source: "rantai-makanan", target: "link-4" },
	{ id: "link-4-out", source: "link-4", target: "aliran-energi" },
	{ id: "link-5-in", source: "produsen", target: "link-5" },
	{ id: "link-5-out", source: "link-5", target: "tumbuhan" },
	{ id: "link-6-in", source: "tumbuhan", target: "link-6" },
	{ id: "link-6-out", source: "link-6", target: "fotosintesis" },
	{ id: "link-7-in", source: "konsumen", target: "link-7" },
	{ id: "link-7-out", source: "link-7", target: "konsumen-1" },
	{ id: "link-8-in", source: "konsumen", target: "link-8" },
	{ id: "link-8-out", source: "link-8", target: "konsumen-2" },
	{ id: "link-9-in", source: "konsumen", target: "link-9" },
	{ id: "link-9-out", source: "link-9", target: "konsumen-3" },
	{ id: "link-10-in", source: "konsumen", target: "link-10" },
	{ id: "link-10-out", source: "link-10", target: "omnivora" },
	{ id: "link-11-in", source: "konsumen-1", target: "link-11" },
	{ id: "link-11-out", source: "link-11", target: "konsumen-2" },
	{ id: "link-12-in", source: "konsumen-2", target: "link-12" },
	{ id: "link-12-out", source: "link-12", target: "konsumen-3" },
	{ id: "link-13-in", source: "pengurai", target: "link-13" },
	{ id: "link-13-out", source: "link-13", target: "bakteri-jamur" },
	{ id: "link-14-in", source: "aliran-energi", target: "link-14" },
	{ id: "link-14-out", source: "link-14", target: "jaring-makanan" },
];

// Both thesis models on the SAME goal map. D1-D4 mirror the app's auto
// Depth-Topic segmentation (BFS shortest distance from the root).
const SEGMENTS: Array<{
	name: string;
	type: "paragraph" | "depth-topic";
	color: string;
	nodeIds: string[];
}> = [
	{
		name: "P1 - Pengertian & Produsen",
		type: "paragraph",
		color: "#dc2626",
		nodeIds: ["rantai-makanan", "produsen", "tumbuhan", "fotosintesis"],
	},
	{
		name: "P2 - Konsumen Tingkat I & II",
		type: "paragraph",
		color: "#d97706",
		nodeIds: ["konsumen", "konsumen-1", "konsumen-2"],
	},
	{
		name: "P3 - Predator Puncak & Omnivora",
		type: "paragraph",
		color: "#16a34a",
		nodeIds: ["konsumen-3", "omnivora"],
	},
	{
		name: "P4 - Pengurai & Aliran Energi",
		type: "paragraph",
		color: "#0d9488",
		nodeIds: ["pengurai", "bakteri-jamur", "aliran-energi", "jaring-makanan"],
	},
	{
		name: "D1 - Level 0 (Konsep Inti)",
		type: "depth-topic",
		color: "#2563eb",
		nodeIds: ["rantai-makanan"],
	},
	{
		name: "D2 - Level 1 (Komponen Utama)",
		type: "depth-topic",
		color: "#0891b2",
		nodeIds: ["produsen", "konsumen", "pengurai", "aliran-energi"],
	},
	{
		name: "D3 - Level 2 (Konsep Rincian)",
		type: "depth-topic",
		color: "#9333ea",
		nodeIds: [
			"tumbuhan",
			"konsumen-1",
			"konsumen-2",
			"konsumen-3",
			"omnivora",
			"bakteri-jamur",
			"jaring-makanan",
		],
	},
	{
		name: "D4 - Level 3 (Paling Spesifik)",
		type: "depth-topic",
		color: "#db2777",
		nodeIds: ["fotosintesis"],
	},
];

// Pre-modeled frame box for every segment, computed from node positions so the
// goal-map editor shows frames matching the segmentation the moment the seed
// lands. Teachers can still drag/resize (box modeling) afterwards; saved
// bounds win over these values.
const NODE_W = 210;
const NODE_H = 110;
const PAD = 28;
function frameBoundsFor(nodeIds: string[]): { x: number; y: number; w: number; h: number } {
	const xs = nodeIds.map((id) => NODES.find((n) => n.id === id)?.position.x ?? 0);
	const ys = nodeIds.map((id) => NODES.find((n) => n.id === id)?.position.y ?? 0);
	const x = Math.min(...xs) - PAD;
	const y = Math.min(...ys) - PAD - 20; // room for the frame label strip
	return {
		x,
		y,
		w: Math.max(...xs) + NODE_W + PAD - x,
		h: Math.max(...ys) + NODE_H + PAD + 20 - y,
	};
}

function mcq(
	questionIndex: number,
	questionText: string,
	texts_: [string, string, string, string],
	correctIndex: number,
): SeedQuestion {
	const options = texts_.map((text, idx) => ({ id: `rm${questionIndex}_opt${idx}`, text }));
	return {
		type: "mcq",
		questionText,
		options,
		correctOptionId: `rm${questionIndex}_opt${correctIndex}`,
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

const RANTAI_MAKANAN_QUESTIONS: SeedQuestion[] = [
	mcq(
		0,
		"Makhluk hidup yang mampu menyusun makanannya sendiri disebut ...",
		["Produsen", "Konsumen", "Pengurai", "Omnivora"],
		0,
	),
	mcq(
		1,
		"Proses pembuatan makanan pada tumbuhan hijau dengan bantuan cahaya matahari disebut ...",
		["Respirasi", "Fermentasi", "Fotosintesis", "Transpirasi"],
		2,
	),
	mcq(
		2,
		"Sapi dan kambing yang memakan tumbuhan tergolong sebagai ...",
		[
			"Produsen",
			"Herbivora (konsumen tingkat I)",
			"Karnivora (konsumen tingkat II)",
			"Pengurai",
		],
		1,
	),
	mcq(
		3,
		"Harimau yang tidak lagi dimakan oleh hewan lain disebut ...",
		[
			"Konsumen tingkat I",
			"Konsumen tingkat II",
			"Konsumen tingkat III (predator puncak)",
			"Produsen",
		],
		2,
	),
	mcq(
		4,
		"Bakteri dan jamur yang menguraikan jasad makhluk hidup yang mati disebut ...",
		["Konsumen", "Produsen", "Omnivora", "Pengurai (dekomposer)"],
		3,
	),
];

const PERCEPTION_QUESTIONS: SeedQuestion[] = [
	likert("Aktivitas kit-build membantu saya memahami materi Rantai Makanan."),
	likert("Pembagian segmen membuat pekerjaan rebuild peta terasa lebih terarah."),
	likert("Saya bisa memprediksi konsep yang ada di segmen berikutnya."),
	likert("Warna segmen membantu saya mengelompokkan konsep."),
	likert("Mengerjakan per segmen mengurangi beban kognitif saya."),
	likert("Saya ingin belajar materi lain dengan metode kit-build."),
	likert("Secara keseluruhan, pengalaman kit-build ini menyenangkan."),
	{
		type: "text",
		questionText:
			"Menurutmu, apakah membagi peta per segmen (Paragraf atau Depth-Topic) membantu belajar Rantai Makanan? Jelaskan.",
		placeholder: "Tulis pendapatmu di sini...",
	},
];

const TAM_QUESTIONS: SeedQuestion[] = [
	likert("Menggunakan Kit-Build meningkatkan pemahaman bacaan saya."),
	likert("Kit-Build membantu saya memahami struktur dan hubungan antar konsep dalam bacaan."),
	likert("Kit-Build memudahkan saya mengorganisir informasi dari bacaan."),
	likert("Belajar dengan Kit-Build lebih baik daripada metode konvensional."),
	likert("Saya merasa Kit-Build berguna untuk pembelajaran saya."),
	likert("Saya merasa Kit-Build mudah digunakan."),
];

function upsertForm(input: {
	title: string;
	description: string;
	type: "pre_test" | "post_test" | "delayed_test" | "questionnaire" | "tam";
	teacherId: string;
	questions_: SeedQuestion[];
}) {
	return Effect.gen(function* () {
		const db = yield* Database;
		const existing = yield* db
			.select()
			.from(forms)
			.where(and(eq(forms.title, input.title), isNull(forms.deletedAt)))
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
			const values = {
				formId,
				type: q.type,
				questionText: q.questionText,
				options:
					q.type === "mcq"
						? {
								type: "mcq",
								options: q.options,
								correctOptionIds: [q.correctOptionId],
								shuffle: true,
							}
						: q.type === "likert"
							? { type: "likert", scaleSize: q.scaleSize, labels: q.labels }
							: { type: "text", placeholder: q.placeholder },
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

const program = Effect.gen(function* () {
	const db = yield* Database;

	yield* Effect.log("--- Seed Uji Dua Model #2 (Rantai Makanan) ---");
	// 1. Teacher ---------------------------------------------------------------
	const existingTeacher = yield* db
		.select()
		.from(user)
		.where(eq(user.email, TEACHER_EMAIL))
		.limit(1);
	if (!existingTeacher[0]) {
		return yield* Effect.fail(
			new Error(`Teacher ${TEACHER_EMAIL} tidak ada - jalankan db:seed dulu`),
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
		nodes: [...NODES, ...CONNECTORS],
		edges: EDGES,
		direction: "bi" as const,
		type: "teacher" as const,
		textId,
		topicId,
	};
	if (existingGoalMap[0]) {
		goalMapId = existingGoalMap[0].id;
		yield* db.update(goalMaps).set(goalMapValues).where(eq(goalMaps.id, goalMapId));
		yield* Effect.log("  Updated goal map: Rantai Makanan");
	} else {
		goalMapId = randomString();
		yield* db.insert(goalMaps).values({ id: goalMapId, ...goalMapValues });
		yield* Effect.log("  Created goal map: Rantai Makanan");
	}

	// 5. Segments - BOTH models with pre-modeled frames ---------------------------
	for (const [index, seg] of SEGMENTS.entries()) {
		const existingSeg = yield* db
			.select()
			.from(mapSegments)
			.where(and(eq(mapSegments.goalMapId, goalMapId), eq(mapSegments.name, seg.name)))
			.limit(1);
		const values = {
			goalMapId,
			name: seg.name,
			type: seg.type,
			orderIndex: index,
			color: seg.color,
			nodeIds: seg.nodeIds,
			frameBounds: frameBoundsFor(seg.nodeIds),
			deletedAt: null,
		};
		if (existingSeg[0]) {
			yield* db.update(mapSegments).set(values).where(eq(mapSegments.id, existingSeg[0].id));
		} else {
			yield* db.insert(mapSegments).values({ id: randomString(), ...values });
		}
	}
	yield* Effect.log(
		`  Segments ready: ${SEGMENTS.length} (4 Paragraf + 4 Depth-Topic, semua dengan frame)`,
	);

	// 6. Forms ---------------------------------------------------------------------
	const preTestFormId = yield* upsertForm({
		title: "Rantai Makanan Pre-Test (Uji Dua Model)",
		description: "5 soal pilihan ganda tentang bacaan Rantai Makanan (4 opsi).",
		type: "pre_test",
		teacherId,
		questions_: RANTAI_MAKANAN_QUESTIONS,
	});
	const postTestFormId = yield* upsertForm({
		title: "Rantai Makanan Post-Test (Uji Dua Model)",
		description: "5 soal pilihan ganda tentang bacaan Rantai Makanan - sama dengan pre-test.",
		type: "post_test",
		teacherId,
		questions_: RANTAI_MAKANAN_QUESTIONS,
	});
	const delayedTestFormId = yield* upsertForm({
		title: "Rantai Makanan Delayed Test (Uji Dua Model)",
		description:
			"5 soal pilihan ganda tentang bacaan Rantai Makanan - dikerjakan kembali setelah jeda (retensi).",
		type: "delayed_test",
		teacherId,
		questions_: RANTAI_MAKANAN_QUESTIONS,
	});
	const questionnaireFormId = yield* upsertForm({
		title: "Kuesioner Persepsi Rantai Makanan (Uji Dua Model)",
		description:
			"Kuesioner persepsi terhadap aktivitas kit-build Rantai Makanan (7 pernyataan skala Likert 1-5 + 1 pertanyaan terbuka).",
		type: "questionnaire",
		teacherId,
		questions_: PERCEPTION_QUESTIONS,
	});
	const tamFormId = yield* upsertForm({
		title: "TAM Rantai Makanan (Uji Dua Model)",
		description:
			"Kuesioner Technology Acceptance Model (6 pernyataan skala Likert 1-5) tentang penggunaan Kit-Build.",
		type: "tam",
		teacherId,
		questions_: TAM_QUESTIONS,
	});
	yield* Effect.log("  Forms ready: Pre-Test, Post-Test, Delayed Test, Kuesioner Persepsi, TAM");

	// 7. Kit -----------------------------------------------------------------------
	// The kit ships the same concepts plus the connector linking words so
	// students rebuild propositions concept -> connector -> concept.
	const kitTitle = "Rantai Makanan Kit - Uji Dua Model";
	const kitNodes = [...NODES, ...CONNECTORS];
	const existingKit = yield* db.select().from(kits).where(eq(kits.name, kitTitle)).limit(1);
	let kitId: string;
	if (existingKit[0]) {
		kitId = existingKit[0].id;
		yield* db.update(kits).set({ nodes: kitNodes }).where(eq(kits.id, kitId));
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
			nodes: kitNodes,
			edges: [],
		});
	}
	yield* Effect.log(`  Kit ready: ${kitTitle}`);

	// 8. Assignment ------------------------------------------------------------------
	const assignmentTitle = "Uji Coba Dua Model Segmen - Rantai Makanan";
	const assignmentDescription =
		"KIT UJI 2: satu kit rantai makanan (13 konsep) dengan delapan segmen dari dua model sekaligus. P1-P4 mengikuti struktur PARAGRAF bacaan (merah = paragraf 1, kuning = paragraf 2, hijau = paragraf 3, teal = paragraf 4). D1-D4 mengikuti LEVEL KEDALAMAN topik dari akar hierarki (biru = konsep inti, cyan = komponen utama, ungu = konsep rincian, pink = paling spesifik). Kerjakan Pre-Test, rebuild peta per segmen lewat pill segmen, lalu Post-Test, Kuesioner, dan TAM. Delayed Test dikerjakan lagi setelah jeda untuk mengukur retensi.";
	const startDate = new Date(Date.now() - 60 * 60 * 1000);
	const dueAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

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
		delayedPostTestFormId: delayedTestFormId,
		delayedPostTestDelayDays: 7,
		tamFormId,
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

	// Target the two Java research cohorts so the segmentation-model groups see
	// this assignment. Fallback: in a fresh database (e.g. production) the
	// cohorts may not exist yet - target every student user instead so nobody
	// is locked out.
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
			`  Cohorts not found - targeting ${students.length} student user(s) directly`,
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

	yield* Effect.log("--- Seed Uji Dua Model #2 selesai ---");
}).pipe(
	Effect.provide(
		Layer.mergeAll(
			Layer.provideMerge(Auth.Default, DatabaseLive),
			RateLimiter.Default,
			Logger.pretty,
		),
	),
);

/**
 * The Rantai Makanan seed as a reusable Effect (self-provided layers), so
 * `scripts/seed/index.ts` can compose it into the main `db:seed` program.
 */
export function seedRantaiMakanan() {
	return program.pipe(
		Effect.provide(
			Layer.mergeAll(
				Layer.provideMerge(Auth.Default, DatabaseLive),
				RateLimiter.Default,
				Logger.pretty,
			),
		),
	);
}

// Allow direct execution (`npx tsx --env-file=.env scripts/seed/rantai-makanan.ts`)
// while staying importable from index.ts without double-running.
if (process.argv[1]) {
	const { pathToFileURL } = await import("node:url");
	if (import.meta.url === pathToFileURL(process.argv[1]).href) {
		void Effect.runPromise(seedRantaiMakanan());
	}
}
