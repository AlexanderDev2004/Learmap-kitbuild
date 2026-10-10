import { describe, expect, it } from "vitest";

import type { MapEdge, MapNode } from "@/shared/types";
import { composePropositions, diagnoseMap } from "./comparator";

function concept(id: string, label: string): MapNode {
	return { id, type: "concept", label, position: { x: 0, y: 0 } };
}
function link(id: string, label: string): MapNode {
	return { id, type: "link", label, position: { x: 0, y: 0 } };
}
function edge(id: string, source: string, target: string): MapEdge {
	return { id, source, target };
}

const goalNodes = [
	concept("g1", "Fotosintesis"),
	concept("g2", "Cahaya Matahari"),
	link("gl1", "membutuhkan"),
];
const goalEdges = [
	edge("ge1", "g1", "gl1"),
	edge("ge2", "gl1", "g2"),
];

describe("composePropositions", () => {
	it("membentuk tripel konsep-link-konsep", () => {
		const propositions = composePropositions(goalNodes, goalEdges);
		expect(propositions).toHaveLength(1);
		expect(propositions[0]).toEqual({ sourceId: "g1", linkId: "gl1", targetId: "g2" });
	});
});

describe("diagnoseMap", () => {
	it("mengenali proposisi benar meski id simpul berbeda (cocok via label)", () => {
		const learnerNodes = [
			concept("s9", "Fotosintesis"),
			concept("s4", "Cahaya Matahari"),
			link("s7", "membutuhkan"),
		];
		const learnerEdges = [edge("se1", "s9", "s7"), edge("se2", "s7", "s4")];
		const result = diagnoseMap({ nodes: goalNodes, edges: goalEdges }, { nodes: learnerNodes, edges: learnerEdges });
		expect(result.correct).toBe(1);
		expect(result.missing).toBe(0);
		expect(result.excessive).toBe(0);
		expect(result.score).toBe(1);
	});

	it("menghitung missing dan excessive secara terpisah", () => {
		// Siswa menyusun "Cahaya Matahari membutuhkan Fotosintesis" (terbalik) — excessive.
		const learnerNodes = [
			concept("s1", "Fotosintesis"),
			concept("s2", "Cahaya Matahari"),
			link("s3", "membutuhkan"),
		];
		const learnerEdges = [edge("se1", "s2", "s3"), edge("se2", "s3", "s1")];
		const result = diagnoseMap({ nodes: goalNodes, edges: goalEdges }, { nodes: learnerNodes, edges: learnerEdges });
		expect(result.correct).toBe(0);
		expect(result.missing).toBe(1);
		expect(result.excessive).toBe(1);
		expect(result.score).toBe(0);
		expect(result.missingLabels).toEqual(["Fotosintesis|membutuhkan|Cahaya Matahari"]);
	});

	it("proposisi setengah jadi (tanpa konsep tujuan) tidak dihitung", () => {
		const learnerNodes = [concept("s1", "Fotosintesis"), link("s3", "membutuhkan")];
		const learnerEdges = [edge("se1", "s1", "s3")];
		const result = diagnoseMap({ nodes: goalNodes, edges: goalEdges }, { nodes: learnerNodes, edges: learnerEdges });
		expect(result.score).toBe(0);
		expect(result.excessive).toBe(0);
	});

	it("proposisi duplikat di goal map hanya dihitung sekali", () => {
		const duplicated = [...goalEdges, edge("ge-dup", "g1", "gl1")];
		const result = diagnoseMap({ nodes: goalNodes, edges: duplicated }, { nodes: goalNodes, edges: goalEdges });
		expect(result.totalGoalPropositions).toBe(1);
		expect(result.correct).toBe(1);
		expect(result.score).toBe(1);
	});

	it("goal map kosong menghasilkan score 0 tanpa error", () => {
		const result = diagnoseMap({ nodes: [], edges: [] }, { nodes: goalNodes, edges: goalEdges });
		expect(result.score).toBe(0);
		expect(result.totalGoalPropositions).toBe(0);
	});
});
