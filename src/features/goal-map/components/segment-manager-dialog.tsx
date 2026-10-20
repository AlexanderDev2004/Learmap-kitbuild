import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Node } from "@/features/learner-map/lib/comparator";
import { useRpcMutation, useRpcQuery } from "@/hooks/use-rpc-query";
import { toast } from "@/lib/error-toast";
import { GoalMapRpc } from "@/server/rpc/goal-map";

type SegmentType = "paragraph" | "depth-topic";

interface SegmentManagerDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	goalMapId: string;
	nodes: Node[];
}

/**
 * Teacher/admin dialog to manage goal-map segments (the "Group/Segmen"
 * step of the Kit-Build flow). Paragraph segments are created and filled
 * manually ("Add Segment"); depth-topic segments can be generated
 * automatically from the hierarchy of the map.
 */
export function SegmentManagerDialog({
	isOpen,
	onOpenChange,
	goalMapId,
	nodes,
}: SegmentManagerDialogProps) {
	const queryClient = useQueryClient();
	const { data: segments, isLoading } = useRpcQuery({
		...GoalMapRpc.listSegments({ goalMapId }),
		enabled: isOpen,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: GoalMapRpc.segments() });
	};

	const saveMutation = useRpcMutation(GoalMapRpc.saveSegment(), {
		operation: "save segment",
		showSuccess: true,
		successMessage: "Segment saved",
		onSuccess: () => {
			setEditing(null);
			invalidate();
		},
	});
	const deleteMutation = useRpcMutation(GoalMapRpc.deleteSegment(), {
		operation: "delete segment",
		showSuccess: true,
		successMessage: "Segment deleted",
		onSuccess: invalidate,
	});
	const autoMutation = useRpcMutation(GoalMapRpc.autoSegmentByDepth(), {
		operation: "auto segment by depth",
		showSuccess: true,
		successMessage: "Depth-topic segments generated",
		onSuccess: invalidate,
	});

	const [editing, setEditing] = useState<{
		id: string | null;
		name: string;
		type: SegmentType;
		nodeIds: string[];
	} | null>(null);

	const conceptNodes = nodes.filter((n) => n.type === "text");

	const openNew = () => {
		setEditing({
			id: null,
			name: `Segmen ${(segments?.length ?? 0) + 1}`,
			type: "paragraph",
			nodeIds: [],
		});
	};

	const openEdit = (segment: NonNullable<typeof segments>[number]) => {
		setEditing({
			id: segment.id,
			name: segment.name,
			type: segment.type,
			nodeIds: [...segment.nodeIds],
		});
	};

	const toggleNode = (nodeId: string) => {
		setEditing((prev) => {
			if (!prev) return prev;
			const has = prev.nodeIds.includes(nodeId);
			return {
				...prev,
				nodeIds: has
					? prev.nodeIds.filter((id) => id !== nodeId)
					: [...prev.nodeIds, nodeId],
			};
		});
	};

	const handleSave = () => {
		if (!editing || !editing.name.trim()) {
			toast.error("Nama segmen wajib diisi");
			return;
		}
		if (editing.nodeIds.length === 0) {
			toast.error("Pilih minimal satu konsep untuk segmen ini");
			return;
		}
		saveMutation.mutate({
			goalMapId,
			id: editing.id ?? undefined,
			name: editing.name.trim(),
			type: editing.type,
			orderIndex: editing.id
				? (segments?.find((s) => s.id === editing.id)?.orderIndex ?? 0)
				: (segments?.length ?? 0),
			nodeIds: editing.nodeIds,
		});
	};

	const nodeLabel = (nodeId: string) => {
		const node = nodes.find((n) => n.id === nodeId);
		const label = (node?.data as { label?: string } | undefined)?.label;
		return typeof label === "string" && label ? label : nodeId;
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Manage Segments</DialogTitle>
					<DialogDescription>
						Bagi peta konsep menjadi beberapa segmen. Siswa mengerjakan kit per segmen,
						satu segmen selesai baru lanjut ke segmen berikutnya.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="size-5 animate-spin" />
					</div>
				) : editing ? (
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label className="text-sm font-medium" htmlFor="segment-name">
								Nama segmen
							</label>
							<Input
								id="segment-name"
								value={editing.name}
								onChange={(e) => setEditing({ ...editing, name: e.target.value })}
								placeholder="cth. Segmen 1 — Paragraf 1"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm font-medium">Tipe segmentasi</label>
							<Select
								value={editing.type}
								onValueChange={(value) =>
									setEditing({ ...editing, type: value as SegmentType })
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="paragraph">Paragraf (manual)</SelectItem>
									<SelectItem value="depth-topic">
										Depth-Topic (kedalaman topik)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm font-medium">
								Konsep dalam segmen ({editing.nodeIds.length} dipilih)
							</label>
							<div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
								{conceptNodes.length === 0 && (
									<p className="text-muted-foreground p-2 text-sm">
										Peta belum punya konsep. Tambahkan konsep dulu di editor.
									</p>
								)}
								{conceptNodes.map((node) => {
									const label =
										(node.data as { label?: string }).label ?? node.id;
									const checked = editing.nodeIds.includes(node.id);
									return (
										<label
											key={node.id}
											className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
										>
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggleNode(node.id)}
											/>
											<span className="truncate">{label}</span>
										</label>
									);
								})}
							</div>
						</div>
						<DialogFooter>
							<Button variant="ghost" onClick={() => setEditing(null)}>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={saveMutation.isPending}>
								{saveMutation.isPending && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								Save Segment
							</Button>
						</DialogFooter>
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-2">
							{(segments ?? []).length === 0 && (
								<p className="text-muted-foreground py-4 text-center text-sm">
									Belum ada segmen. Klik "Add Segment" untuk membuat manual, atau
									"Auto Depth-Topic" untuk membagi otomatis berdasarkan kedalaman
									topik.
								</p>
							)}
							{(segments ?? []).map((segment, index) => (
								<div
									key={segment.id}
									className="flex items-center justify-between gap-2 rounded-md border p-3"
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">
												{index + 1}. {segment.name}
											</span>
											<Badge variant="outline" className="shrink-0 text-xs">
												{segment.type === "paragraph"
													? "Paragraf"
													: "Depth-Topic"}
											</Badge>
										</div>
										<p className="text-muted-foreground mt-1 truncate text-xs">
											{segment.nodeIds.length} konsep:{" "}
											{segment.nodeIds.slice(0, 4).map(nodeLabel).join(", ")}
											{segment.nodeIds.length > 4 ? ", …" : ""}
										</p>
									</div>
									<div className="flex shrink-0 gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => openEdit(segment)}
										>
											Edit
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() =>
												deleteMutation.mutate({ id: segment.id })
											}
											disabled={deleteMutation.isPending}
										>
											<Trash2 className="size-4 text-destructive" />
										</Button>
									</div>
								</div>
							))}
						</div>

						<Separator />

						<DialogFooter className="sm:justify-between">
							<Button variant="outline" onClick={openNew}>
								<Plus className="mr-2 size-4" />
								Add Segment
							</Button>
							<Button
								variant="secondary"
								onClick={() => autoMutation.mutate({ goalMapId })}
								disabled={autoMutation.isPending || conceptNodes.length === 0}
								title="Membagi konsep otomatis berdasarkan kedalaman hierarki topik (dari konsep umum ke spesifik). Mengganti segmen Depth-Topic yang ada."
							>
								{autoMutation.isPending ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<Sparkles className="mr-2 size-4" />
								)}
								Auto Depth-Topic
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
