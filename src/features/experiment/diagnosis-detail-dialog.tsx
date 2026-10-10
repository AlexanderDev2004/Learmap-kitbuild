import { useQuery } from "@tanstack/react-query";
import { Background, ReactFlow, type Edge as FlowEdge, type Node as FlowNode } from "@xyflow/react";
import { X } from "lucide-react";

import type { DiagnosisResult, SegmentModel } from "@/shared/types";
import { api } from "@/lib/api";
import { Badge, Button, Spinner } from "@/components/ui";

interface DetailState {
	participationId: string;
	segmentModel: SegmentModel;
	phase: string;
	pretestScore: number | null;
	posttestScore: number | null;
	mapScore: number | null;
	diagnosis: DiagnosisResult | null;
	learnerMap: {
		nodes: { id: string; type: "concept" | "link"; label: string; position: { x: number; y: number } }[];
		edges: { id: string; source: string; target: string }[];
	} | null;
}

export function DiagnosisDetailDialog({
	participationId,
	studentName,
	onClose,
}: {
	participationId: string;
	studentName: string;
	onClose: () => void;
}) {
	const detail = useQuery({
		queryKey: ["participation-detail", participationId],
		queryFn: () => api.get<DetailState>(`/results/${participationId}`),
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8" onClick={onClose}>
			<div
				className="max-h-full w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
					<div>
						<h2 className="text-base font-semibold">Detail Diagnosis — {studentName}</h2>
						{detail.data ? (
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<Badge tone={detail.data.segmentModel === "paragraph" ? "blue" : "green"}>
									{detail.data.segmentModel === "paragraph" ? "Paragraf" : "Depth"}
								</Badge>
								<Badge>Map Score {((detail.data.mapScore ?? 0) * 100).toFixed(0)}%</Badge>
								<Badge>Pretest {((detail.data.pretestScore ?? 0) * 100).toFixed(0)}%</Badge>
								<Badge>Posttest {((detail.data.posttestScore ?? 0) * 100).toFixed(0)}%</Badge>
							</div>
						) : null}
					</div>
					<Button variant="outline" onClick={onClose} aria-label="Tutup">
						<X className="size-4" />
					</Button>
				</div>

				{detail.isPending ? <Spinner /> : null}

				{detail.data ? (
					<div className="space-y-4 px-5 py-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="rounded-lg border border-slate-200 p-3">
								<p className="text-xs font-semibold text-slate-500">Proposisi benar</p>
								<p className="mt-1 text-lg font-semibold text-green-700">{detail.data.diagnosis?.correct ?? 0}</p>
							</div>
							<div className="rounded-lg border border-slate-200 p-3">
								<p className="text-xs font-semibold text-slate-500">Total proposisi goal map</p>
								<p className="mt-1 text-lg font-semibold">{detail.data.diagnosis?.totalGoalPropositions ?? 0}</p>
							</div>
						</div>

						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p className="text-xs font-semibold text-amber-700">Missing ({detail.data.diagnosis?.missing ?? 0})</p>
							<ul className="mt-1 space-y-1 text-sm text-amber-900">
								{detail.data.diagnosis?.missingLabels.map((label) => (
									<li key={label}>{label.replaceAll("|", " → ")}</li>
								))}
								{(detail.data.diagnosis?.missingLabels.length ?? 0) === 0 ? <li className="text-amber-700">Tidak ada.</li> : null}
							</ul>
						</div>

						<div className="rounded-lg border border-red-200 bg-red-50 p-3">
							<p className="text-xs font-semibold text-red-700">Excessive ({detail.data.diagnosis?.excessive ?? 0})</p>
							<ul className="mt-1 space-y-1 text-sm text-red-900">
								{detail.data.diagnosis?.excessiveLabels.map((label) => (
									<li key={label}>{label.replaceAll("|", " → ")}</li>
								))}
								{(detail.data.diagnosis?.excessiveLabels.length ?? 0) === 0 ? <li className="text-red-700">Tidak ada.</li> : null}
							</ul>
						</div>

						<div>
							<p className="mb-2 text-xs font-semibold text-slate-500">Peta siswa</p>
							{detail.data.learnerMap && detail.data.learnerMap.nodes.length > 0 ? (
								<div className="h-[320px] overflow-hidden rounded-lg border border-slate-200">
									<ReactFlow
										nodes={detail.data.learnerMap.nodes.map(
											(node): FlowNode => ({
												id: node.id,
												position: node.position,
												data: { label: node.label },
											}),
										)}
										edges={detail.data.learnerMap.edges.map(
											(edge): FlowEdge => ({ id: edge.id, source: edge.source, target: edge.target }),
										)}
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
							) : (
								<p className="text-sm text-slate-500">Peta belum tersimpan.</p>
							)}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
