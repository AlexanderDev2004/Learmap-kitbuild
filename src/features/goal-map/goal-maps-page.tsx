import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner } from "@/components/ui";
import type { MapEdge, MapNode } from "@/shared/types";

interface GoalMap {
	id: string;
	title: string;
	nodes: MapNode[];
	edges: MapEdge[];
	materialId: string | null;
}

export function GoalMapsPage() {
	const queryClient = useQueryClient();
	const goalMaps = useQuery({ queryKey: ["goal-maps"], queryFn: () => api.get<GoalMap[]>("/goal-maps") });

	const create = useMutation({
		mutationFn: () =>
			api.post<GoalMap>("/goal-maps", {
				title: "Goal Map Baru",
				nodes: [
					{
						id: "c-1",
						type: "concept",
						label: "Konsep Utama",
						position: { x: 240, y: 120 },
						paragraph: 1,
					},
				],
				edges: [],
			}),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goal-maps"] }),
	});

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Goal Map</h1>
				<Button onClick={() => create.mutate()} disabled={create.isPending}>
					<Plus className="size-4" />
					Buat Goal Map
				</Button>
			</div>
			{goalMaps.isPending ? <Spinner /> : null}
			{goalMaps.data && goalMaps.data.length === 0 ? (
				<EmptyState title="Belum ada goal map" description="Buat goal map sebagai acuan diagnosis peta siswa." />
			) : null}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{goalMaps.data?.map((goalMap) => {
					const conceptCount = goalMap.nodes.filter((n) => n.type === "concept").length;
					const linkCount = goalMap.nodes.filter((n) => n.type === "link").length;
					const untagged = goalMap.nodes.filter((n) => n.type === "concept" && n.paragraph == null).length;
					return (
						<Card key={goalMap.id} className="transition-shadow hover:shadow-md">
							<CardHeader
								title={
									<a href={`/goal-map/${goalMap.id}`} className="no-underline hover:text-blue-600">
										{goalMap.title}
									</a>
								}
							/>
							<CardBody className="space-y-2">
								<div className="flex flex-wrap gap-2">
									<Badge>{conceptCount} konsep</Badge>
									<Badge>{linkCount} link</Badge>
									<Badge>{goalMap.edges.length} relasi</Badge>
									{untagged > 0 ? <Badge tone="amber">{untagged} konsep tanpa paragraf</Badge> : null}
								</div>
							</CardBody>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
