import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createSessionToken, verifyPassword } from "@/server/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { authMiddleware, clearSession, getSessionUser, issueSession, type AppEnv } from "./middleware";

export const authRoutes = new Hono<AppEnv>();

const loginInput = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

authRoutes.post("/login", async (c) => {
	const parsed = loginInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Username dan password wajib diisi" }, 400);
	const { username, password } = parsed.data;

	const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
	const user = rows[0];
	if (!user || !verifyPassword(password, user.passwordHash)) {
		return c.json({ error: "Username atau password salah" }, 401);
	}
	issueSession(c, createSessionToken(user.id));
	return c.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});

authRoutes.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

authRoutes.get("/me", authMiddleware, (c) => {
	return c.json(c.get("user"));
});

export { getSessionUser };
