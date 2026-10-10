import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PlayCircle } from "lucide-react";

import type { ParticipationPhase, SegmentModel } from "@/shared/types";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner } from "@/components/ui";

interface AvailableExperiment {
	id: string;
	title: string;
	description: string | null;
	buildTimeLimitMinutes: number | null;
	participationId: string | null;
	phase: ParticipationPhase | null;
	completedAt: string | null;
}

const PHASE_LABEL: Record<ParticipationPhase, string> = {
	pretest: "Pretest",
	material: "Baca Materi",
	build: "Bangun Peta",
	posttest: "Posttest",
	questionnaire: "Kuesioner",
	completed: "Selesai",
};

const MODEL_LABEL: Record<SegmentModel, string> = {
	paragraph: "Segmentasi Paragraf",
	depth: "Segmentasi Depth Topik",
};

export function SessionsPage() {
	const queryClient = useQueryClient();
	const experiments = useQuery({
		queryKey: ["available-experiments"],
		queryFn: () => api.get<AvailableExperiment[]>("/participations/available"),
	});

	const start = useMutation({
		mutationFn: (experimentId: string) => api.post<{ participationId: string }>("/participations", { experimentId }),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["available-experiments"] }),
	});

	if (experiments.isPending) return <Spinner />;

	return (
		<div className="space-y-4">
			<h1 className="text-xl font-bold">Sesi Pembelajaran</h1>
			{experiments.data && experiments.data.length === 0 ? (
				<EmptyState title="Belum ada sesi" description="Sesi akan muncul ketika peneliti menerbitkan eksperimen." />
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				{experiments.data?.map((experiment) => (
					<Card key={experiment.id}>
						<CardHeader title={experiment.title} description={experiment.description ?? undefined} />
						<CardBody className="flex flex-wrap items-center gap-2">
							{experiment.participationId ? (
								<>
									<Badge tone={experiment.phase === "completed" ? "green" : "blue"}>
										{experiment.phase ? PHASE_LABEL[experiment.phase] : "—"}
									</Badge>
									{experiment.phase === "completed" ? (
										<span className="flex items-center gap-1 text-sm text-green-700">
											<CheckCircle2 className="size-4" />
											Selesai
										</span>
									) : null}
									<Button className="ml-auto" onClick={() => window.location.assign(`/sesi/${experiment.participationId}`)}>
										{experiment.phase === "completed" ? "Lihat kembali" : "Lanjutkan"}
									</Button>
								</>
							) : (
								<>
									{experiment.buildTimeLimitMinutes ? <Badge>{experiment.buildTimeLimitMinutes} menit</Badge> : null}
									<Button
										className="ml-auto"
										onClick={() => start.mutate(experiment.id)}
										disabled={start.isPending}
									>
										<PlayCircle className="size-4" />
										Mulai
									</Button>
								</>
							)}
						</CardBody>
					</Card>
				))}
			</div>
			<p className="text-xs text-slate-500">
				Kelompok Anda (segmentasi paragraf atau depth topik) ditetapkan otomatis saat memulai sesi:
				{experiments.data
					?.filter((experiment) => experiment.participationId)
					.map((experiment) => ` ${experiment.title}`)
					.join(",")}
				{" "}
				menggunakan {MODEL_LABEL.paragraph} atau {MODEL_LABEL.depth}.
			</p>
		</div>
	);
}
