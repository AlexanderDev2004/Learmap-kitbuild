/**
 * Seed data contoh untuk LearnMap.
 * Akun: peneliti/peneliti123, siswa1..siswa3/siswa123.
 */
import { randomUUID } from "node:crypto";

import type { LikertItem, MapEdge, MapNode, McqQuestion } from "@/shared/types";
import { db } from "@/server/db/client";
import { experiments, goalMaps, materials, users } from "@/server/db/schema";
import { hashPassword } from "@/server/lib/auth";

// ---------- Users ----------

const penelitiId = randomUUID();
const siswaIds = [1, 2, 3].map(() => randomUUID());

await db
	.insert(users)
	.values([
		{
			id: penelitiId,
			username: "peneliti",
			name: "Peneliti LearnMap",
			passwordHash: hashPassword("peneliti123"),
			role: "peneliti",
		},
		...siswaIds.map((id, i) => ({
			id,
			username: `siswa${i + 1}`,
			name: `Siswa Contoh ${i + 1}`,
			passwordHash: hashPassword("siswa123"),
			role: "siswa" as const,
		})),
	])
	.onConflictDoNothing();

// ---------- Materi ----------

const materialId = randomUUID();
await db.insert(materials).values({
	id: materialId,
	title: "Fotosintesis pada Tumbuhan",
	createdBy: penelitiId,
	content: [
		"Fotosintesis adalah proses pembuatan makanan pada tumbuhan hijau dengan bantuan cahaya matahari. Proses ini terjadi pada organel bernama kloroplas yang banyak ditemukan pada daun. Fotosintesis menjadi sumber energi utama bagi hampir seluruh kehidupan di bumi.",
		"Untuk menjalankan fotosintesis, tumbuhan membutuhkan beberapa bahan. Bahan pertama adalah cahaya matahari yang menjadi sumber energi. Bahan kedua adalah air yang diserap akar dari dalam tanah. Bahan ketiga adalah karbon dioksida yang masuk melalui stomata pada daun.",
		"Selain bahan, fotosintesis juga membutuhkan zat hijau daun bernama klorofil. Klorofil berperan menangkap energi cahaya dan mengubahnya menjadi energi kimia. Tumbuhan yang tidak memiliki klorofil, seperti jamur, tidak dapat melakukan fotosintesis.",
		"Hasil utama fotosintesis adalah glukosa, yaitu gula sederhana sebagai cadangan makanan tumbuhan. Proses ini juga menghasilkan oksigen yang dilepaskan ke udara dan digunakan makhluk hidup lain untuk bernapas. Dengan demikian, fotosintesis menjaga keseimbangan kadar oksigen dan karbon dioksida di atmosfer.",
	].join("\n\n"),
});

// ---------- Goal Map ----------

function concept(id: string, label: string, paragraph: number, x: number, y: number): MapNode {
	return { id, type: "concept", label, position: { x, y }, paragraph };
}
function linkNode(id: string, label: string, x: number, y: number): MapNode {
	return { id, type: "link", label, position: { x, y } };
}
function edge(id: string, source: string, target: string): MapEdge {
	return { id, source, target };
}

const nodes: MapNode[] = [
	concept("c-foto", "Fotosintesis", 1, 400, 60),
	concept("c-cloroplas", "Kloroplas", 1, 720, 60),
	concept("c-cahaya", "Cahaya Matahari", 2, 120, 200),
	concept("c-air", "Air", 2, 360, 200),
	concept("c-co2", "Karbon Dioksida", 2, 620, 220),
	concept("c-klorofil", "Klorofil", 3, 120, 380),
	concept("c-ekimia", "Energi Kimia", 3, 380, 380),
	concept("c-glukosa", "Glukosa", 4, 400, 540),
	concept("c-oksigen", "Oksigen", 4, 680, 500),
	linkNode("l-mensyaratkan", "mensyaratkan", 540, 150),
	linkNode("l-membutuhkan", "membutuhkan", 240, 120),
	linkNode("l-berperan", "berperan membentuk", 200, 300),
	linkNode("l-mengubah", "mengubah", 260, 470),
	linkNode("l-menghasilkan", "menghasilkan", 560, 300),
	linkNode("l-melepaskan", "melepaskan", 680, 360),
];

const edges: MapEdge[] = [
	// C1 -> link -> C2 (link di antara konsep sumber dan tujuan)
	edge("e1", "c-foto", "l-mensyaratkan"),
	edge("e2", "l-mensyaratkan", "c-cloroplas"),
	edge("e3", "c-foto", "l-membutuhkan"),
	edge("e4", "l-membutuhkan", "c-cahaya"),
	edge("e5", "l-membutuhkan", "c-air"),
	edge("e5b", "l-membutuhkan", "c-co2"),
	edge("e6", "c-foto", "l-berperan"),
	edge("e7", "l-berperan", "c-klorofil"),
	edge("e8", "c-klorofil", "l-mengubah"),
	edge("e9", "l-mengubah", "c-ekimia"),
	edge("e10", "c-foto", "l-menghasilkan"),
	edge("e11", "l-menghasilkan", "c-glukosa"),
	edge("e12", "c-foto", "l-melepaskan"),
	edge("e13", "l-melepaskan", "c-oksigen"),
].filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);

const goalMapId = randomUUID();
await db.insert(goalMaps).values({
	id: goalMapId,
	title: "Peta Konsep Fotosintesis",
	nodes,
	edges,
	materialId,
	createdBy: penelitiId,
});

// ---------- Eksperimen ----------

function mcq(id: string, question: string, options: string[], answerIndex: number): McqQuestion {
	return { id, question, options, answerIndex };
}

const pretest: McqQuestion[] = [
	mcq("p1", "Di manakah proses fotosintesis terjadi?", ["Mitokondria", "Kloroplas", "Inti sel", "Ribosom"], 1),
	mcq("p2", "Bahan berikut dibutuhkan untuk fotosintesis, KECUALI:", ["Cahaya matahari", "Air", "Oksigen", "Karbon dioksida"], 2),
	mcq("p3", "Zat hijau daun yang menangkap energi cahaya disebut:", ["Kutikula", "Klorofil", "Stomata", "Xilem"], 1),
];

const posttest: McqQuestion[] = [
	mcq("q1", "Hasil utama fotosintesis yang berfungsi sebagai cadangan makanan adalah:", ["Oksigen", "Glukosa", "Protein", "Karbon dioksida"], 1),
	mcq("q2", "Gas yang dilepaskan tumbuhan saat fotosintesis adalah:", ["Nitrogen", "Karbon dioksida", "Oksigen", "Helium"], 2),
	mcq("q3", "Tumbuhan tidak dapat berfotosintesis jika tidak memiliki:", ["Klorofil", "Bunga", "Buah", "Kambium"], 0),
	mcq("q4", "Air untuk fotosintesis diserap oleh tumbuhan melalui:", ["Daun", "Stomata", "Akar", "Batang"], 2),
];

const questionnaire: LikertItem[] = [
	{ id: "k1", statement: "Peta konsep yang disajikan bertahap membantu saya memahami materi." },
	{ id: "k2", statement: "Saya tidak merasa kewalahan saat menyusun peta konsep." },
	{ id: "k3", statement: "Pembagian bagian peta konsep sesuai dengan cara saya belajar." },
	{ id: "k4", statement: "Saya dapat menghubungkan antarbagian peta konsep dengan mudah." },
	{ id: "k5", statement: "Secara keseluruhan, saya nyaman menggunakan aplikasi ini." },
];

await db.insert(experiments).values({
	id: randomUUID(),
	title: "Eksperimen Segmentasi Peta Konsep — Fotosintesis",
	description:
		"Membandingkan segmentasi berbasis paragraf vs berbasis kedalaman topik pada Kit-Build Concept Map. Tidak menggunakan Sub-Map Scoring maupun analisis urutan pengerjaan.",
	goalMapId,
	pretest,
	posttest,
	questionnaire,
	buildTimeLimitMinutes: 20,
	createdBy: penelitiId,
});

console.log("Seed selesai.");
console.log("Akun peneliti: peneliti / peneliti123");
console.log("Akun siswa: siswa1..siswa3 / siswa123");
process.exit(0);
