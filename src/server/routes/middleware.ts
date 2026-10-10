import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, Next } from "hono";

import { readSessionToken } from "@/server/lib/auth";
import type { SessionUser } from "@/server/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";

export const SESSION_COOKIE = "learnmap_session";

export type AppEnv = {
	Variables: { user: SessionUser };
};

export async function getSessionUser(userId: string | null): Promise<SessionUser | null> {
	if (!userId) return null;
	const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	const user = rows[0];
	if (!user) return null;
	return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
	const cookieValue = getCookie(c, SESSION_COOKIE);
	const user = await getSessionUser(readSessionToken(cookieValue));
	if (!user) {
		return c.json({ error: "Belum masuk" }, 401);
	}
	c.set("user", user);
	await next();
}

export function requireRole(role: "peneliti" | "siswa") {
	return async (c: Context<AppEnv>, next: Next) => {
		const user = c.get("user");
		if (!user || user.role !== role) {
			return c.json({ error: "Akses ditolak" }, 403);
		}
		await next();
	};
}

export function issueSession(c: Context<AppEnv>, token: string) {
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 7,
	});
}

export function clearSession(c: Context<AppEnv>) {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
