import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import { Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Spinner, Textarea } from "@/components/ui";
import { splitParagraphs } from "@/server/lib/segmentation";

interface Material {
	id: string;
	title: string;
	content: string;
}

export function MaterialsPage() {
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");

	const materials = useQuery({ queryKey: ["materials"], queryFn: () => api.get<Material[]>("/materials") });

	const create = useMutation({
		mutationFn: () => api.post<Material>("/materials", { title, content }),
		onSuccess: () => {
			setTitle("");
			setContent("");
			void queryClient.invalidateQueries({ queryKey: ["materials"] });
		},
	});

	const remove = useMutation({
		mutationFn: (id: string) => api.del(`/materials/${id}`),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["materials"] }),
	});

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
			<div className="space-y-4">
				<h1 className="text-xl font-bold">Materi Pembelajaran</h1>
				{materials.isPending ? <Spinner /> : null}
				{materials.data && materials.data.length === 0 ? (
					<EmptyState title="Belum ada materi" description="Buat materi di panel kanan. Paragraf dipisahkan dengan satu baris kosong." />
				) : null}
				{materials.data?.map((material) => (
					<Card key={material.id}>
						<CardHeader
							title={material.title}
							description={`${splitParagraphs(material.content).length} paragraf`}
							action={
								<Button variant="outline" onClick={() => remove.mutate(material.id)}>
									<Trash2 className="size-4" />
								</Button>
							}
						/>
						<CardBody className="space-y-3">
							{splitParagraphs(material.content).map((paragraph, index) => (
								<p key={index} className="text-sm leading-relaxed text-slate-700">
									<span className="mr-2 inline-flex min-w-5 justify-center rounded bg-slate-100 px-1 text-xs font-semibold text-slate-500">
										{index + 1}
									</span>
									{paragraph}
								</p>
							))}
						</CardBody>
					</Card>
				))}
			</div>

			<Card className="h-fit lg:sticky lg:top-6">
				<CardHeader title="Tambah Materi" description="Pisahkan paragraf dengan baris kosong." />
				<CardBody className="space-y-3">
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate();
						}}
					>
						<Field label="Judul">
							<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fotosintesis pada Tumbuhan" />
						</Field>
						<Field label="Isi materi">
							<Textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								rows={10}
								placeholder={"Paragraf satu...\n\nParagraf dua..."}
							/>
						</Field>
						<Button type="submit" className="w-full" disabled={create.isPending || !title || !content}>
							<Plus className="size-4" />
							Simpan Materi
						</Button>
					</form>
				</CardBody>
			</Card>
		</div>
	);
}
