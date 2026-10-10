import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
	addEdge,
	Background,
	Controls,
	Handle,
	Position,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
	useEdgesState,
	useNodesState,
	type Connection,
	type Edge as FlowEdge,
	type Node as FlowNode,
	type NodeProps,
	type NodeTypes,
} from "@xyflow/react";
import { ArrowLeft, LayoutGrid, Save, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { MapEdge, MapNode, Segment } from "@/shared/types";
import { splitParagraphs } from "@/server/lib/segmentation";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Spinner } from "@/components/ui";

interface GoalMap {
	id: string;
	title: string;
	nodes: MapNode[];
	edges: MapEdge[];
	materialId: string | null;
}

interface Material {
	id: string;
	title: string;
	content: string;
}

type EditorNodeData = {
	nodeType: "concept" | "link";
	label: string;
	paragraph?: number;
	highlight?: boolean;
};

function MapNodeCard({ data, selected }: NodeProps<FlowNode<EditorNodeData>>) {
	const nodeData = data as EditorNodeData;
	return (
		<div
			className={`min-w-32 rounded-lg border px-3 py-2 text-center text-sm shadow-sm ${
				nodeData.nodeType === "concept"
					? "border-blue-300 bg-blue-50 text-blue-900"
					: "border-amber-300 bg-amber-50 text-amber-900 italic"
			} ${selected ? "ring-2 ring-blue-500" : ""}`}
		>
			<Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-white !bg-slate-400" />
			{nodeData.highlight ? <span className="absolute -top-2 -left-2 size-3 rounded-full bg-green-500" /> : null}
			<div className="relative font-medium">{nodeData.label}</div>
			{nodeData.nodeType === "concept" ? (
				<div className="mt-0.5 text-[10px] text-slate-500">Paragraf {nodeData.paragraph ?? "?"}</div>
			) : null}
			<Handle type="source" position={Position.Bottom} className="!size-2.5 !border-2 !border-white !bg-slate-400" />
		</div>
	);
}

const nodeTypes: NodeTypes = { mapNode: MapNodeCard };

function GoalMapEditorInner() {
	const { id } = useParams({ from: "/layout/goal-map/$id" });
	const { fitView } = useReactFlow();
	const queryClient = useQueryClient();

	const goalMap = useQuery({ queryKey: ["goal-map", id], queryFn: () => api.get<GoalMap>(`/goal-maps/${id}`) });
	const materials = useQuery({ queryKey: ["materials"], queryFn: () => api.get<Material[]>("/materials") });

	const [title, setTitle] = useState("");
	const [mapNodes, setMapNodes, onNodesChangeBase] = useNodesState<FlowNode<EditorNodeData>>([]);
	const [mapEdges, setMapEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [materialId, setMaterialId] = useState<string | null>(null);
	const [segmentPreview, setSegmentPreview] = useState<{ model: string; segments: Segment[] } | null>(null);

	useEffect(() => {
		if (!goalMap.data) return;
		setTitle(goalMap.data.title);
		setMaterialId(goalMap.data.materialId);
		setMapNodes(
			goalMap.data.nodes.map((node) => ({
				id: node.id,
				type: "mapNode",
				position: node.position,
				data: { nodeType: node.type, label: node.label, paragraph: node.paragraph },
			})),
		);
		setMapEdges(goalMap.data.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })));
	}, [goalMap.data, setMapNodes, setMapEdges]);

	const selected = mapNodes.find((node) => node.id === selectedId) ?? null;

	const save = useMutation({
		mutationFn: () =>
			api.put<GoalMap>(`/goal-maps/${id}`, {
				title,
				nodes: mapNodes.map((node) => {
					const data = node.data as EditorNodeData;
					return {
						id: node.id,
						type: data.nodeType,
						label: data.label,
						position: node.position,
						paragraph: data.nodeType === "concept" ? data.paragraph : undefined,
					};
				}),
				edges: mapEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
				materialId,
			}),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goal-maps"] }),
	});

	function addNode(type: "concept" | "link") {
		const nodeId = `${type === "concept" ? "c" : "l"}-${Date.now()}`;
		const paragraph = type === "concept" ? Math.max(1, ...mapNodes.map((node) => (node.data as EditorNodeData).paragraph ?? 1)) : undefined;
		setMapNodes((current) => [
			...current,
			{
				id: nodeId,
				type: "mapNode",
				position: { x: 120 + Math.random() * 320, y: 120 + Math.random() * 240 },
				data: {
					nodeType: type,
					label: type === "concept" ? "Konsep baru" : "kata penghubung",
					paragraph,
				},
			},
		]);
		setSelectedId(nodeId);
		setSelectedEdgeId(null);
	}

	/** Hapus simpul terpilih beserta semua relasi yang menempel padanya. */
	function deleteSelectedNode() {
		if (!selectedId) return;
		setMapNodes((current) => current.filter((node) => node.id !== selectedId));
		setMapEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
		setSelectedId(null);
	}

	/** Hapus relasi (sisi) yang dipilih di kanvas. */
	function deleteSelectedEdge() {
		if (!selectedEdgeId) return;
		setMapEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
		setSelectedEdgeId(null);
	}

	/** Tata ulang posisi simpul otomatis (kiri→kanan) dengan dagre. */
	async function autoLayout() {
		const dagre = (await import("dagre")).default;
		const graph = new dagre.graphlib.Graph();
		graph.setDefaultEdgeLabel(() => ({}));
		graph.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80 });
		for (const node of mapNodes) graph.setNode(node.id, { width: 160, height: 56 });
		for (const edge of mapEdges) graph.setEdge(edge.source, edge.target);
		dagre.layout(graph);
		setMapNodes((current) =>
			current.map((node) => {
				const position = graph.node(node.id);
				return { ...node, position: { x: position.x - 80, y: position.y - 28 } };
			}),
		);
		window.setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 60);
	}

	function updateSelected(patch: Partial<EditorNodeData>) {
		if (!selectedId) return;
		setMapNodes((current) =>
			current.map((node) => (node.id === selectedId ? { ...node, data: { ...(node.data as EditorNodeData), ...patch } } : node)),
		);
	}

	function handleConnect(connection: Connection) {
		setMapEdges((current) =>
			addEdge({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: connection.source ?? "", target: connection.target ?? "" }, current),
		);
	}

	const material = materials.data?.find((m) => m.id === materialId) ?? null;
	const paragraphCount = useMemo(() => (material ? splitParagraphs(material.content).length : 0), [material]);

	const preview = useMutation({
		mutationFn: async (model: "paragraph" | "depth") => {
			// Pratinjau dijalankan di klien memakai engine segmentasi yang sama.
			const { segmentMap: segment } = await import("@/server/lib/segmentation");
			const graph = {
				nodes: mapNodes.map((node) => {
					const data = node.data as EditorNodeData;
					return {
						id: node.id,
						type: data.nodeType,
						label: data.label,
						position: node.position,
						paragraph: data.nodeType === "concept" ? data.paragraph : undefined,
					} satisfies MapNode;
				}),
				edges: mapEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })) satisfies MapEdge[],
			};
			return { model, segments: segment(graph, model) };
		},
		onSuccess: (result) => setSegmentPreview(result),
	});

	if (goalMap.isPending) return <Spinner />;
	if (goalMap.isError) return <p className="text-red-600">Goal map tidak ditemukan.</p>;

	const nodeById = new Map(mapNodes.map((node) => [node.id, node]));

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-3">
				<a href="/goal-map" className="no-underline text-sm text-slate-500 hover:text-slate-800">
					<span className="flex items-center gap-1">
						<ArrowLeft className="size-4" />
						Kembali
					</span>
				</a>
				<Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md font-semibold" />
				<div className="ml-auto flex items-center gap-2">
					<Button variant="outline" onClick={() => void autoLayout()} title="Tata ulang posisi simpul otomatis">
						<LayoutGrid className="size-4" />
						Auto Layout
					</Button>
					<Button variant="outline" onClick={() => preview.mutate("paragraph")} disabled={preview.isPending}>
						<Wand2 className="size-4" />
						Pratinjau Segmen Paragraf
					</Button>
					<Button variant="outline" onClick={() => preview.mutate("depth")} disabled={preview.isPending}>
						<Wand2 className="size-4" />
						Pratinjau Segmen Depth
					</Button>
					<Button onClick={() => save.mutate()} disabled={save.isPending}>
						<Save className="size-4" />
						{save.isPending ? "Menyimpan..." : "Simpan"}
					</Button>
				</div>
			</div>
			{save.isError ? <p className="text-sm text-red-600">{save.error.message}</p> : null}

			<div className="grid gap-4 lg:grid-cols-[1fr_320px]">
				<Card className="overflow-hidden">
					<div className="h-[560px]">
						<ReactFlow
							nodes={mapNodes}
							edges={mapEdges}
							onNodesChange={onNodesChangeBase}
							onEdgesChange={onEdgesChange}
							onConnect={handleConnect}
							onNodeClick={(_, node) => {
								setSelectedId(node.id);
								setSelectedEdgeId(null);
							}}
							onEdgeClick={(_, edge) => {
								setSelectedEdgeId(edge.id);
								setSelectedId(null);
							}}
							onPaneClick={() => {
								setSelectedId(null);
								setSelectedEdgeId(null);
							}}
							deleteKeyCode={["Backspace", "Delete"]}
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
						<CardHeader title="Tambah Simpul" description="Sambungkan konsep → link → konsep di kanvas." />
						<CardBody className="flex gap-2">
							<Button variant="outline" className="flex-1" onClick={() => addNode("concept")}>
								+ Konsep
							</Button>
							<Button variant="outline" className="flex-1" onClick={() => addNode("link")}>
								+ Link
							</Button>
						</CardBody>
					</Card>

					<Card>
						<CardHeader title="Simpul Terpilih" />
						<CardBody className="space-y-3">
							{selected ? (
								<>
									<Field label="Label">
										<Input
											value={(selected.data as EditorNodeData).label}
											onChange={(e) => updateSelected({ label: e.target.value })}
										/>
									</Field>
									{(selected.data as EditorNodeData).nodeType === "concept" ? (
										<Field label="Paragraf materi" hint="Dipakai segmentasi berbasis paragraf.">
											<Input
												type="number"
												min={1}
												max={paragraphCount || undefined}
												value={(selected.data as EditorNodeData).paragraph ?? ""}
												onChange={(e) =>
													updateSelected({ paragraph: e.target.value ? Number(e.target.value) : undefined })
												}
											/>
										</Field>
									) : null}
									<Button variant="danger" className="w-full" onClick={deleteSelectedNode}>
										<Trash2 className="size-4" />
										Hapus Simpul
									</Button>
								</>
							) : selectedEdgeId ? (
								<>
									<p className="text-sm text-slate-600">Relasi terpilih. Klik kanvas untuk membatalkan.</p>
									<Button variant="danger" className="w-full" onClick={deleteSelectedEdge}>
										<Trash2 className="size-4" />
										Hapus Relasi
									</Button>
								</>
							) : (
								<p className="text-sm text-slate-500">Klik simpul atau relasi di kanvas untuk mengedit / menghapus.</p>
							)}
						</CardBody>
					</Card>

					<Card>
						<CardHeader
							title="Materi Terkait"
							description={material ? `${paragraphCount} paragraf tersedia untuk penandaan.` : undefined}
						/>
						<CardBody>
							<Field label="Sumber materi">
								<select
									className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
									value={materialId ?? ""}
									onChange={(e) => setMaterialId(e.target.value || null)}
								>
									<option value="">— tanpa materi —</option>
									{materials.data?.map((m) => (
										<option key={m.id} value={m.id}>
											{m.title}
										</option>
									))}
								</select>
							</Field>
						</CardBody>
					</Card>
				</div>
			</div>

			{segmentPreview ? (
				<Card>
					<CardHeader
						title={`Pratinjau segmentasi — ${segmentPreview.model === "paragraph" ? "Paragraf" : "Depth Topik"}`}
						description="Urutan penyajian kit pada siswa mengikuti urutan segmen ini."
						action={<Button variant="outline" onClick={() => setSegmentPreview(null)}>Tutup</Button>}
					/>
					<CardBody className="space-y-3">
						{segmentPreview.segments.map((segment) => (
							<div key={segment.index} className="space-y-1 rounded-lg border border-slate-200 p-3">
								<Badge tone="blue">Segmen {segment.index}</Badge>
								<div className="flex flex-wrap gap-1.5 pt-1">
									{segment.nodeIds.map((nodeId) => {
										const node = nodeById.get(nodeId);
										if (!node) return null;
										const data = node.data as EditorNodeData;
										return (
											<span
												key={nodeId}
												className={`rounded border px-2 py-0.5 text-xs ${
													data.nodeType === "concept"
														? "border-blue-200 bg-blue-50 text-blue-900"
														: "border-amber-200 bg-amber-50 text-amber-900 italic"
												}`}
											>
												{data.label}
											</span>
										);
									})}
								</div>
							</div>
						))}
					</CardBody>
				</Card>
			) : null}
		</div>
	);
}

export function GoalMapEditorPage() {
	return (
		<ReactFlowProvider>
			<GoalMapEditorInner />
		</ReactFlowProvider>
	);
}
