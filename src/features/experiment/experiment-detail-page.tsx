import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { useMemo } from "react";

import type { SegmentModel } from "@/shared/types";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner } from "@/components/ui";

interface ResultRow {
	participationId: string;
	studentName: string;
	segmentModel: SegmentModel;
	phase: string;
	pretestScore: number | null;
	posttestScore: number | null;
	mapScore: number | null;
	correctPropositions: number | null;
	missingPropositions: number | null;
	excessivePropositions: number | null;
	buildDurationMs: number | null;
	totalDurationMs: number | null;
}

function pct(value: number | null): string {
	return value == null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function duration(ms: number | null): string {
	if (ms == null) return "—";
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

const GROUP_LABEL: Record<SegmentModel, string> = {
	paragraph: "A — Segmen Paragraf",
	depth: "B — Segmen Depth Topik",
};

function GroupSummary({ rows, model }: { rows: ResultRow[]; model: SegmentModel }) {
	const group = rows.filter((row) => row.segmentModel === model);
	const mean = (values: (number | null)[]) => {
		const filled = values.filter((value): value is number => value != null);
		if (filled.length === 0) return "—";
		const average = filled.reduce((sum, value) => sum + value, 0) / filled.length;
		return (average * 100).toFixed(0) + "%";
	};
	const meanMs = (values: (number | null)[]) => {
		const filled = values.filter((value): value is number => value != null);
		if (filled.length === 0) return "—";
		return duration(filled.reduce((sum, value) => sum + value, 0) / filled.length);
	};
	return (
		<Card>
			<CardHeader
				title={GROUP_LABEL[model]}
				description={`${group.filter((r) => r.phase === "completed").length} dari ${group.length} partisipan selesai`}
			/>
			<CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<div>
					<p className="text-xs text-slate-500">Pretest</p>
					<p className="text-lg font-semibold">{mean(group.map((r) => r.pretestScore))}</p>
				</div>
				<div>
					<p className="text-xs text-slate-500">Posttest</p>
					<p className="text-lg font-semibold">{mean(group.map((r) => r.posttestScore))}</p>
				</div>
				<div>
					<p className="text-xs text-slate-500">Map Score</p>
					<p className="text-lg font-semibold">{mean(group.map((r) => r.mapScore))}</p>
				</div>
				<div>
					<p className="text-xs text-slate-500">Waktu membangun</p>
					<p className="text-lg font-semibold">{meanMs(group.map((r) => r.buildDurationMs))}</p>
				</div>
				<div>
					<p className="text-xs text-slate-500">Gain (post − pre)</p>
					<GainText group={group} />
				</div>
			</CardBody>
		</Card>
	);
}

function GainText({ group }: { group: ResultRow[] }) {
	const paired = group.filter((row) => row.pretestScore != null && row.posttestScore != null);
	if (paired.length === 0) return <p className="text-lg font-semibold">—</p>;
	const gain = paired.reduce((sum, row) => sum + ((row.posttestScore as number) - (row.pretestScore as number)), 0) / paired.length;
	return <p className="text-lg font-semibold">{(gain * 100).toFixed(0)}%</p>;
}

export function ExperimentDetailPage() {
	const { id } = useParams({ from: "/layout/eksperimen/$id" });
	const results = useQuery({
		queryKey: ["results", id],
		queryFn: () => api.get<ResultRow[]>(`/results?experimentId=${id}`),
	});

	const rows = results.data ?? [];
	const hasData = rows.length > 0;
	const sorted = useMemo(
		() =>
			[...rows].sort((a, b) => (a.segmentModel === b.segmentModel ? a.studentName.localeCompare(b.studentName) : a.segmentModel === "paragraph" ? -1 : 1)),
		[rows],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<a href="/eksperimen" className="text-sm text-slate-500 hover:text-slate-800 no-underline">
						<span className="flex items-center gap-1">
							<ArrowLeft className="size-4" />
							Kembali
						</span>
					</a>
					<h1 className="text-xl font-bold">Hasil Eksperimen</h1>
				</div>
				{hasData ? (
					<a href={`/api/results/export?experimentId=${id}`} className="no-underline">
						<Button variant="outline">
							<Download className="size-4" />
							Ekspor CSV
						</Button>
					</a>
				) : null}
			</div>

			{results.isPending ? <Spinner /> : null}

			{hasData ? (
				<>
					<div className="grid gap-4 lg:grid-cols-2">
						<GroupSummary rows={rows} model="paragraph" />
						<GroupSummary rows={rows} model="depth" />
					</div>

					<Card>
						<CardHeader title="Data per Partisipan" />
						<CardBody className="overflow-x-auto p-0">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-slate-200 text-left text-xs text-slate-500">
										<th className="px-4 py-2">Siswa</th>
										<th className="px-4 py-2">Kelompok</th>
										<th className="px-4 py-2">Fase</th>
										<th className="px-4 py-2">Pretest</th>
										<th className="px-4 py-2">Posttest</th>
										<th className="px-4 py-2">Map Score</th>
										<th className="px-4 py-2" title="Proposisi benar / missing / excessive">
											P (✓ / − / +)
										</th>
										<th className="px-4 py-2">Waktu Build</th>
										<th className="px-4 py-2">Waktu Total</th>
									</tr>
								</thead>
								<tbody>
									{sorted.map((row) => (
										<tr key={row.participationId} className="border-b border-slate-100 last:border-0">
											<td className="px-4 py-2 font-medium">{row.studentName}</td>
											<td className="px-4 py-2">
												<Badge tone={row.segmentModel === "paragraph" ? "blue" : "green"}>
													{row.segmentModel === "paragraph" ? "Paragraf" : "Depth"}
												</Badge>
											</td>
											<td className="px-4 py-2 text-slate-500">{row.phase}</td>
											<td className="px-4 py-2">{pct(row.pretestScore)}</td>
											<td className="px-4 py-2">{pct(row.posttestScore)}</td>
											<td className="px-4 py-2">{pct(row.mapScore)}</td>
											<td className="px-4 py-2 text-slate-500">
												{row.correctPropositions ?? "—"} / {row.missingPropositions ?? "—"} / {row.excessivePropositions ?? "—"}
											</td>
											<td className="px-4 py-2">{duration(row.buildDurationMs)}</td>
											<td className="px-4 py-2">{duration(row.totalDurationMs)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</CardBody>
					</Card>
				</>
			) : (
				<EmptyState
					title="Belum ada partisipan"
					description="Bagikan akun siswa kepada partisipan. Data pretest, posttest, map score, waktu, dan kuesioner akan muncul di sini."
				/>
			)}
		</div>
	);
}
