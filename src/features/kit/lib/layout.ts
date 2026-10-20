import dagre from "dagre";

import type { Edge, Node } from "@/features/learner-map/lib/comparator";

/**
 * Auto-layout nodes using dagre graph layout algorithm.
 * Blueprint-style group nodes and their children are skipped — they keep
 * their current positions because child positions are relative to the group.
 */
export function getLayoutedElements(
	nodes: Node[],
	edges: Edge[],
	direction = "LR",
): { nodes: Node[]; edges: Edge[] } {
	const groupedIds = new Set(
		nodes.filter((n) => n.type === "group" || n.parentId).map((n) => n.id),
	);
	const movableNodes = nodes.filter((n) => !groupedIds.has(n.id));
	const movableIds = new Set(movableNodes.map((n) => n.id));
	const movableEdges = edges.filter((e) => movableIds.has(e.source) && movableIds.has(e.target));

	if (movableNodes.length === 0) {
		return { nodes, edges };
	}

	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));

	const nodeWidth = 150;
	const nodeHeight = 50;

	dagreGraph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 });

	for (const node of movableNodes) {
		dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
	}

	for (const edge of movableEdges) {
		dagreGraph.setEdge(edge.source, edge.target);
	}

	dagre.layout(dagreGraph);

	const layoutedMovable = new Map(
		movableNodes.map((node) => {
			const nodeWithPosition = dagreGraph.node(node.id);
			return [
				node.id,
				{
					...node,
					position: {
						x: nodeWithPosition.x - nodeWidth / 2,
						y: nodeWithPosition.y - nodeHeight / 2,
					},
				} satisfies Node,
			];
		}),
	);

	const layoutedNodes = nodes.map((node) => layoutedMovable.get(node.id) ?? node);

	return { nodes: layoutedNodes, edges };
}
