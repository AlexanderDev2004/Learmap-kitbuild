import type { DiagnosisResult, MapEdge, MapGraph, MapNode } from "@/shared/types";

/**
 * Comparator peta siswa terhadap goal map (automatic diagnosis KitBuild).
 *
 * Satu proposisi = tripel (konsep sumber, link, konsep tujuan). Kecocokan
 * dilakukan pada label (bukan id), karena siswa menyusun ulang simpul dengan
 * id baru. Yang dihitung hanya kesesuaian proposisi utuh — Sub-Map Scoring
 * (SMS) dan analisis urutan pengerjaan sengaja TIDAK diimplementasikan
 * sesuai batasan penelitian.
 */

interface Proposition {
	sourceId: string;
	linkId: string;
	targetId: string;
}

export function composePropositions(nodes: MapNode[], edges: MapEdge[]): Proposition[] {
	const conceptIds = new Set(nodes.filter((n) => n.type === "concept").map((n) => n.id));
	const linkIds = new Set(nodes.filter((n) => n.type === "link").map((n) => n.id));

	const triples: Proposition[] = [];
	const seen = new Set<string>();
	for (const edge of edges) {
		if (!conceptIds.has(edge.source) || !linkIds.has(edge.target)) continue;
		for (const outEdge of edges) {
			if (outEdge.source !== edge.target) continue;
			if (!conceptIds.has(outEdge.target)) continue;
			const key = `${edge.source}->${edge.target}->${outEdge.target}`;
			if (seen.has(key)) continue;
			seen.add(key);
			triples.push({
				sourceId: edge.source,
				linkId: edge.target,
				targetId: outEdge.target,
			});
		}
	}
	return triples;
}

function labelKey(proposition: Proposition, labels: Map<string, string>): string {
	return [labels.get(proposition.sourceId), labels.get(proposition.linkId), labels.get(proposition.targetId)].join("|");
}

/**
 * Membandingkan peta siswa dengan goal map.
 * Score = proposisi benar / total proposisi goal map (0..1).
 */
export function diagnoseMap(goal: MapGraph, learner: MapGraph): DiagnosisResult {
	const goalPropositions = composePropositions(goal.nodes, goal.edges);
	const learnerPropositions = composePropositions(learner.nodes, learner.edges);

	const goalLabels = new Map(goal.nodes.map((n) => [n.id, n.label]));
	const learnerLabels = new Map(learner.nodes.map((n) => [n.id, n.label]));

	const goalKeys = new Map<string, Proposition>();
	for (const proposition of goalPropositions) goalKeys.set(labelKey(proposition, goalLabels), proposition);
	const learnerKeys = new Set(learnerPropositions.map((p) => labelKey(p, learnerLabels)));

	const correct: string[] = [];
	const missing: string[] = [];
	for (const [key] of goalKeys) {
		if (learnerKeys.has(key)) correct.push(key);
		else missing.push(key);
	}
	const excessive = [...learnerKeys].filter((key) => !goalKeys.has(key));

	const total = goalPropositions.length;
	return {
		correct: correct.length,
		missing: missing.length,
		excessive: excessive.length,
		totalGoalPropositions: total,
		score: total === 0 ? 0 : correct.length / total,
		correctLabels: correct,
		missingLabels: missing,
		excessiveLabels: excessive,
	};
}
