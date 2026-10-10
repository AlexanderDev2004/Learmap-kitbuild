import type { MapEdge, MapGraph, MapNode, Segment } from "@/shared/types";

/**
 * Engine segmentasi peta konsep untuk LearnMap.
 *
 * Dua model yang dibandingkan (sesuai fokus penelitian):
 * 1. `segmentByParagraph` — peta dibagi mengikuti struktur paragraf materi
 *    pembelajaran (tiap konsep ditandai nomor paragrafnya).
 * 2. `segmentByDepth` — peta dibagi berdasarkan kedalaman hierarki topik,
 *    dari konsep umum (root) menuju konsep yang lebih spesifik.
 *
 * Landasan: Segmenting Principle (Mayer), dioperasikan untuk peta konsep
 * mengikuti Schneider et al. (2021): segmen yang bermakna dan koheren.
 */

function groupBy<K>(items: string[], keyOf: (item: string) => K): Map<K, string[]> {
	const groups = new Map<K, string[]>();
	for (const item of items) {
		const key = keyOf(item);
		const list = groups.get(key);
		if (list) list.push(item);
		else groups.set(key, [item]);
	}
	return groups;
}

function toSegments(groups: Map<number, string[]>, edges: MapEdge[]): Segment[] {
	const orderedKeys = [...groups.keys()].sort((a, b) => a - b);
	return orderedKeys.map((key, i) => {
		const nodeIds = groups.get(key) ?? [];
		const idSet = new Set(nodeIds);
		const edgeIds = edges
			.filter((e) => idSet.has(e.source) && idSet.has(e.target))
			.map((e) => e.id);
		return { index: i + 1, nodeIds, edgeIds };
	});
}

/**
 * Model 1 — segmentasi berbasis paragraf.
 *
 * Setiap simpul konsep membawa `paragraph` (nomor paragraf materi).
 * Simpul link (kata penghubung) mengikuti paragraf konsep tujuannya
 * (sisi link → konsep), sehingga proposisi utuh selesai pada paragraf
 * tempat konsep kedua dibahas dan tidak terpotong lintas segmen.
 */
export function segmentByParagraph(nodes: MapNode[], edges: MapEdge[]): Segment[] {
	const nodeById = new Map(nodes.map((n) => [n.id, n]));

	// Paragraf efektif untuk tiap link: paragraf konsep tujuan pada sisi link → konsep.
	const linkParagraph = new Map<string, number>();
	for (const link of nodes.filter((n) => n.type === "link")) {
		const targetParagraphs = edges
			.filter((e) => e.source === link.id)
			.map((e) => nodeById.get(e.target))
			.filter((n): n is MapNode => !!n && n.type === "concept" && n.paragraph != null)
			.map((n) => n.paragraph as number);
		if (targetParagraphs.length > 0) {
			linkParagraph.set(link.id, Math.min(...targetParagraphs));
		}
	}

	const segmentsOf = (node: MapNode): number => {
		if (node.paragraph != null) return node.paragraph;
		return linkParagraph.get(node.id) ?? 1;
	};

	const groups = groupBy(
		nodes.map((n) => n.id),
		(id) => segmentsOf(nodeById.get(id) as MapNode),
	);
	return toSegments(groups, edges);
}

/**
 * Model 2 — segmentasi berbasis kedalaman topik (depth).
 *
 * Kedalaman dihitung dari arah hierarki: konsep → link → konsep berarti
 * konsep sumber lebih umum, konsep tujuan lebih spesifik. Simpul tanpa
 * jalur masuk (akar) berada pada depth 1; tiap hop turun menambah depth.
 * Satu segmen per level kedalaman, diurutkan umum → spesifik.
 */
export function segmentByDepth(nodes: MapNode[], edges: MapEdge[]): Segment[] {
	const conceptIds = nodes.filter((n) => n.type === "concept").map((n) => n.id);
	const conceptSet = new Set(conceptIds);
	const nodeById = new Map(nodes.map((n) => [n.id, n]));

	// Adjacency konsep: C1 -> C2 terbentuk dari sepasang sisi C1 -> link -> C2.
	const next = new Map<string, string[]>();
	const incoming = new Map<string, number>();
	for (const id of conceptIds) {
		next.set(id, []);
		incoming.set(id, 0);
	}
	const linksTo = (linkId: string) =>
		edges.filter((e) => e.target === linkId && conceptSet.has(e.source)).map((e) => e.source);
	for (const edge of edges) {
		const sourceNode = nodeById.get(edge.source);
		const targetNode = nodeById.get(edge.target);
		if (!sourceNode || sourceNode.type !== "link" || !targetNode || targetNode.type !== "concept")
			continue;
		for (const parentId of linksTo(edge.source)) {
			if (parentId === edge.target) continue;
			const list = next.get(parentId) as string[];
			if (!list.includes(edge.target)) {
				list.push(edge.target);
				incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
			}
		}
	}

	// BFS dari akar (tanpa jalur masuk) untuk menetapkan depth.
	const depth = new Map<string, number>();
	const queue: string[] = conceptIds.filter((id) => (incoming.get(id) ?? 0) === 0);
	if (queue.length === 0 && conceptIds.length > 0) queue.push(conceptIds[0] as string);
	for (const id of queue) depth.set(id, 1);
	while (queue.length > 0) {
		const current = queue.shift() as string;
		const currentDepth = depth.get(current) as number;
		for (const nextId of next.get(current) ?? []) {
			const known = depth.get(nextId);
			if (known == null || currentDepth + 1 < known) {
				depth.set(nextId, currentDepth + 1);
				queue.push(nextId);
			}
		}
	}
	// Konsep yang tidak terjangkau (struktur siklik/terputus) masuk segmen akhir.
	for (const id of conceptIds) if (!depth.has(id)) depth.set(id, Number.MAX_SAFE_INTEGER);

	// Simpul link mengikuti kedalaman terkecil dari konsep yang terhubung dengannya.
	const groups = groupBy(
		nodes.map((n) => n.id),
		(id) => {
			const node = nodeById.get(id);
			if (node && node.type === "concept") return depth.get(id) as number;
			const neighborDepths = edges
				.filter((e) => e.source === id || e.target === id)
				.map((e) => {
					const otherId = e.source === id ? e.target : e.source;
					const neighbor = nodeById.get(otherId);
					return neighbor && neighbor.type === "concept" ? (depth.get(neighbor.id) as number) : Number.MAX_SAFE_INTEGER;
				});
			return neighborDepths.length > 0 ? Math.min(...neighborDepths) : 1;
		},
	);
	return toSegments(groups, edges);
}

/**
 * Memilih engine segmentasi sesuai model, lalu memvalidasi hasilnya
 * (semua simpul harus masuk tepat satu segmen).
 */
export function segmentMap(graph: MapGraph, model: "paragraph" | "depth"): Segment[] {
	const segments = model === "paragraph" ? segmentByParagraph(graph.nodes, graph.edges) : segmentByDepth(graph.nodes, graph.edges);

	const seen = new Set<string>();
	for (const segment of segments) {
		for (const id of segment.nodeIds) {
			if (seen.has(id)) {
				throw new Error(`Simpul ${id} muncul di lebih dari satu segmen`);
			}
			seen.add(id);
		}
	}
	if (seen.size !== graph.nodes.length) {
		throw new Error("Tidak semua simpul tercakup dalam segmen");
	}
	return segments;
}

/**
 * Memecah materi menjadi daftar paragraf (dipisahkan baris kosong).
 * Dipakai peneliti untuk menautkan konsep ke paragraf.
 */
export function splitParagraphs(content: string): string[] {
	return content
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
}
