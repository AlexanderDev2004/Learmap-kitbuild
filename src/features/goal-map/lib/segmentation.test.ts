import { describe, expect, it } from "vite-plus/test";

import { computeDepthSegments } from "@/features/goal-map/lib/segmentation";

function node(id: string, type: "text" | "connector" = "text") {
	return { id, type } as never;
}

function edge(id: string, source: string, target: string) {
	return { id, source, target } as never;
}

describe("computeDepthSegments", () => {
	it("groups concepts by depth through connectors, root first", () => {
		// A --c1--> B --c2--> C  (chain through connector nodes)
		const nodes = [
			node("A"),
			node("B"),
			node("C"),
			node("c1", "connector"),
			node("c2", "connector"),
		];
		const edges = [
			edge("e1", "A", "c1"),
			edge("e2", "c1", "B"),
			edge("e3", "B", "c2"),
			edge("e4", "c2", "C"),
		];
		expect(computeDepthSegments(nodes, edges)).toEqual([["A"], ["B"], ["C"]]);
	});

	it("puts concepts linked directly (no connector) at adjacent depths", () => {
		const nodes = [node("root"), node("leaf")];
		const edges = [edge("e1", "root", "leaf")];
		expect(computeDepthSegments(nodes, edges)).toEqual([["root"], ["leaf"]]);
	});

	it("keeps isolated concepts in the first segment", () => {
		const nodes = [node("root"), node("leaf"), node("lone")];
		const edges = [edge("e1", "root", "leaf")];
		const segments = computeDepthSegments(nodes, edges);
		expect(segments[0]).toEqual(expect.arrayContaining(["root", "lone"]));
		expect(segments[1]).toEqual(["leaf"]);
	});

	it("ignores connector-only nodes when grouping", () => {
		const nodes = [node("A"), node("B"), node("c1", "connector")];
		const edges = [edge("e1", "A", "c1"), edge("e2", "c1", "B")];
		const segments = computeDepthSegments(nodes, edges);
		expect(segments.flat()).not.toContain("c1");
		expect(segments).toHaveLength(2);
	});

	it("returns a single group when there are no edges", () => {
		const nodes = [node("A"), node("B")];
		expect(computeDepthSegments(nodes, [])).toEqual([["A", "B"]]);
	});
});
