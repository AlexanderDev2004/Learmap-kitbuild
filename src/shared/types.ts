/**
 * Tipe domain bersama untuk LearnMap.
 * Semua modul (server, frontend, test) memakai tipe ini.
 */

export type Role = "peneliti" | "siswa";

/** Model segmentasi yang dibandingkan dalam penelitian. */
export type SegmentModel = "paragraph" | "depth";

export interface MapNode {
	id: string;
	/** concept = simpul konsep, link = simpul kata penghubung (connector). */
	type: "concept" | "link";
	label: string;
	position: { x: number; y: number };
	/**
	 * Nomor paragraf materi (mulai dari 1) tempat konsep ini dibahas.
	 * Dipakai oleh segmentasi berbasis paragraf.
	 */
	paragraph?: number;
}

export interface MapEdge {
	id: string;
	source: string;
	target: string;
}

/** Peta konsep disimpan sebagai daftar simpul + sisi. */
export interface MapGraph {
	nodes: MapNode[];
	edges: MapEdge[];
}

/** Satu segmen hasil pembagian peta konsep. */
export interface Segment {
	/** Urutan segmen, dimulai dari 1. */
	index: number;
	nodeIds: string[];
	edgeIds: string[];
}

export interface McqQuestion {
	id: string;
	question: string;
	options: string[];
	/** Indeks jawaban benar pada `options`. */
	answerIndex: number;
}

export interface LikertItem {
	id: string;
	statement: string;
}

/** Skala Likert 1..5 yang dipakai kuesioner persepsi. */
export const LIKERT_SCALE = [
	{ value: 1, label: "Sangat tidak setuju" },
	{ value: 2, label: "Tidak setuju" },
	{ value: 3, label: "Netral" },
	{ value: 4, label: "Setuju" },
	{ value: 5, label: "Sangat setuju" },
] as const;

export type ParticipationPhase =
	| "pretest"
	| "material"
	| "build"
	| "posttest"
	| "questionnaire"
	| "completed";

export const PHASE_ORDER: ParticipationPhase[] = [
	"pretest",
	"material",
	"build",
	"posttest",
	"questionnaire",
	"completed",
];

/** Catatan waktu per fase (epoch ms). */
export interface PhaseTiming {
	startedAt?: number;
	endedAt?: number;
}

export interface ParticipationTimings {
	pretest?: PhaseTiming;
	material?: PhaseTiming;
	build?: PhaseTiming;
	posttest?: PhaseTiming;
	questionnaire?: PhaseTiming;
}

/** Hasil diagnosis peta siswa terhadap goal map. */
export interface DiagnosisResult {
	correct: number;
	missing: number;
	excessive: number;
	totalGoalPropositions: number;
	/** Proporsi proposisi benar terhadap total proposisi goal map (0..1). */
	score: number;
	/** Kunci proposisi benar, format "konsep|link|konsep" (label). */
	correctLabels: string[];
	missingLabels: string[];
	excessiveLabels: string[];
}
