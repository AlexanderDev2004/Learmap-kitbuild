/**
 * Segmentation model an assignment shows to its learners.
 *
 * "paragraph"   — segment bar follows the reading-text structure (Model 1).
 * "depth-topic" — segment bar follows the goal-map hierarchy depth (Model 2).
 * "both"        — every segment defined on the goal map (pre-existing behaviour).
 * "none"        — no segment bar: the learner builds the full map (control group).
 */
export const SEGMENT_MODELS = ["paragraph", "depth-topic", "both", "none"] as const;

export type SegmentModel = (typeof SEGMENT_MODELS)[number];

export type SegmentType = "paragraph" | "depth-topic";

export const SEGMENT_MODEL_LABELS: Record<SegmentModel, string> = {
	paragraph: "Paragraf (Model 1)",
	"depth-topic": "Depth-Topic (Model 2)",
	both: "Kedua model",
	none: "Tanpa segmentasi (kontrol)",
};

/** Restrict a goal map's segments to the model this assignment uses. */
export function filterSegmentsByModel<T extends { type: SegmentType }>(
	segments: readonly T[],
	model: SegmentModel,
): T[] {
	if (model === "both") return [...segments];
	if (model === "none") return [];
	return segments.filter((segment) => segment.type === model);
}
