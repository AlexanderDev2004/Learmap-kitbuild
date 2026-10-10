import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { LikertItem, McqQuestion } from "@/shared/types";
import { db } from "@/server/db/client";
import { experiments, goalMaps } from "@/server/db/schema";
import { authMiddleware, requireRole, type AppEnv } from "./middleware";

export const experimentRoutes = new Hono<AppEnv>();
experimentRoutes.use("*", authMiddleware);

const mcqQuestion = z.object({
	id: z.string(),
	question: z.string().min(1),
	options: z.array(z.string().min(1)).min(2),
	answerIndex: z.number().int().min(0),
});

const likertItem = z.object({
	id: z.string(),
	statement: z.string().min(1),
});

const experimentInput = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	goalMapId: z.string().min(1),
	pretest: z.array(mcqQuestion).min(1),
	posttest: z.array(mcqQuestion).min(1),
	questionnaire: z.array(likertItem).min(1),
	buildTimeLimitMinutes: z.number().int().min(1).nullable().optional(),
});

experimentRoutes.get("/", requireRole("peneliti"), async (c) => {
	const rows = await db
		.select({
			id: experiments.id,
			title: experiments.title,
			description: experiments.description,
			goalMapId: experiments.goalMapId,
			goalMapTitle: goalMaps.title,
			buildTimeLimitMinutes: experiments.buildTimeLimitMinutes,
			createdAt: experiments.createdAt,
		})
		.from(experiments)
		.innerJoin(goalMaps, eq(experiments.goalMapId, goalMaps.id))
		.orderBy(desc(experiments.createdAt));
	return c.json(rows);
});

experimentRoutes.post("/", requireRole("peneliti"), async (c) => {
	const parsed = experimentInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Data eksperimen tidak valid" }, 400);
	const user = c.get("user");
	const row = {
		id: randomUUID(),
		title: parsed.data.title,
		description: parsed.data.description ?? null,
		goalMapId: parsed.data.goalMapId,
		pretest: parsed.data.pretest as McqQuestion[],
		posttest: parsed.data.posttest as McqQuestion[],
		questionnaire: parsed.data.questionnaire as LikertItem[],
		buildTimeLimitMinutes: parsed.data.buildTimeLimitMinutes ?? null,
		createdBy: user.id,
	};
	await db.insert(experiments).values(row);
	return c.json(row, 201);
});

experimentRoutes.get("/:id", requireRole("peneliti"), async (c) => {
	const rows = await db.select().from(experiments).where(eq(experiments.id, (c.req.param("id") ?? ""))).limit(1);
	const row = rows[0];
	if (!row) return c.json({ error: "Eksperimen tidak ditemukan" }, 404);
	return c.json({
		...row,
		pretest: row.pretest as McqQuestion[],
		posttest: row.posttest as McqQuestion[],
		questionnaire: row.questionnaire as LikertItem[],
	});
});

experimentRoutes.put("/:id", requireRole("peneliti"), async (c) => {
	const parsed = experimentInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Data eksperimen tidak valid" }, 400);
	const updated = await db
		.update(experiments)
		.set({
			title: parsed.data.title,
			description: parsed.data.description ?? null,
			goalMapId: parsed.data.goalMapId,
			pretest: parsed.data.pretest,
			posttest: parsed.data.posttest,
			questionnaire: parsed.data.questionnaire,
			buildTimeLimitMinutes: parsed.data.buildTimeLimitMinutes ?? null,
		})
		.where(eq(experiments.id, (c.req.param("id") ?? "")))
		.returning();
	if (!updated[0]) return c.json({ error: "Eksperimen tidak ditemukan" }, 404);
	return c.json(updated[0]);
});

experimentRoutes.delete("/:id", requireRole("peneliti"), async (c) => {
	await db.delete(experiments).where(eq(experiments.id, (c.req.param("id") ?? "")));
	return c.json({ ok: true });
});
