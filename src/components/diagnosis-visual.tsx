import { Background, ReactFlow, type Edge as FlowEdge, type Node as FlowNode } from "@xyflow/react";

import type { DiagnosisResult, MapEdge, MapNode } from "@/shared/types";

/**
 * Umpan balik visual diagnosis peta: ringkasan berwarna (benar/kurang/keliru),
 * daftar proposisi per kategori, dan peta siswa dengan sisi berwarna sesuai
 * status proposisinya. Dipakai siswa (setelah build) dan peneliti (detail diagnosis).
 */

export interface VisualLearnerMap {
	nodes: { id: string; type: "concept" | "link"; label: string; position: { x: number; y: number } }[];
	edges: { id: string; source: string; target: string }[];
}

type EdgeStatus = "correct" | "excessive" | "mixed" | "none";

const EDGE_COLOR: Record<EdgeStatus, string> = {
	correct: "#16a34a",
	excessive: "#dc2626",
	mixed: "#d97706",
	none: "#94a3b8",
};

/**
 * Warna sisi peta siswa: sebuah sisi bisa menjadi bagian dari beberapa
 * proposisi (sisi konsep→link dan link→konsep). Status sisi = gabungan
 * status proposisi yang melaluinya.
 */
export function computeEdgeStatuses(edges: MapEdge[], nodes: MapNode[], diagnosis: DiagnosisResult | null): EdgeStatus[] {
	const labels = new Map(nodes.map((node) => [node.id, node.label]));
	const conceptIds = new Set(nodes.filter((node) => node.type === "concept").map((node) => node.id));
	const linkIds = new Set(nodes.filter((node) => node.type === "link").map((node) => node.id));
	const correctSet = new Set(diagnosis?.correctLabels ?? []);
	const excessiveSet = new Set(diagnosis?.excessiveLabels ?? []);

	const keyOf = (sourceId: string, linkId: string, targetId: string) =>
		[labels.get(sourceId), labels.get(linkId), labels.get(targetId)].join("|");

	const triplesByEdge = new Map<string, Set<string>>();
	const addTriple = (edgeId: string, key: string) => {
		const bucket = triplesByEdge.get(edgeId) ?? new Set<string>();
		bucket.add(key);
		triplesByEdge.set(edgeId, bucket);
	};

	for (const first of edges) {
		if (!conceptIds.has(first.source) || !linkIds.has(first.target)) continue;
		for (const second of edges) {
			if (second.source !== first.target || !conceptIds.has(second.target)) continue;
			const key = keyOf(first.source, first.target, second.target);
			addTriple(first.id, key);
			addTriple(second.id, key);
		}
	}

	return edges.map((edge) => {
		const keys = triplesByEdge.get(edge.id);
		if (!keys || keys.size === 0) return "none" as EdgeStatus;
		let correct = 0;
		let excessive = 0;
		for (const key of keys) {
			if (correctSet.has(key)) correct += 1;
			else if (excessiveSet.has(key)) excessive += 1;
		}
		if (correct > 0 && excessive === 0) return "correct" as EdgeStatus;
		if (excessive > 0 && correct === 0) return "excessive" as EdgeStatus;
		if (correct > 0 && excessive > 0) return "mixed" as EdgeStatus;
		return "none" as EdgeStatus;
	});
}

export function DiagnosisLegend() {
	return (
		<div className="flex flex-wrap gap-3 text-xs text-slate-600">
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-0.5 w-5 rounded bg-green-600" /> Benar
			</span>
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-0.5 w-5 rounded bg-red-600" /> Keliru / berlebih
			</span>
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-0.5 w-5 rounded bg-amber-600" /> Campuran (benar & keliru)
			</span>
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-0.5 w-5 rounded bg-slate-400" /> Belum membentuk proposisi
			</span>
		</div>
	);
}

function PropositionList({
	title,
	count,
	tone,
	labels,
	emptyText,
}: {
	title: string;
	count: number;
	tone: "green" | "amber" | "red";
	labels: string[];
	emptyText: string;
}) {
	const toneClass =
		tone === "green"
			? "border-green-200 bg-green-50 [&_p:first-child]:text-green-700 [&_li]:text-green-900"
			: tone === "amber"
				? "border-amber-200 bg-amber-50 [&_p:first-child]:text-amber-700 [&_li]:text-amber-900"
				: "border-red-200 bg-red-50 [&_p:first-child]:text-red-700 [&_li]:text-red-900";
	return (
		<div className={`rounded-lg border p-3 ${toneClass}`}>
			<p className="text-xs font-semibold">
				{title} ({count})
			</p>
			<ul className="mt-1 list-inside list-disc space-y-1 text-sm">
				{labels.map((label) => (
					<li key={label}>{label.replaceAll("|", " → ")}</li>
				))}
				{labels.length === 0 ? <li className="list-none opacity-70">{emptyText}</li> : null}
			</ul>
		</div>
	);
}

export function DiagnosisVisual({
	diagnosis,
	learnerMap,
	mapHeight = 320,
}: {
	diagnosis: DiagnosisResult | null;
	learnerMap: VisualLearnerMap | null;
	mapHeight?: number;
}) {
	const correctLabels = diagnosis?.correctLabels ?? [];
	const missingLabels = diagnosis?.missingLabels ?? [];
	const excessiveLabels = diagnosis?.excessiveLabels ?? [];
	const hasMap = learnerMap != null && learnerMap.nodes.length > 0;

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-4">
				<div className="rounded-lg border border-green-200 bg-green-50 p-3">
					<p className="text-xs font-semibold text-green-700">Benar</p>
					<p className="mt-1 text-lg font-semibold text-green-800">{diagnosis?.correct ?? 0}</p>
				</div>
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
					<p className="text-xs font-semibold text-amber-700">Kurang (missing)</p>
					<p className="mt-1 text-lg font-semibold text-amber-800">{diagnosis?.missing ?? 0}</p>
				</div>
				<div className="rounded-lg border border-red-200 bg-red-50 p-3">
					<p className="text-xs font-semibold text-red-700">Keliru (berlebih)</p>
					<p className="mt-1 text-lg font-semibold text-red-800">{diagnosis?.excessive ?? 0}</p>
				</div>
				<div className="rounded-lg border border-slate-200 p-3">
					<p className="text-xs font-semibold text-slate-500">Total proposisi goal map</p>
					<p className="mt-1 text-lg font-semibold">{diagnosis?.totalGoalPropositions ?? 0}</p>
				</div>
			</div>

			<PropositionList
				title="Proposisi benar"
				count={correctLabels.length}
				tone="green"
				labels={correctLabels}
				emptyText="Belum ada."
			/>
			<PropositionList
				title="Proposisi kurang — ada di goal map tapi tidak di peta Anda"
				count={missingLabels.length}
				tone="amber"
				labels={missingLabels}
				emptyText="Tidak ada."
			/>
			<PropositionList
				title="Proposisi keliru — tidak sesuai goal map"
				count={excessiveLabels.length}
				tone="red"
				labels={excessiveLabels}
				emptyText="Tidak ada."
			/>

			{hasMap ? (
				<div>
					<p className="mb-2 text-xs font-semibold text-slate-500">Peta Anda (warna sesuai status proposisi)</p>
					<div className="overflow-hidden rounded-lg border border-slate-200" style={{ height: mapHeight }}>
						<ReactFlow
							nodes={learnerMap.nodes.map(
								(node): FlowNode => ({
									id: node.id,
									position: node.position,
									data: { label: node.label },
									style:
										node.type === "link"
											? { borderRadius: 9999, background: "#f1f5f9", fontSize: 12 }
											: undefined,
								}),
							)}
							edges={learnerMap.edges.map((edge, index): FlowEdge => {
								const status = computeEdgeStatuses(learnerMap.edges, learnerMap.nodes as MapNode[], diagnosis)[index];
								return {
									id: edge.id,
									source: edge.source,
									target: edge.target,
									style: { stroke: EDGE_COLOR[status], strokeWidth: 2 },
								};
							})}
							nodesDraggable={false}
							edgesFocusable={false}
							nodesConnectable={false}
							elementsSelectable={false}
							proOptions={{ hideAttribution: true }}
							fitView
						>
							<Background />
						</ReactFlow>
					</div>
					<div className="mt-2">
						<DiagnosisLegend />
					</div>
				</div>
			) : (
				<p className="text-sm text-slate-500">Peta belum tersimpan.</p>
			)}
		</div>
	);
}
