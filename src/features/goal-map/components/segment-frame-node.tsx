import type { Node, NodeProps } from "@xyflow/react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { memo } from "react";

type SegmentFrameNodeData = {
	label: string;
	color: string;
	onDelete?: () => void;
};

/**
 * Frame drawn behind a map segment's nodes in the goal-map (Kit-Build) editor
 * so teachers and admins can see which nodes belong to which segment. The box
 * can be dragged and resized ("box modeling"); its bounds persist to the
 * segment in the database. The frame itself is not part of the saved map —
 * rename/recolor happens via the Segment dialog.
 */
function SegmentFrameNodeComponent({
	data,
	selected,
}: Partial<NodeProps<Node<SegmentFrameNodeData>>>) {
	const color = data?.color ?? "#64748b";
	return (
		<div
			className="group relative h-full w-full rounded-2xl border-2"
			style={{ borderColor: color, backgroundColor: `${color}10` }}
		>
			{/* React Flow only marks a node draggable once its handles are
				measured (handleBounds). Frames have no real connection points, so
				declare one hidden handle purely to satisfy that measurement; the
				node is not connectable. */}
			<Handle
				type="source"
				position={Position.Top}
				isConnectable={false}
				style={{ visibility: "hidden", left: 0, top: 0, width: 1, height: 1 }}
			/>
			<NodeResizer
				isVisible={!!selected}
				minWidth={160}
				minHeight={100}
				lineStyle={{ borderColor: color }}
				handleStyle={{
					backgroundColor: color,
					width: 8,
					height: 8,
					border: "none",
					borderRadius: 9999,
				}}
			/>
			{selected && data?.onDelete && (
				<button
					type="button"
					aria-label="Hapus segmen"
					title="Hapus segmen"
					className="absolute top-1 right-1 z-10 flex size-6 items-center justify-center rounded-md bg-background/80 text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						// Keep React Flow from treating the click as a node
						// selection/drag gesture.
						event.stopPropagation();
						data.onDelete?.();
					}}
				>
					<Trash2 className="size-3.5" />
				</button>
			)}
			<div className="px-2 pt-1">
				<span
					className="block truncate text-xs font-semibold select-none"
					style={{ color }}
					title={data?.label}
				>
					{data?.label ?? "Segmen"}
				</span>
			</div>
		</div>
	);
}

export const SegmentFrameNode = memo(SegmentFrameNodeComponent);
