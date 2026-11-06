export interface VisibilityState {
	showGoalMap: boolean;
	showLearnerMap: boolean;
	showCorrectEdges: boolean;
	showMissingEdges: boolean;
	showExcessiveEdges: boolean;
	showNeutralEdges: boolean;
	consolidatedView: boolean;
	showNamesOnHover: boolean;
	// Analyzer segment frames: master switch plus per-segment overrides.
	showFrames: boolean;
	hiddenSegmentIds: string[];
	/** Which segmentation models to show; empty array = show all. */
	shownModels: Array<"paragraph" | "depth-topic">;
}
