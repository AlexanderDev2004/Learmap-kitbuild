import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import type { DiagnosisResult, SegmentModel } from "@/shared/types";
import { api } from "@/lib/api";
import { DiagnosisVisual, type VisualLearnerMap } from "@/components/diagnosis-visual";
import { Badge, Button, Spinner } from "@/components/ui";

interface DetailState {
	participationId: string;
	segmentModel: SegmentModel;
	phase: string;
	pretestScore: number | null;
	posttestScore: number | null;
	mapScore: number | null;
	diagnosis: DiagnosisResult | null;
	learnerMap: VisualLearnerMap | null;
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
				<div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
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
					<div className="px-5 py-4">
						<DiagnosisVisual diagnosis={detail.data.diagnosis} learnerMap={detail.data.learnerMap} />
					</div>
				) : null}
			</div>
		</div>
	);
}
