import { Hono } from "hono";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { hashPassword } from "@/server/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { authMiddleware, requireRole, type AppEnv } from "./middleware";

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", authMiddleware, requireRole("peneliti"));

const publicUser = {
	id: users.id,
	username: users.username,
	name: users.name,
	role: users.role,
	className: users.className,
	major: users.major,
	status: users.status,
	createdAt: users.createdAt,
};

const createUserInput = z.object({
	name: z.string().min(1),
	username: z.string().min(3),
	password: z.string().min(6),
	role: z.enum(["peneliti", "siswa"]),
	className: z.string().optional(),
	major: z.string().optional(),
});

userRoutes.get("/", async (c) => {
	const role = c.req.query("role");
	const status = c.req.query("status");
	const search = c.req.query("q");
	const className = c.req.query("class");

	const filters: SQL[] = [];
	if (role === "peneliti" || role === "siswa") filters.push(eq(users.role, role));
	if (status === "pending" || status === "active" || status === "rejected") filters.push(eq(users.status, status));
	if (className) filters.push(eq(users.className, className));
	if (search) {
		const pattern = `%${search}%`;
		const match = or(ilike(users.name, pattern), ilike(users.username, pattern));
		if (match) filters.push(match);
	}

	const rows = await db
		.select(publicUser)
		.from(users)
		.where(filters.length > 0 ? and(...filters) : undefined)
		.orderBy(desc(users.createdAt));

	const classes = await db
		.selectDistinct({ className: users.className })
		.from(users)
		.where(eq(users.role, "siswa"));

	return c.json({
		users: rows,
		classes: classes.map((row) => row.className).filter((value): value is string => value != null).sort(),
	});
});

userRoutes.post("/", async (c) => {
	const parsed = createUserInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? "Data user tidak valid" }, 400);
	}
	const { name, username, password, role, className, major } = parsed.data;

	const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
	if (existing[0]) return c.json({ error: "Username sudah digunakan" }, 409);

	const row = {
		id: randomUUID(),
		username,
		name,
		passwordHash: hashPassword(password),
		role,
		className: role === "siswa" ? (className ?? null) : null,
		major: role === "siswa" ? (major ?? null) : null,
		status: "active" as const,
	};
	await db.insert(users).values(row);
	return c.json({ id: row.id, username, name, role, className: row.className, major: row.major, status: row.status }, 201);
});

const updateUserInput = z.object({
	name: z.string().min(1).optional(),
	username: z.string().min(3).optional(),
	password: z.string().min(6).optional(),
	role: z.enum(["peneliti", "siswa"]).optional(),
	className: z.string().nullable().optional(),
	major: z.string().nullable().optional(),
	status: z.enum(["pending", "active", "rejected"]).optional(),
});

userRoutes.put("/:id", async (c) => {
	const parsed = updateUserInput.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Data update tidak valid" }, 400);
	const { id } = c.req.param();
	const data = parsed.data;

	const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
	const target = rows[0];
	if (!target) return c.json({ error: "User tidak ditemukan" }, 404);
	if (target.username === "peneliti" && (data.status === "rejected" || data.role === "siswa")) {
		return c.json({ error: "Akun peneliti utama tidak dapat diturunkan atau ditolak" }, 400);
	}
	if (data.username && data.username !== target.username) {
		const clash = await db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).limit(1);
		if (clash[0]) return c.json({ error: "Username sudah digunakan" }, 409);
	}

	const updated = await db
		.update(users)
		.set({
			name: data.name ?? target.name,
			username: data.username ?? target.username,
			passwordHash: data.password ? hashPassword(data.password) : target.passwordHash,
			role: data.role ?? target.role,
			className: data.className !== undefined ? data.className : target.className,
			major: data.major !== undefined ? data.major : target.major,
			status: data.status ?? target.status,
		})
		.where(eq(users.id, id))
		.returning(publicUser);
	return c.json(updated[0]);
});

/** ACC / tolak pendaftaran. */
userRoutes.post("/:id/approve", async (c) => {
	const { id } = c.req.param();
	const updated = await db
		.update(users)
		.set({ status: "active" })
		.where(and(eq(users.id, id), eq(users.status, "pending")))
		.returning(publicUser);
	if (!updated[0]) return c.json({ error: "User pending tidak ditemukan" }, 404);
	return c.json(updated[0]);
});

userRoutes.post("/:id/reject", async (c) => {
	const { id } = c.req.param();
	const updated = await db
		.update(users)
		.set({ status: "rejected" })
		.where(and(eq(users.id, id), eq(users.status, "pending")))
		.returning(publicUser);
	if (!updated[0]) return c.json({ error: "User pending tidak ditemukan" }, 404);
	return c.json(updated[0]);
});

userRoutes.delete("/:id", async (c) => {
	const { id } = c.req.param();
	const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
	if (!rows[0]) return c.json({ error: "User tidak ditemukan" }, 404);
	if (rows[0].username === "peneliti") return c.json({ error: "Akun peneliti utama tidak dapat dihapus" }, 400);
	await db.delete(users).where(eq(users.id, id));
	return c.json({ ok: true });
});
