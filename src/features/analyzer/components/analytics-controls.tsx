import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import type { VisibilityState } from "@/features/learner-map/lib/visibility";
import { cn } from "@/lib/utils";

function LegendDot({ color }: { color: string }) {
	return <span className="inline-block size-3 rounded-full" style={{ backgroundColor: color }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-0.5">
			{children}
		</div>
	);
}

interface AnalyticsControlsProps {
	visibility: VisibilityState;
	onChange: (updates: Partial<VisibilityState>) => void;
	showDisplayOptions?: boolean;
	segments?: ReadonlyArray<{
		id: string;
		name: string;
		color: string | null;
		type: "paragraph" | "depth-topic";
	}>;
	className?: string;
}

export function AnalyticsControls({
	visibility,
	onChange,
	showDisplayOptions = true,
	segments,
	className,
}: AnalyticsControlsProps) {
	// Per-segment frame list is collapsed by default to keep the panel compact.
	const [segmentListOpen, setSegmentListOpen] = useState(false);
	const [modelSectionOpen, setModelSectionOpen] = useState(false);
	const hiddenCount = visibility.hiddenSegmentIds.length;
	// Model toggles: empty shownModels means both models are visible.
	const bothModelsShown =
		visibility.shownModels.length === 0 || visibility.shownModels.length === 2;
	const modelShown = (model: "paragraph" | "depth-topic") =>
		visibility.shownModels.length === 0 || visibility.shownModels.includes(model);
	const toggleModel = (model: "paragraph" | "depth-topic", shown: boolean) => {
		const next = new Set<"paragraph" | "depth-topic">(
			visibility.shownModels.length === 0
				? ["paragraph", "depth-topic"]
				: visibility.shownModels,
		);
		if (shown) {
			next.add(model);
		} else {
			next.delete(model);
		}
		onChange({ shownModels: [...next] });
	};
	const toggleSegment = (segmentId: string, shown: boolean) => {
		const hidden = new Set(visibility.hiddenSegmentIds);
		if (shown) {
			hidden.delete(segmentId);
		} else {
			hidden.add(segmentId);
		}
		onChange({ hiddenSegmentIds: [...hidden] });
	};

	return (
		<div className={cn("border-b-[0.5px] p-3 space-y-3", className)}>
			<div className="flex items-center justify-between">
				<SectionTitle>Connector Visibility</SectionTitle>
			</div>
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2 text-xs">
					<Switch
						checked={visibility.showGoalMap}
						onCheckedChange={(v) => onChange({ showGoalMap: v })}
					/>
					<span>Goal Map</span>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<Switch
						checked={visibility.showLearnerMap}
						onCheckedChange={(v) => onChange({ showLearnerMap: v })}
					/>
					<span>Learner Map</span>
				</div>
			</div>

			<div className="flex items-center justify-between">
				<SectionTitle>Edge Types</SectionTitle>
			</div>
			<div className="flex items-center gap-4 flex-wrap">
				<div className="flex items-center gap-2 text-xs">
					<Switch
						checked={visibility.showCorrectEdges}
						onCheckedChange={(v) => onChange({ showCorrectEdges: v })}
					/>
					<LegendDot color="var(--edge-correct)" />
					<span>Correct</span>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<Switch
						checked={visibility.showMissingEdges}
						onCheckedChange={(v) => onChange({ showMissingEdges: v })}
					/>
					<LegendDot color="var(--edge-missing)" />
					<span>Missing</span>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<Switch
						checked={visibility.showExcessiveEdges}
						onCheckedChange={(v) => onChange({ showExcessiveEdges: v })}
					/>
					<LegendDot color="var(--edge-excessive)" />
					<span>Excessive</span>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<Switch
						checked={visibility.showNeutralEdges}
						onCheckedChange={(v) => onChange({ showNeutralEdges: v })}
					/>
					<LegendDot color="var(--edge-neutral)" />
					<span>Neutral</span>
				</div>
			</div>

			{showDisplayOptions && (
				<>
					<div className="flex items-center justify-between pt-2 border-t-[0.5px]">
						<SectionTitle>Display Options</SectionTitle>
					</div>
					<div className="flex items-center gap-4 flex-wrap">
						<div className="flex items-center gap-2 text-xs">
							<Switch
								checked={visibility.consolidatedView}
								onCheckedChange={(v) => onChange({ consolidatedView: v })}
							/>
							<span>Consolidated View</span>
						</div>
						<div className="flex items-center gap-2 text-xs">
							<Switch
								checked={visibility.showNamesOnHover}
								onCheckedChange={(v) => onChange({ showNamesOnHover: v })}
							/>
							<span>Show Names on Hover</span>
						</div>
					</div>

					<div className="flex items-center gap-4 flex-wrap">
						<div className="flex items-center gap-2 text-xs">
							<Switch
								checked={visibility.showFrames}
								onCheckedChange={(v) => onChange({ showFrames: v })}
							/>
							<span>Segment Frames</span>
						</div>
					</div>

					{segments && segments.length > 0 && visibility.showFrames && (
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={() => setModelSectionOpen((v) => !v)}
								className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide pl-0.5 cursor-pointer hover:text-foreground transition-colors w-full"
							>
								<ChevronDownIcon
									className={cn(
										"size-3.5 transition-transform",
										!modelSectionOpen && "-rotate-90",
									)}
								/>
								Frame per Model
							</button>
							{modelSectionOpen && (
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-2 text-xs">
										<Switch
											checked={modelShown("paragraph")}
											onCheckedChange={(v) => toggleModel("paragraph", v)}
										/>
										<span className="shrink-0 rounded-full border border-current px-1 text-[10px] font-bold leading-none text-red-600">
											P
										</span>
										<span className="truncate">
											Paragraf (
											{segments.filter((s) => s.type === "paragraph").length})
										</span>
									</div>
									<div className="flex items-center gap-2 text-xs">
										<Switch
											checked={modelShown("depth-topic")}
											onCheckedChange={(v) => toggleModel("depth-topic", v)}
										/>
										<span className="shrink-0 rounded-full border border-current px-1 text-[10px] font-bold leading-none text-blue-600">
											D
										</span>
										<span className="truncate">
											Depth-Topic (
											{
												segments.filter((s) => s.type === "depth-topic")
													.length
											}
											)
										</span>
									</div>
									{!bothModelsShown && (
										<button
											type="button"
											onClick={() => onChange({ shownModels: [] })}
											className="cursor-pointer self-start text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
										>
											Tampilkan semua
										</button>
									)}
								</div>
							)}
						</div>
					)}

					{segments && segments.length > 0 && visibility.showFrames && (
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={() => setSegmentListOpen((v) => !v)}
								className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide pl-0.5 cursor-pointer hover:text-foreground transition-colors w-full"
							>
								<ChevronDownIcon
									className={cn(
										"size-3.5 transition-transform",
										!segmentListOpen && "-rotate-90",
									)}
								/>
								Frames per Segmen
								{hiddenCount > 0 && (
									<span className="ml-auto normal-case tracking-normal text-[10px] bg-muted rounded-full px-1.5 py-0.5">
										{hiddenCount} tersembunyi
									</span>
								)}
							</button>
							{segmentListOpen && (
								<div className="flex flex-col gap-2">
									{segments.map((segment) => {
										const shown = !visibility.hiddenSegmentIds.includes(
											segment.id,
										);
										return (
											<div
												key={segment.id}
												className="flex items-center gap-2 text-xs"
											>
												<Switch
													checked={shown}
													onCheckedChange={(v) =>
														toggleSegment(segment.id, v)
													}
												/>
												<span
													className="inline-block size-3 rounded-full shrink-0"
													style={{
														backgroundColor: segment.color ?? "#64748b",
													}}
												/>
												<span className="truncate">{segment.name}</span>
											</div>
										);
									})}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
