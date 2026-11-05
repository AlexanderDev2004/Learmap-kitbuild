import { compareMaps, type Edge, type Node } from "@/features/learner-map/lib/comparator";

/**
 * Per-segment diagnosis for the Analyzer: a segment frame gets a verdict
 * (Benar / Sebagian / Missing) derived from the same label-based proposition
 * comparison the app already uses for scoring, so these badges never disagree
 * with the global score. A goal proposition belongs to a segment when both of
 * its concept endpoints are members of that segment; learner propositions not
 * in the goal map are counted as "excessive" inside the segment their
 * endpoints belong to.
 */
export type SegmentVerdictTone = "correct" | "partial" | "missing" | "none";

export interface SegmentVerdict {
	segmentId: string;
	correct: number;
	missing: number;
	excessive: number;
	total: number;
	tone: SegmentVerdictTone;
}

type SegmentLike = { id: string; nodeIds: string[] };

export function computeSegmentVerdicts(
	goalNodes: ReadonlyArray<Node>,
	goalEdges: ReadonlyArray<Edge>,
	learnerNodes: ReadonlyArray<Node>,
	learnerEdges: ReadonlyArray<Edge>,
	segments: ReadonlyArray<SegmentLike>,
): Map<string, SegmentVerdict> {
	const diagnosis = compareMaps(goalNodes, goalEdges, learnerNodes, learnerEdges);

	// Goal node -> segment memberships (a concept may belong to several
	// segments, e.g. the root of a depth-topic segmentation).
	const segmentsByGoalId = new Map<string, Set<string>>();
	for (const segment of segments) {
		for (const nodeId of segment.nodeIds) {
			const membership = segmentsByGoalId.get(nodeId) ?? new Set<string>();
			membership.add(segment.id);
			segmentsByGoalId.set(nodeId, membership);
		}
	}

	const result = new Map<string, SegmentVerdict>();
	const counts = new Map<string, { correct: number; missing: number; excessive: number }>();
	for (const segment of segments) {
		counts.set(segment.id, { correct: 0, missing: 0, excessive: 0 });
		result.set(segment.id, {
			segmentId: segment.id,
			correct: 0,
			missing: 0,
			excessive: 0,
			total: 0,
			tone: "none",
		});
	}

	const bump = (segmentId: string, key: "correct" | "missing" | "excessive") => {
		const entry = counts.get(segmentId);
		if (entry) entry[key] += 1;
	};

	// Goal propositions (correct + missing) join the segments of both endpoints.
	const segmentsForGoalTriple = (t: { sourceId: string; targetId: string }) => {
		const source = segmentsByGoalId.get(t.sourceId);
		const target = segmentsByGoalId.get(t.targetId);
		if (!source || !target) return [];
		return [...source].filter((id) => target.has(id));
	};
	for (const triple of diagnosis.correct) {
		for (const segmentId of segmentsForGoalTriple(triple)) bump(segmentId, "correct");
	}
	for (const triple of diagnosis.missing) {
		for (const segmentId of segmentsForGoalTriple(triple)) bump(segmentId, "missing");
	}

	// Learner propositions that are not in the goal map: join via node labels,
	// because learner node ids may differ from goal node ids.
	const labelOf = (nodes: ReadonlyArray<Node>) => {
		const map = new Map<string, string>();
		for (const node of nodes) {
			const data = node.data as Record<string, unknown> | undefined;
			const label =
				data && typeof data === "object" && "label" in data ? String(data.label) : node.id;
			map.set(node.id, label);
		}
		return map;
	};
	const goalLabels = labelOf(goalNodes);
	const learnerLabels = labelOf(learnerNodes);
	const segmentsByGoalLabel = new Map<string, Set<string>>();
	for (const [nodeId, label] of goalLabels) {
		const membership = segmentsByGoalId.get(nodeId);
		if (!membership) continue;
		const byLabel = segmentsByGoalLabel.get(label) ?? new Set<string>();
		for (const id of membership) byLabel.add(id);
		segmentsByGoalLabel.set(label, byLabel);
	}
	for (const triple of diagnosis.excessive) {
		const sourceLabel = learnerLabels.get(triple.sourceId);
		const targetLabel = learnerLabels.get(triple.targetId);
		if (!sourceLabel || !targetLabel) continue;
		const source = segmentsByGoalLabel.get(sourceLabel);
		const target = segmentsByGoalLabel.get(targetLabel);
		if (!source || !target) continue;
		for (const segmentId of source) {
			if (target.has(segmentId)) bump(segmentId, "excessive");
		}
	}

	for (const segment of segments) {
		const entry = counts.get(segment.id);
		const verdict = result.get(segment.id);
		if (!entry || !verdict) continue;
		verdict.correct = entry.correct;
		verdict.missing = entry.missing;
		verdict.excessive = entry.excessive;
		verdict.total = entry.correct + entry.missing;
		if (verdict.total === 0) {
			verdict.tone = "none";
		} else if (entry.correct === verdict.total && entry.excessive === 0) {
			verdict.tone = "correct";
		} else if (entry.correct === 0) {
			verdict.tone = "missing";
		} else {
			verdict.tone = "partial";
		}
	}

	return result;
}

const TONE_LABEL: Record<SegmentVerdictTone, string> = {
	correct: "Benar",
	partial: "Sebagian",
	missing: "Missing",
	none: "Tidak dinilai",
};

export function formatSegmentVerdict(verdict: SegmentVerdict): string {
	if (verdict.tone === "none") return TONE_LABEL.none;
	const base = `${TONE_LABEL[verdict.tone]} ${verdict.correct}/${verdict.total}`;
	return verdict.excessive > 0 ? `${base} (+${verdict.excessive} berlebih)` : base;
}
