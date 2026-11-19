import { describe, expect, it } from "vite-plus/test";

import { filterSegmentsByModel } from "./segment-model";

// Interleaved on purpose: a filter that keeps the first N segments instead of
// filtering by type would still pass a grouped input.
const segments = [
	{ id: "p1", type: "paragraph" },
	{ id: "d1", type: "depth-topic" },
	{ id: "p2", type: "paragraph" },
	{ id: "d2", type: "depth-topic" },
] as const;

const ids = (model: Parameters<typeof filterSegmentsByModel>[1]) =>
	filterSegmentsByModel(segments, model).map((segment) => segment.id);

describe("filterSegmentsByModel", () => {
	it("shows only paragraph segments for the paragraph arm", () => {
		expect(ids("paragraph")).toEqual(["p1", "p2"]);
	});

	it("shows only depth-topic segments for the depth-topic arm", () => {
		expect(ids("depth-topic")).toEqual(["d1", "d2"]);
	});

	it("shows every segment, in order, for the combined arm", () => {
		expect(ids("both")).toEqual(["p1", "d1", "p2", "d2"]);
	});

	it("shows no segments for the control arm", () => {
		expect(ids("none")).toEqual([]);
	});
});
