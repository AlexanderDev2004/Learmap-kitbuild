import {
	Background,
	Controls,
	Handle,
	Position,
	ReactFlow,
	addEdge,
	useEdgesState,
	useNodesState,
	type Connection,
	type Edge as FlowEdge,
	type IsValidConnection,
	type Node as FlowNode,
	type NodeProps,
	type NodeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Send, SkipForward } from "lucide-react";

import type { DiagnosisResult, MapGraph, Segment, SegmentModel } from "@/shared/types";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";

export interface KitNode {
	id: string;
	type: "concept" | "link";
	label: string;
	paragraph: number | null;
}

export interface BuildCanvasProps {
	participationId: string;
	segmentModel: SegmentModel;
	segments: Segment[];
	kitNodes: KitNode[];
	learnerMap: MapGraph | null;
	timeLimitMinutes: number | null;
	buildStartedAt: number | undefined;
	onSubmitted: (diagnosis: DiagnosisResult) => void;
}

type EditorNodeData = {
	nodeType: "concept" | "link";
	label: string;
	paragraph: number | null;
};

function KitCard({ data, selected }: NodeProps<FlowNode<EditorNodeData>>) {
	const nodeData = data as EditorNodeData;
	return (
		<div
			className={`min-w-28 rounded-lg border px-3 py-1.5 text-center text-sm shadow-sm ${
				nodeData.nodeType === "concept"
					? "border-blue-300 bg-blue-50 text-blue-900"
					: "border-amber-300 bg-amber-50 text-amber-900 italic"
			} ${selected ? "ring-2 ring-blue-500" : ""}`}
		>
			<Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-white !bg-slate-400" />
			{nodeData.label}
			<Handle type="source" position={Position.Bottom} className="!size-2.5 !border-2 !border-white !bg-slate-400" />
		</div>
	);
}

const nodeTypes: NodeTypes = { kit: KitCard };

/** Shuffle deterministik agar urutan kit stabil antar render. */
function seededRandom(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: T[], seed: number): T[] {
	const random = seededRandom(seed);
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
	}
	return copy;
}

const MODEL_HINT: Record<SegmentModel, string> = {
	paragraph: "Kit disajikan mengikuti urutan paragraf materi.",
	depth: "Kit disajikan dari topik paling umum menuju topik yang lebih spesifik.",
};

export function BuildCanvas({
	participationId,
	segmentModel,
	segments,
	kitNodes,
	learnerMap,
	timeLimitMinutes,
	buildStartedAt,
	onSubmitted,
}: BuildCanvasProps) {
	const [revealed, setRevealed] = useState(1);
	const [remainingMs, setRemainingMs] = useState<number | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Simpul kit yang sudah muncul: segmen 1..revealed, diacak sekali per partisipasi.
	const revealedNodes = useMemo(() => {
		const ids = new Set(
			segments
				.slice(0, revealed)
				.flatMap((segment) => segment.nodeIds),
		);
		const nodes = kitNodes.filter((node) => ids.has(node.id));
		const seed = [...participationId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
		return shuffle(nodes, seed);
	}, [segments, revealed, kitNodes, participationId]);

	const initialNodes = useMemo<FlowNode<EditorNodeData>[]>(
		() =>
			revealedNodes.map((node, index) => ({
				id: node.id,
				type: "kit",
				position: { x: 80 + (index % 5) * 170, y: 60 + Math.floor(index / 5) * 110 },
				data: { nodeType: node.type, label: node.label, paragraph: node.paragraph },
			})),
		// Hanya jalankan sekali saat simpul pertama muncul.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode<EditorNodeData>>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

	useEffect(() => {
		// Saat segmen baru muncul, tambahkan simpulnya di posisi bawah kanvas.
		setNodes((current) => {
			if (current.length > 0) return current;
			return initialNodes;
		});
	}, [initialNodes, setNodes]);

	// Pulihkan draf tersimpan.
	useEffect(() => {
		if (!learnerMap) return;
		setNodes(
			learnerMap.nodes.map((node, index) => ({
				id: node.id,
				type: "kit",
				position: node.position ?? { x: 80 + (index % 5) * 170, y: 60 + Math.floor(index / 5) * 110 },
				data: { nodeType: node.type, label: node.label, paragraph: node.paragraph ?? null },
			})),
		);
		setEdges(learnerMap.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })));
		// Hanya restore sekali saat mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Hitung mundur batas waktu.
	const submitRef = useRef<() => void>(() => {});
	useEffect(() => {
		if (timeLimitMinutes == null || !buildStartedAt) {
			setRemainingMs(null);
			return;
		}
		const deadline = buildStartedAt + timeLimitMinutes * 60_000;
		const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
		tick();
		const interval = window.setInterval(tick, 1000);
		return () => window.clearInterval(interval);
	}, [timeLimitMinutes, buildStartedAt]);

	const save = useCallback(
		(currentNodes: FlowNode<EditorNodeData>[], currentEdges: FlowEdge[]) => {
			void api.post(`/participations/${participationId}/build/save`, {
				nodes: currentNodes.map((node) => {
					const data = node.data as EditorNodeData;
					return {
						id: node.id,
						type: data.nodeType,
						label: data.label,
						position: node.position,
					};
				}),
				edges: currentEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
			}).catch(() => undefined);
		},
		[participationId],
	);

	const submit = useCallback(async () => {
		if (submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			const result = await api.post<{ diagnosis: DiagnosisResult }>(`/participations/${participationId}/build/submit`, {
				nodes: nodes.map((node) => {
					const data = node.data as EditorNodeData;
					return { id: node.id, type: data.nodeType, label: data.label, position: node.position };
				}),
				edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
			});
			onSubmitted(result.diagnosis);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Gagal mengirim peta");
			setSubmitting(false);
		}
	}, [edges, nodes, participationId, onSubmitted, submitting]);
	submitRef.current = () => void submit();

	useEffect(() => {
		if (remainingMs === 0) void submitRef.current();
	}, [remainingMs]);

	function handleConnect(connection: Connection) {
		setEdges((current) =>
			addEdge(
				{ id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: connection.source ?? "", target: connection.target ?? "" },
				current,
			),
		);
	}

	const isValidConnection: IsValidConnection = useCallback(
		(connection) => {
			const source = nodes.find((node) => node.id === connection.source);
			const target = nodes.find((node) => node.id === connection.target);
			if (!source || !target) return false;
			const sourceType = (source.data as EditorNodeData).nodeType;
			const targetType = (target.data as EditorNodeData).nodeType;
			// Proposisi: konsep -> link -> konsep.
			return (sourceType === "concept" && targetType === "link") || (sourceType === "link" && targetType === "concept");
		},
		[nodes],
	);

	const allRevealed = revealed >= segments.length;
	const minutes = remainingMs != null ? Math.floor(remainingMs / 60_000) : null;
	const seconds = remainingMs != null ? Math.floor((remainingMs % 60_000) / 1000) : null;

	return (
		<div className="grid gap-4 lg:grid-cols-[1fr_300px]">
			<Card className="overflow-hidden">
				<div className="h-[540px]">
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={(changes) => {
							onNodesChange(changes);
							if (changes.some((change) => change.type === "position" || change.type === "remove")) {
								const next = nodes
									.map((node) => {
										const change = changes.find((c) => c.type === "position" && c.id === node.id);
										return change && change.type === "position" && change.position ? { ...node, position: change.position } : node;
									})
									.filter((node) => !changes.some((c) => c.type === "remove" && c.id === node.id));
								save(next, edges);
							}
						}}
						onEdgesChange={(changes) => {
							onEdgesChange(changes);
							if (changes.some((change) => change.type === "remove" || change.type === "add")) {
								const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
								const added = changes.filter((c) => c.type === "add");
								let next = edges.filter((edge) => !removed.has(edge.id));
								for (const change of added) if (change.item) next = [...next, change.item as FlowEdge];
								save(nodes, next);
							}
						}}
						onConnect={handleConnect}
						isValidConnection={isValidConnection}
						deleteKeyCode={["Backspace", "Delete"]}
						edgesFocusable
						nodeTypes={nodeTypes}
						fitView
					>
						<Background />
						<Controls />
					</ReactFlow>
				</div>
			</Card>

			<div className="space-y-4">
				<Card>
					<CardHeader title={`Segmen ${revealed} dari ${segments.length}`} description={MODEL_HINT[segmentModel]} />
					<CardBody className="space-y-3">
						<div className="flex flex-wrap gap-1.5">
							{revealedNodes.map((node) => (
								<Badge key={node.id} tone={node.type === "concept" ? "blue" : "amber"}>
									{node.label}
								</Badge>
							))}
						</div>
						{!allRevealed ? (
							<Button
								variant="outline"
								className="w-full"
								onClick={() => {
									setRevealed((current) => current + 1);
									// Simpul baru ditambahkan ke kanvas saat state berubah.
									const nextSegment = segments[revealed];
									if (!nextSegment) return;
									const seed = [...participationId].reduce((sum, char) => sum + char.charCodeAt(0), 0) + revealed;
									const added = shuffle(
										kitNodes.filter((node) => nextSegment.nodeIds.includes(node.id)),
										seed,
									);
									setNodes((current) => [
										...current,
										...added.map((node, index) => ({
											id: node.id,
											type: "kit" as const,
											position: { x: 80 + (index % 5) * 170, y: 460 + Math.floor(index / 5) * 110 },
											data: { nodeType: node.type, label: node.label, paragraph: node.paragraph },
										})),
									]);
								}}
							>
								<SkipForward className="size-4" />
								Kit berikutnya (Segmen {revealed + 1})
							</Button>
						) : (
							<Badge tone="green">Semua segmen sudah tersedia</Badge>
						)}
					</CardBody>
				</Card>

				<Card>
					<CardHeader title="Cara Menyusun" />
					<CardBody className="space-y-2 text-sm text-slate-600">
						<p>Tarik simpul untuk menata posisi. Tarik dari lingkaran tepi simpul untuk membuat relasi.</p>
						<p>
							Relasi yang benar: <span className="font-medium text-blue-700">Konsep → Link → Konsep</span>. Sambungan lain akan ditolak.
						</p>
						<p className="text-xs text-slate-500">
							Hapus relasi: klik relasinya lalu tekan <kbd className="rounded border border-slate-300 px-1">Delete</kbd>.
						</p>
						{remainingMs != null && minutes != null && seconds != null ? (
							<p className={`flex items-center gap-1.5 font-medium ${minutes < 2 ? "text-red-600" : "text-slate-700"}`}>
								<Clock className="size-4" />
								Sisa waktu: {minutes}:{seconds.toString().padStart(2, "0")}
							</p>
						) : null}
						{error ? <p className="text-sm text-red-600">{error}</p> : null}
						<Button className="w-full" onClick={() => void submit()} disabled={submitting}>
							<Send className="size-4" />
							{submitting ? "Mengirim..." : "Kirim Peta"}
						</Button>
					</CardBody>
				</Card>
			</div>
		</div>
	);
}
