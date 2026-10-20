import type { Node, Edge } from "@/features/learner-map/lib/comparator";

/**
 * Depth-topic segmentation: group concept (text) nodes of a goal map by
 * their hierarchy depth — from the general (root) concepts to the most
 * specific ones. Connector nodes are treated as edge labels and collapsed,
 * so a concept directly links to every concept it is connected to through
 * a connector.
 *
 * Returns an ordered array of node-id groups (index 0 = most general).
 */
export function computeDepthSegments(nodes: Node[], edges: Edge[]): string[][] {
	const textNodes = nodes.filter((n) => n.type === "text");
	const textIds = new Set(textNodes.map((n) => n.id));

	// Directed adjacency over concepts, collapsing paths that pass through
	// connectors: a concept links forward to every concept reachable via
	// concept -> connector -> concept, and to direct concept -> concept edges.
	const outgoing = new Map<string, Set<string>>();
	const incoming = new Map<string, Set<string>>();
	for (const id of textIds) {
		outgoing.set(id, new Set());
		incoming.set(id, new Set());
	}

	const link = (from: string, to: string) => {
		if (from === to || !textIds.has(from) || !textIds.has(to)) return;
		outgoing.get(from)?.add(to);
		incoming.get(to)?.add(from);
	};

	const sourceOfConnector = new Map<string, string[]>();
	for (const edge of edges) {
		if (textIds.has(edge.target) && !textIds.has(edge.source)) {
			sourceOfConnector.set(edge.target, [
				...(sourceOfConnector.get(edge.target) ?? []),
				edge.source,
			]);
		}
	}
	for (const edge of edges) {
		if (textIds.has(edge.source) && textIds.has(edge.target)) {
			link(edge.source, edge.target);
		} else if (textIds.has(edge.source)) {
			// concept -> connector -> ... : follow one more hop
			for (const next of edges.filter((e) => e.source === edge.target)) {
				if (textIds.has(next.target)) link(edge.source, next.target);
			}
		} else if (textIds.has(edge.target)) {
			// connector -> concept: attach every concept feeding the connector
			for (const prev of sourceOfConnector.get(edge.source) ?? []) {
				link(prev, edge.target);
			}
		}
	}

	// Roots: concepts with no incoming connections. Isolated concepts
	// (no edges at all) are roots too so they still end up in a segment.
	const roots = textNodes.filter((n) => (incoming.get(n.id)?.size ?? 0) === 0).map((n) => n.id);

	// BFS levels (shortest distance from any root).
	const levelOf = new Map<string, number>();
	const queue = [...roots];
	for (const root of roots) levelOf.set(root, 0);
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		const nextLevel = (levelOf.get(current) ?? 0) + 1;
		for (const next of outgoing.get(current) ?? []) {
			if (!levelOf.has(next)) {
				levelOf.set(next, nextLevel);
				queue.push(next);
			}
		}
	}

	const maxLevel = Math.max(0, ...levelOf.values());
	const levels: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
	for (const node of textNodes) {
		const level = levelOf.get(node.id) ?? 0;
		levels[level].push(node.id);
	}

	return levels.filter((ids) => ids.length > 0);
}
