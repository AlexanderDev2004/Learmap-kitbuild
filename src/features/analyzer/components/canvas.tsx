import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
	computeSegmentVerdicts,
	formatSegmentVerdict,
} from "@/features/analyzer/lib/segment-verdicts";
import { useAnalyticsEdges } from "@/features/analyzer/lib/use-analytics-edges";

import "@xyflow/react/dist/style.css";
import { useAnalyticsNodes } from "@/features/analyzer/lib/use-analytics-nodes";
import { assignHeaderOffsets } from "@/features/goal-map/lib/frame-header";
import { ConceptMapCanvas } from "@/features/kit/components/concept-map-canvas";
import type { Edge, Node } from "@/features/learner-map/lib/comparator";
import type { VisibilityState } from "@/features/learner-map/lib/visibility";
import { useRpcQuery } from "@/hooks/use-rpc-query";
import { GoalMapRpc } from "@/server/rpc/goal-map";

interface AnalyticsCanvasProps {
	goalMap: {
		id: string;
		title: string;
		nodes: ReadonlyArray<Node>;
		edges: ReadonlyArray<Edge>;
		direction: "bi" | "uni" | "multi";
	};
	learnerMap?: {
		id: string;
		userId: string;
		userName: string;
		status: string;
		attempt: number;
		submittedAt: number | null;
		nodes: ReadonlyArray<Node>;
		edges: ReadonlyArray<Edge>;
	};
	learnerMaps?: ReadonlyArray<{
		id: string;
		userId: string;
		userName: string;
		status: string;
		attempt: number;
		submittedAt: number | null;
		nodes: ReadonlyArray<Node>;
		edges: ReadonlyArray<Edge>;
	}>;
	edgeClassifications?: ReadonlyArray<{
		edge: Edge;
		type: "correct" | "missing" | "excessive" | "neutral";
		createdBy?: string;
	}>;
	allEdgeClassifications?: ReadonlyArray<{
		edge: Edge;
		type: "correct" | "missing" | "excessive" | "neutral";
		createdBy?: string;
	}>;
	visibility: VisibilityState;
	isMultiView?: boolean;
	readOnly?: boolean;
}

export function AnalyticsCanvas(props: AnalyticsCanvasProps) {
	return (
		<ReactFlowProvider>
			<AnalyticsCanvasInner {...props} />
		</ReactFlowProvider>
	);
}

function AnalyticsCanvasInner({
	goalMap,
	learnerMap,
	learnerMaps,
	edgeClassifications,
	allEdgeClassifications,
	visibility,
	isMultiView,
	readOnly = true,
}: AnalyticsCanvasProps) {
	const { zoomIn, zoomOut, fitView } = useReactFlow();

	const currentLearnerMaps = useMemo(
		() => (isMultiView ? learnerMaps || [] : learnerMap ? [learnerMap] : []),
		[isMultiView, learnerMaps, learnerMap],
	);

	const currentEdgeClassifications = useMemo(
		() => (isMultiView ? allEdgeClassifications || [] : edgeClassifications || []),
		[isMultiView, allEdgeClassifications, edgeClassifications],
	);

	const nodes = useAnalyticsNodes({
		goalNodes: goalMap.nodes,
		learnerMaps: currentLearnerMaps,
	});

	const edges = useAnalyticsEdges({
		goalEdges: goalMap.edges,
		currentLearnerMaps,
		currentEdgeClassifications,
		visibility,
		isMultiView,
	});

	// â”€â”€ Segment frames with per-segment verdicts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	// When exactly one learner map is selected, every segment frame shows how
	// well the student reconstructed that segment: Benar (all propositions
	// correct), Sebagian (partial), Missing (none correct), plus excessive
	// propositions the student added inside the segment. Verdicts reuse the
	// same compareMaps scoring as the global diagnosis, so they can never
	// contradict it. With multiple learners overlaid the comparison target is
	// ambiguous, so frames render without a verdict.
	const { data: segments } = useRpcQuery({
		...GoalMapRpc.listSegments({ goalMapId: goalMap.id }),
	});
	const segmentFrameNodes = useMemo(() => {
		if (!visibility.showFrames) return [];
		const hidden = new Set(visibility.hiddenSegmentIds ?? []);
		const models = visibility.shownModels;
		const list = (segments ?? []).filter(
			(s) => !hidden.has(s.id) && (models.length === 0 || models.includes(s.type)),
		);
		if (list.length === 0) return [];
		if (currentLearnerMaps.length !== 1) return [];
		const learner = currentLearnerMaps[0];
		const verdicts = computeSegmentVerdicts(
			goalMap.nodes,
			goalMap.edges,
			learner.nodes,
			learner.edges,
			list.map((s) => ({ id: s.id, nodeIds: [...s.nodeIds] })),
		);
		const PADDING = 28;
		const measured = (id: string) => {
			const rfNode = (
				nodes as Array<Node & { measured?: { width?: number; height?: number } }>
			).find((n) => n.id === id);
			return { w: rfNode?.measured?.width ?? 150, h: rfNode?.measured?.height ?? 60 };
		};
		const layout = list.map((segment) => {
			const members = segment.nodeIds
				.map((id) => goalMap.nodes.find((n) => n.id === id))
				.filter((n): n is Node => !!n);
			if (members.length === 0) return null;
			const minX = Math.min(...members.map((n) => n.position.x));
			const minY = Math.min(...members.map((n) => n.position.y));
			const maxX = Math.max(...members.map((n) => n.position.x + measured(n.id).w));
			const maxY = Math.max(...members.map((n) => n.position.y + measured(n.id).h));
			return {
				segment,
				position: { x: minX - PADDING, y: minY - PADDING },
				style: { width: maxX - minX + PADDING * 2, height: maxY - minY + PADDING * 2 + 28 },
			};
		});
		const placed = layout.filter((l) => l !== null);
		// Overlapping frames (the two models segment the same concepts) would
		// stack their header chips on the same line; push colliding chips up.
		const headerOffsets = assignHeaderOffsets(
			placed.map((l) => ({
				x: l.position.x,
				y: l.position.y,
				width: l.style.width,
				height: l.style.height,
			})),
		);
		return placed.map(({ segment, position, style }, placedIndex) => {
			const verdict = verdicts.get(segment.id);
			return {
				id: `segment-frame-${segment.id}`,
				type: "segmentFrame",
				zIndex: -1,
				position,
				style,
				width: style.width,
				height: style.height,
				measured: { width: style.width, height: style.height },
				selectable: false,
				draggable: false,
				connectable: false,
				data: {
					label: segment.name,
					color: segment.color ?? "#64748b",
					model: segment.type,
					headerOffset: headerOffsets[placedIndex],
					verdict: verdict
						? { text: formatSegmentVerdict(verdict), tone: verdict.tone }
						: undefined,
				},
			} as Node;
		});
	}, [segments, currentLearnerMaps, goalMap.nodes, goalMap.edges, nodes, visibility]);

	const displayEdges = edges as Edge[];
	const noop = useCallback(() => {}, []);

	return (
		<div className="flex-1 h-full relative">
			<div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
				<Button
					className="size-10"
					variant="floating"
					onClick={() => zoomIn()}
					title="Zoom In"
				>
					<ZoomIn className="size-4" />
				</Button>
				<Button
					className="size-10"
					variant="floating"
					onClick={() => zoomOut()}
					title="Zoom Out"
				>
					<ZoomOut className="size-4" />
				</Button>
				<Button
					className="size-10"
					variant="floating"
					onClick={() => fitView()}
					title="Fit View"
				>
					<span className="text-xs font-semibold">Fit</span>
				</Button>
			</div>
			<ConceptMapCanvas
				nodes={[...nodes, ...segmentFrameNodes] as Node[]}
				edges={displayEdges}
				onNodesChange={noop}
				onEdgesChange={noop}
				onConnect={noop}
				readOnly={readOnly}
			/>
		</div>
	);
}
