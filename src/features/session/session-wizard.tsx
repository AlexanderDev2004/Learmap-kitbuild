import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
	DiagnosisResult,
	LikertItem,
	ParticipationPhase,
	ParticipationTimings,
	SegmentModel,
} from "@/shared/types";
import { LIKERT_SCALE } from "@/shared/types";
import { splitParagraphs } from "@/server/lib/segmentation";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, Spinner } from "@/components/ui";
import { BuildCanvas } from "./build-canvas";

interface ParticipationState {
	id: string;
	phase: ParticipationPhase;
	segmentModel: SegmentModel;
	experiment: {
		id: string;
		title: string;
		description: string | null;
		buildTimeLimitMinutes: number | null;
	};
	materialContent: string | null;
	segments: { index: number; nodeIds: string[]; edgeIds: string[] }[];
	kitNodes: { id: string; type: "concept" | "link"; label: string; paragraph: number | null }[];
	learnerMap: { nodes: { id: string; type: "concept" | "link"; label: string; position: { x: number; y: number } }[]; edges: { id: string; source: string; target: string }[] } | null;
	pretestScore: number | null;
	posttestScore: number | null;
	mapScore: number | null;
	diagnosis: DiagnosisResult | null;
	pretest: { id: string; question: string; options: string[] }[];
	posttest: { id: string; question: string; options: string[] }[];
	questionnaire: LikertItem[];
	timings: ParticipationTimings;
}

const PHASE_LABEL: Record<ParticipationPhase, string> = {
	pretest: "1. Pretest",
	material: "2. Baca Materi",
	build: "3. Bangun Peta Konsep",
	posttest: "4. Posttest",
	questionnaire: "5. Kuesioner",
	completed: "Selesai",
};

const PHASE_STEPS: ParticipationPhase[] = ["pretest", "material", "build", "posttest", "questionnaire"];

function QuizForm({
	questions,
	onSubmit,
	submitLabel,
}: {
	questions: { id: string; question: string; options: string[] }[];
	onSubmit: (answers: Record<string, number>) => void;
	submitLabel: string;
}) {
	const [answers, setAnswers] = useState<Record<string, number>>({});
	const allAnswered = questions.every((question) => answers[question.id] != null);
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (allAnswered) onSubmit(answers);
			}}
		>
			{questions.map((question, index) => (
				<div key={question.id} className="space-y-2">
					<p className="font-medium">
						{index + 1}. {question.question}
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						{question.options.map((option, optionIndex) => (
							<label
								key={optionIndex}
								className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
									answers[question.id] === optionIndex
										? "border-blue-500 bg-blue-50 text-blue-900"
										: "border-slate-200 hover:bg-slate-50"
								}`}
							>
								<input
									type="radio"
									name={question.id}
									className="accent-blue-600"
									checked={answers[question.id] === optionIndex}
									onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
								/>
								{option}
							</label>
						))}
					</div>
				</div>
			))}
			<Button type="submit" disabled={!allAnswered}>
				{submitLabel}
			</Button>
		</form>
	);
}

function MaterialView({ content, onStart }: { content: string; onStart: () => void }) {
	const paragraphs = splitParagraphs(content);
	return (
		<div className="space-y-4">
			{paragraphs.map((paragraph, index) => (
				<p key={index} className="text-[15px] leading-relaxed text-slate-800">
					<span className="mr-2 inline-flex min-w-6 justify-center rounded bg-slate-100 px-1.5 text-xs font-semibold text-slate-500">
						{index + 1}
					</span>
					{paragraph}
				</p>
			))}
			<div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
				Baca materi dengan saksama. Setelah selesai, klik tombol di bawah untuk mulai menyusun peta konsep.
			</div>
			<Button onClick={onStart}>Saya sudah selesai membaca — Mulai Membangun Peta</Button>
		</div>
	);
}

function QuestionnaireForm({ items, onSubmit }: { items: LikertItem[]; onSubmit: (answers: Record<string, number>) => void }) {
	const [answers, setAnswers] = useState<Record<string, number>>({});
	const allAnswered = items.every((item) => answers[item.id] != null);
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (allAnswered) onSubmit(answers);
			}}
		>
			<p className="text-sm text-slate-600">
				Berikan penilaian pada skala berikut: {LIKERT_SCALE.map((scale) => `${scale.value} = ${scale.label}`).join(", ")}.
			</p>
			{items.map((item, index) => (
				<div key={item.id} className="space-y-2">
					<p className="font-medium">
						{index + 1}. {item.statement}
					</p>
					<div className="flex flex-wrap gap-2">
						{LIKERT_SCALE.map((scale) => (
							<label
								key={scale.value}
								className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
									answers[item.id] === scale.value ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 hover:bg-slate-50"
								}`}
							>
								<input
									type="radio"
									name={item.id}
									className="accent-blue-600"
									checked={answers[item.id] === scale.value}
									onChange={() => setAnswers((current) => ({ ...current, [item.id]: scale.value }))}
								/>
								{scale.value} — {scale.label}
							</label>
						))}
					</div>
				</div>
			))}
			<Button type="submit" disabled={!allAnswered}>
				Kirim Kuesioner
			</Button>
		</form>
	);
}

export function SessionWizardPage() {
	const { id } = useParams({ from: "/layout/sesi/$id" });
	const queryClient = useQueryClient();
	const state = useQuery({
		queryKey: ["participation", id],
		queryFn: () => api.get<ParticipationState>(`/participations/${id}`),
	});

	// Catat mulai fase pretest/posttest/questionnaire/material di server, sekali per fase.
	const phaseMarked = useRef<string>("");
	useEffect(() => {
		if (!state.data) return;
		const phase = state.data.phase;
		if (phase === "completed" || phase === "build") return;
		const key = `${phase}:${state.data.timings[phase]?.startedAt ?? ""}`;
		if (phaseMarked.current === key) return;
		if (state.data.timings[phase]?.startedAt) {
			phaseMarked.current = key;
			return;
		}
		phaseMarked.current = key;
		void api.post(`/participations/${id}/phase`, { phase, action: "start" }).catch(() => undefined);
	}, [state.data, id]);

	const answerMutation = useMutation({
		mutationFn: ({ endpoint, answers }: { endpoint: string; answers: Record<string, number> }) =>
			api.post(`/participations/${id}/${endpoint}`, { answers }),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["participation", id] }),
	});

	const startBuild = useMutation({
		mutationFn: () => api.post(`/participations/${id}/build/start`),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["participation", id] }),
	});

	if (state.isPending) return <Spinner />;
	if (state.isError || !state.data) {
		return <p className="text-red-600">Sesi tidak ditemukan.</p>;
	}

	const data = state.data;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="text-lg font-bold">{data.experiment.title}</h1>
				<Badge tone="blue">{data.segmentModel === "paragraph" ? "Kelompok A — Segmen Paragraf" : "Kelompok B — Segmen Depth Topik"}</Badge>
			</div>

			<ol className="flex flex-wrap gap-2 text-xs">
				{PHASE_STEPS.map((phase) => {
					const currentIndex = PHASE_STEPS.indexOf(data.phase);
					const stepIndex = PHASE_STEPS.indexOf(phase);
					const active = data.phase === phase;
					const done = currentIndex > stepIndex || data.phase === "completed";
					return (
						<li
							key={phase}
							className={`rounded-full px-3 py-1 ${
								active ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
							}`}
						>
							{PHASE_LABEL[phase]}
						</li>
					);
				})}
			</ol>

			{data.phase === "pretest" ? (
				<Card>
					<CardHeader title="Pretest" description="Jawab semua soal sebelum melanjutkan." />
					<CardBody>
						<QuizForm
							questions={data.pretest}
							onSubmit={(answers) => answerMutation.mutate({ endpoint: "pretest", answers })}
							submitLabel="Kirim Pretest"
						/>
					</CardBody>
				</Card>
			) : null}

			{data.phase === "material" ? (
				<Card>
					<CardHeader title="Materi Pembelajaran" />
					<CardBody>
						{data.materialContent ? (
							<MaterialView content={data.materialContent} onStart={() => startBuild.mutate()} />
						) : (
							<p className="text-red-600">Materi tidak tersedia. Hubungi peneliti.</p>
						)}
					</CardBody>
				</Card>
			) : null}

			{data.phase === "build" ? (
				<BuildCanvas
					participationId={data.id}
					segmentModel={data.segmentModel}
					segments={data.segments}
					kitNodes={data.kitNodes}
					learnerMap={data.learnerMap}
					timeLimitMinutes={data.experiment.buildTimeLimitMinutes}
					buildStartedAt={data.timings.build?.startedAt}
					onSubmitted={() => void queryClient.invalidateQueries({ queryKey: ["participation", id] })}
				/>
			) : null}

			{data.phase === "posttest" ? (
				<Card>
					<CardHeader
						title="Posttest"
						description={`Map score peta Anda: ${((data.mapScore ?? 0) * 100).toFixed(0)}% (${data.diagnosis?.correct ?? 0} dari ${data.diagnosis?.totalGoalPropositions ?? 0} proposisi benar).`}
					/>
					<CardBody>
						<QuizForm
							questions={data.posttest}
							onSubmit={(answers) => answerMutation.mutate({ endpoint: "posttest", answers })}
							submitLabel="Kirim Posttest"
						/>
					</CardBody>
				</Card>
			) : null}

			{data.phase === "questionnaire" ? (
				<Card>
					<CardHeader title="Kuesioner Persepsi" description="Tidak ada jawaban benar atau salah." />
					<CardBody>
						<QuestionnaireForm
							items={data.questionnaire}
							onSubmit={(answers) => answerMutation.mutate({ endpoint: "questionnaire", answers })}
						/>
					</CardBody>
				</Card>
			) : null}

			{data.phase === "completed" ? (
				<Card>
					<CardBody className="space-y-3 text-center">
						<CheckCircle2 className="mx-auto size-10 text-green-600" />
						<h2 className="text-lg font-semibold">Sesi selesai — terima kasih!</h2>
						<div className="mx-auto grid max-w-md grid-cols-3 gap-4 pt-2">
							<div>
								<p className="text-xs text-slate-500">Pretest</p>
								<p className="text-xl font-bold">{((data.pretestScore ?? 0) * 100).toFixed(0)}%</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Map Score</p>
								<p className="text-xl font-bold">{((data.mapScore ?? 0) * 100).toFixed(0)}%</p>
							</div>
							<div>
								<p className="text-xs text-slate-500">Posttest</p>
								<p className="text-xl font-bold">{((data.posttestScore ?? 0) * 100).toFixed(0)}%</p>
							</div>
						</div>
					</CardBody>
				</Card>
			) : null}
		</div>
	);
}
