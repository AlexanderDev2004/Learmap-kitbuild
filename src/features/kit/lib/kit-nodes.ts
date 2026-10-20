import type { Node } from "@xyflow/react";

/**
 * Kits are standalone copies of the goal map structure. Blueprint-style group
 * containers never reach a kit, so member nodes lose their parentId and get
 * their positions translated back to absolute coordinates.
 */
export function toKitNodes(nodes: Readonly<Node[]>): Node[] {
	const groupPositions = new Map(
		nodes.filter((n) => n?.type === "group").map((n) => [n.id, n.position]),
	);
	return nodes
		.filter((n) => n?.type === "text" || n?.type === "connector")
		.map((n) => {
			if (!n.parentId) return n;
			const parent = groupPositions.get(n.parentId);
			const { parentId: _removed, deletable: _removedDeletable, ...rest } = n;
			return {
				...rest,
				position: {
					x: n.position.x + (parent?.x ?? 0),
					y: n.position.y + (parent?.y ?? 0),
				},
			};
		});
}
