import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { MapEdge, MapNode } from "@/shared/types";
import { db } from "@/server/db/client";
import { goalMaps, materials } from "@/server/db/schema";
import { authMiddleware, requireRole, type AppEnv } from "./middleware";

export const catalogRoutes = new Hono<AppEnv>();
catalogRoutes.use("*", authMiddleware);

// ---------- Materi ----------

const materialInput = z.object({
	title: z.string().min(1),
	content: z.string().min(1),
});

catalogRoutes.get("/materials", requireRole("peneliti"), async (c) => {
	const rows = await db.select().from(materials).orderBy(desc(materials.createdAt));
	return c.json(rows);
});

catalogRoutes.post("/materials", requireRole("peneliti"), async (c) => {
	const parsed = materialInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Judul dan isi materi wajib diisi" }, 400);
	const user = c.get("user");
	const row = {
		id: randomUUID(),
		title: parsed.data.title,
		content: parsed.data.content,
		createdBy: user.id,
	};
	await db.insert(materials).values(row);
	return c.json(row, 201);
});

catalogRoutes.put("/materials/:id", requireRole("peneliti"), async (c) => {
	const parsed = materialInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Judul dan isi materi wajib diisi" }, 400);
	const updated = await db
		.update(materials)
		.set({ title: parsed.data.title, content: parsed.data.content })
		.where(eq(materials.id, (c.req.param("id") ?? "")))
		.returning();
	if (!updated[0]) return c.json({ error: "Materi tidak ditemukan" }, 404);
	return c.json(updated[0]);
});

catalogRoutes.delete("/materials/:id", requireRole("peneliti"), async (c) => {
	await db.delete(materials).where(eq(materials.id, (c.req.param("id") ?? "")));
	return c.json({ ok: true });
});

// ---------- Goal Map ----------

const nodeInput = z.object({
	id: z.string(),
	type: z.enum(["concept", "link"]),
	label: z.string().min(1),
	position: z.object({ x: z.number(), y: z.number() }),
	paragraph: z.number().int().min(1).optional(),
});

const goalMapInput = z.object({
	title: z.string().min(1),
	nodes: z.array(nodeInput).min(1),
	edges: z.array(
		z.object({
			id: z.string(),
			source: z.string(),
			target: z.string(),
		}),
	),
	materialId: z.string().nullable().optional(),
});

function asNodes(value: unknown): MapNode[] {
	return value as MapNode[];
}
function asEdges(value: unknown): MapEdge[] {
	return value as MapEdge[];
}

catalogRoutes.get("/goal-maps", requireRole("peneliti"), async (c) => {
	const rows = await db.select().from(goalMaps).orderBy(desc(goalMaps.createdAt));
	return c.json(rows);
});

catalogRoutes.post("/goal-maps", requireRole("peneliti"), async (c) => {
	const parsed = goalMapInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Data goal map tidak valid" }, 400);
	const user = c.get("user");
	const row = {
		id: randomUUID(),
		title: parsed.data.title,
		nodes: parsed.data.nodes,
		edges: parsed.data.edges,
		materialId: parsed.data.materialId ?? null,
		createdBy: user.id,
	};
	await db.insert(goalMaps).values(row);
	return c.json(row, 201);
});

catalogRoutes.get("/goal-maps/:id", authMiddleware, async (c) => {
	const rows = await db.select().from(goalMaps).where(eq(goalMaps.id, (c.req.param("id") ?? ""))).limit(1);
	if (!rows[0]) return c.json({ error: "Goal map tidak ditemukan" }, 404);
	return c.json({ ...rows[0], nodes: asNodes(rows[0].nodes), edges: asEdges(rows[0].edges) });
});

catalogRoutes.put("/goal-maps/:id", requireRole("peneliti"), async (c) => {
	const parsed = goalMapInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Data goal map tidak valid" }, 400);
	const updated = await db
		.update(goalMaps)
		.set({
			title: parsed.data.title,
			nodes: parsed.data.nodes,
			edges: parsed.data.edges,
			materialId: parsed.data.materialId ?? null,
		})
		.where(eq(goalMaps.id, (c.req.param("id") ?? "")))
		.returning();
	if (!updated[0]) return c.json({ error: "Goal map tidak ditemukan" }, 404);
	return c.json(updated[0]);
});

catalogRoutes.delete("/goal-maps/:id", requireRole("peneliti"), async (c) => {
	await db.delete(goalMaps).where(eq(goalMaps.id, (c.req.param("id") ?? "")));
	return c.json({ ok: true });
});
