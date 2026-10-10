import { describe, expect, it } from "vitest";

import type { MapEdge, MapNode } from "@/shared/types";
import { segmentByDepth, segmentByParagraph, segmentMap, splitParagraphs } from "./segmentation";

function node(id: string, type: "concept" | "link", label: string, paragraph?: number): MapNode {
	return { id, type, label, position: { x: 0, y: 0 }, paragraph };
}

// Peta kecil: F = Fotosintesis (root), C = Cahaya, K = Klorofil, G = Glukosa.
const nodes: MapNode[] = [
	node("f", "concept", "Fotosintesis", 1),
	node("c", "concept", "Cahaya Matahari", 1),
	node("k", "concept", "Klorofil", 2),
	node("g", "concept", "Glukosa", 3),
	node("l-need", "link", "membutuhkan"),
	node("l-use", "link", "menggunakan"),
	node("l-produce", "link", "menghasilkan"),
];

const edges: MapEdge[] = [
	{ id: "e1", source: "f", target: "l-need" },
	{ id: "e2", source: "l-need", target: "c" },
	{ id: "e3", source: "f", target: "l-use" },
	{ id: "e4", source: "l-use", target: "k" },
	{ id: "e5", source: "f", target: "l-produce" },
	{ id: "e6", source: "l-produce", target: "g" },
];

describe("segmentByParagraph", () => {
	it("membagi simpul sesuai nomor paragraf, link mengikuti paragraf terkecil tetangganya", () => {
		const segments = segmentByParagraph(nodes, edges);
		expect(segments.map((s) => s.index)).toEqual([1, 2, 3]);
		expect(segments[0]?.nodeIds).toContain("f");
		expect(segments[0]?.nodeIds).toContain("c");
		// link "membutuhkan" hanya tersambung ke paragraf 1, jadi masuk segmen 1.
		expect(segments[0]?.nodeIds).toContain("l-need");
		expect(segments[1]?.nodeIds).toEqual(["k", "l-use"]);
		expect(segments[2]?.nodeIds).toEqual(["g", "l-produce"]);
	});

	it("sisi hanya masuk segmen jika kedua ujungnya di segmen yang sama", () => {
		const segments = segmentByParagraph(nodes, edges);
		const e1InSegment1 = segments[0]?.edgeIds.includes("e1");
		expect(e1InSegment1).toBe(true);
		// e3 (f->l-use) melintasi paragraf 1 -> 2, tidak boleh ada di segmen mana pun.
		const allEdgeIds = segments.flatMap((s) => s.edgeIds);
		expect(allEdgeIds).not.toContain("e3");
	});

	it("konsep tanpa penanda paragraf masuk segmen 1", () => {
		const withUntagged = [...nodes, node("x", "concept", "Konsep Lupa")];
		const segments = segmentByParagraph(withUntagged, edges);
		const all = segments.flatMap((s) => s.nodeIds);
		expect(all).toContain("x");
		expect(segments[0]?.nodeIds).toContain("x");
	});
});

describe("segmentByDepth", () => {
	it("mengelompokkan dari konsep umum (depth 1) ke spesifik", () => {
		const segments = segmentByDepth(nodes, edges);
		expect(segments.map((s) => s.index)).toEqual([1, 2]);
		// Link di segmen 1 karena mengikuti kedalaman terkecil konsep tetangganya.
		expect(segments[0]?.nodeIds.sort()).toEqual(["f", "l-need", "l-produce", "l-use"]);
		expect(segments[1]?.nodeIds).toEqual(["c", "k", "g"]);
	});

	it("berbeda dari hasil segmentasi paragraf untuk peta yang sama", () => {
		const byParagraph = segmentByParagraph(nodes, edges).map((s) => s.nodeIds.sort());
		const byDepth = segmentByDepth(nodes, edges).map((s) => s.nodeIds.sort());
		expect(byDepth).not.toEqual(byParagraph);
	});
});

describe("segmentMap", () => {
	it("menjamin semua simpul tercakup tepat sekali", () => {
		for (const model of ["paragraph", "depth"] as const) {
			const segments = segmentMap({ nodes, edges }, model);
			const all = segments.flatMap((s) => s.nodeIds);
			expect(new Set(all).size).toBe(nodes.length);
		}
	});

	it("melempar error jika ada simpul duplikat antar segmen", () => {
		const bad = nodes.map((n) => ({ ...n, paragraph: 1 }));
		expect(() => segmentMap({ nodes: bad, edges }, "paragraph")).not.toThrow();
	});
});

describe("splitParagraphs", () => {
	it("memisahkan paragraf dengan baris kosong", () => {
		const paragraphs = splitParagraphs("Para satu.\n\nPara dua.\n\n \n\nPara tiga.");
		expect(paragraphs).toEqual(["Para satu.", "Para dua.", "Para tiga."]);
	});
});
