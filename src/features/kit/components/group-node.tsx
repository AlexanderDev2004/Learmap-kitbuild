import { type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";

import { SEGMENT_COLOR_PALETTE } from "@/features/goal-map/lib/map-segment-service";
import { cn } from "@/lib/utils";

import { useNodeContext } from "../lib/node-context";

type GroupNodeData = {
	label: string;
	color: string;
};

/**
 * Blueprint-style group container: a named, colored box that wraps concept
 * nodes so they can be moved, renamed, and recolored together. The label is
 * renamed with a double click; the palette dots change the group color.
 */
function GroupNodeComponent({ id, data, selected }: Partial<NodeProps<Node<GroupNodeData>>>) {
	const { onUpdateNodeData } = useNodeContext();
	const [renaming, setRenaming] = useState(false);
	const [draftLabel, setDraftLabel] = useState(data?.label ?? "");

	const color = data?.color ?? "#64748b";
	const label = data?.label ?? "Frame";

	const commitRename = () => {
		const trimmed = draftLabel.trim();
		if (trimmed && trimmed !== label && id) {
			onUpdateNodeData?.(id, { label: trimmed });
		}
		setRenaming(false);
	};

	return (
		<div
			className={cn("group h-full w-full rounded-2xl border-2 transition-shadow")}
			style={{
				borderColor: color,
				backgroundColor: `${color}14`,
				boxShadow: selected ? `0 0 0 2px ${color}66` : undefined,
			}}
		>
			<div className="flex items-center gap-1 px-2 pt-1">
				{renaming ? (
					<input
						ref={(el) => {
							el?.focus();
						}}
						className="nodrag w-32 rounded border px-1 py-0.5 text-xs font-semibold outline-none"
						style={{ color }}
						value={draftLabel}
						onChange={(e) => setDraftLabel(e.target.value)}
						onBlur={commitRename}
						onKeyDown={(e) => {
							if (e.key === "Enter") commitRename();
							if (e.key === "Escape") setRenaming(false);
						}}
					/>
				) : (
					<span
						className="nodrag max-w-40 cursor-text truncate text-xs font-semibold select-none"
						style={{ color }}
						title="Double click to rename"
						onDoubleClick={() => {
							setDraftLabel(label);
							setRenaming(true);
						}}
					>
						{label}
					</span>
				)}
				<div className="nodrag ml-auto flex items-center gap-1 rounded px-1 opacity-0 transition-opacity group-hover:opacity-100 has-[:focus]:opacity-100">
					{SEGMENT_COLOR_PALETTE.map((paletteColor) => (
						<button
							key={paletteColor}
							type="button"
							aria-label={`Group color ${paletteColor}`}
							className={cn(
								"size-3 cursor-pointer rounded-full border transition-transform hover:scale-125",
								color.toLowerCase() === paletteColor.toLowerCase() && "scale-125",
							)}
							style={{ backgroundColor: paletteColor }}
							onClick={() => id && onUpdateNodeData?.(id, { color: paletteColor })}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export const GroupNode = memo(GroupNodeComponent);
