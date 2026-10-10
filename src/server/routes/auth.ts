import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createSessionToken, verifyPassword, hashPassword } from "@/server/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { authMiddleware, clearSession, issueSession, type AppEnv } from "./middleware";

export const authRoutes = new Hono<AppEnv>();

const loginInput = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

/** Pendaftaran mandiri siswa: akun berstatus pending sampai di-ACC peneliti. */
const registerInput = z.object({
	name: z.string().min(1, "Nama wajib diisi"),
	username: z.string().min(3, "Username minimal 3 karakter"),
	password: z.string().min(6, "Password minimal 6 karakter"),
	className: z.string().min(1, "Kelas wajib diisi"),
	major: z.string().min(1, "Jurusan wajib diisi"),
});

authRoutes.post("/register", async (c) => {
	const parsed = registerInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid" }, 400);
	}
	const { name, username, password, className, major } = parsed.data;

	const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
	if (existing[0]) {
		return c.json({ error: "Username sudah digunakan" }, 409);
	}

	const row = {
		id: crypto.randomUUID(),
		username,
		name,
		passwordHash: hashPassword(password),
		role: "siswa" as const,
		className,
		major,
		status: "pending" as const,
	};
	await db.insert(users).values(row);
	return c.json(
		{
			ok: true,
			message: "Pendaftaran berhasil. Akun Anda menunggu persetujuan peneliti/admin sebelum bisa masuk.",
		},
		201,
	);
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
	if (user.status === "pending") {
		return c.json({ error: "Akun Anda masih menunggu persetujuan peneliti/admin" }, 403);
	}
	if (user.status === "rejected") {
		return c.json({ error: "Akun Anda tidak disetujui. Hubungi peneliti/admin." }, 403);
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
