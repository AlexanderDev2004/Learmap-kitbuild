import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { LikertItem, McqQuestion } from "@/shared/types";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Spinner, Textarea } from "@/components/ui";

interface ExperimentRow {
	id: string;
	title: string;
	description: string | null;
	goalMapTitle: string;
	buildTimeLimitMinutes: number | null;
}

interface GoalMap {
	id: string;
	title: string;
}

function parseQuestions(raw: string): McqQuestion[] {
	const questions: McqQuestion[] = [];
	for (const line of raw.split("\n").map((line) => line.trim()).filter(Boolean)) {
		// Format: pertanyaan | opsiA | opsiB | opsiC | opsiD | kunci(huruf)
		const parts = line.split("|").map((part) => part.trim());
		const [question, ...rest] = parts;
		const answerLetter = rest.pop();
		if (!question || rest.length < 2 || !answerLetter) continue;
		const answerIndex = answerLetter.toUpperCase().charCodeAt(0) - 65;
		if (answerIndex < 0 || answerIndex >= rest.length) continue;
		questions.push({ id: `q${questions.length + 1}`, question, options: rest, answerIndex });
	}
	return questions;
}

function parseLikert(raw: string): LikertItem[] {
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((statement, index) => ({ id: `k${index + 1}`, statement }));
}

export function ExperimentsPage() {
	const queryClient = useQueryClient();
	const experiments = useQuery({ queryKey: ["experiments"], queryFn: () => api.get<ExperimentRow[]>("/experiments") });
	const goalMaps = useQuery({ queryKey: ["goal-maps"], queryFn: () => api.get<GoalMap[]>("/goal-maps") });

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [goalMapId, setGoalMapId] = useState("");
	const [buildTimeLimit, setBuildTimeLimit] = useState("20");
	const [pretestRaw, setPretestRaw] = useState("");
	const [posttestRaw, setPosttestRaw] = useState("");
	const [questionnaireRaw, setQuestionnaireRaw] = useState(
		"Peta konsep bertahap membantu saya memahami materi.\nSaya tidak merasa kewalahan saat menyusun peta konsep.",
	);
	const [error, setError] = useState<string | null>(null);

	const create = useMutation({
		mutationFn: () => {
			const pretest = parseQuestions(pretestRaw);
			const posttest = parseQuestions(posttestRaw);
			const questionnaire = parseLikert(questionnaireRaw);
			if (pretest.length === 0 || posttest.length === 0 || questionnaire.length === 0) {
				throw new Error("Soal/kuesioner tidak valid. Format soal: pertanyaan | opsiA | opsiB | ... | kunci");
			}
			return api.post("/experiments", {
				title,
				description: description || undefined,
				goalMapId,
				pretest,
				posttest,
				questionnaire,
				buildTimeLimitMinutes: buildTimeLimit ? Number(buildTimeLimit) : null,
			});
		},
		onSuccess: () => {
			setTitle("");
			setDescription("");
			setPretestRaw("");
			setPosttestRaw("");
			setError(null);
			void queryClient.invalidateQueries({ queryKey: ["experiments"] });
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => api.del(`/experiments/${id}`),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["experiments"] }),
	});

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_420px]">
			<div className="space-y-4">
				<h1 className="text-xl font-bold">Eksperimen</h1>
				{experiments.isPending ? <Spinner /> : null}
				{experiments.data && experiments.data.length === 0 ? (
					<EmptyState title="Belum ada eksperimen" description="Buat eksperimen untuk menguji dua model segmentasi." />
				) : null}
				{experiments.data?.map((experiment) => (
					<Card key={experiment.id}>
						<CardHeader
							title={
								<a href={`/eksperimen/${experiment.id}`} className="no-underline hover:text-blue-600">
									{experiment.title}
								</a>
							}
							description={experiment.description ?? undefined}
							action={
								<Button variant="outline" onClick={() => remove.mutate(experiment.id)}>
									<Trash2 className="size-4" />
								</Button>
							}
						/>
						<CardBody className="flex flex-wrap items-center gap-2">
							<Badge tone="blue">{experiment.goalMapTitle}</Badge>
							{experiment.buildTimeLimitMinutes ? <Badge>{experiment.buildTimeLimitMinutes} menit</Badge> : <Badge>Tanpa batas waktu</Badge>}
							<a href={`/eksperimen/${experiment.id}`} className="ml-auto text-sm font-medium text-blue-600 hover:underline">
								Lihat hasil
							</a>
						</CardBody>
					</Card>
				))}
			</div>

			<Card className="h-fit lg:sticky lg:top-6">
				<CardHeader title="Buat Eksperimen" description="Peta dibagi otomatis: segmen paragraf (kelompok A) dan depth topik (kelompok B)." />
				<CardBody>
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate();
						}}
					>
						<Field label="Judul">
							<Input value={title} onChange={(e) => setTitle(e.target.value)} />
						</Field>
						<Field label="Deskripsi">
							<Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
						</Field>
						<Field label="Goal map">
							<select
								className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
								value={goalMapId}
								onChange={(e) => setGoalMapId(e.target.value)}
							>
								<option value="">— pilih goal map —</option>
								{goalMaps.data?.map((goalMap) => (
									<option key={goalMap.id} value={goalMap.id}>
										{goalMap.title}
									</option>
								))}
							</select>
						</Field>
						<Field label="Batas waktu membangun (menit)" hint="Kosongkan untuk tanpa batas.">
							<Input type="number" min={1} value={buildTimeLimit} onChange={(e) => setBuildTimeLimit(e.target.value)} />
						</Field>
						<Field
							label="Soal pretest"
							hint="Satu soal per baris: pertanyaan | opsiA | opsiB | ... | kunci (huruf)"
						>
							<Textarea value={pretestRaw} onChange={(e) => setPretestRaw(e.target.value)} rows={4} />
						</Field>
						<Field label="Soal posttest">
							<Textarea value={posttestRaw} onChange={(e) => setPosttestRaw(e.target.value)} rows={4} />
						</Field>
						<Field label="Kuesioner persepsi" hint="Satu pernyataan per baris, skala Likert 1–5.">
							<Textarea value={questionnaireRaw} onChange={(e) => setQuestionnaireRaw(e.target.value)} rows={3} />
						</Field>
						{error ? <p className="text-sm text-red-600">{error}</p> : null}
						<Button type="submit" className="w-full" disabled={create.isPending || !title || !goalMapId}>
							<Plus className="size-4" />
							Simpan Eksperimen
						</Button>
					</form>
				</CardBody>
			</Card>
		</div>
	);
}
