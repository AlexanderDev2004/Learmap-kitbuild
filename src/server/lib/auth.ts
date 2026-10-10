import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { Role } from "@/shared/types";

const SECRET = process.env.LearnMap_SECRET ?? "learnmap-dev-secret";

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 64).toString("hex");
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) return false;
	const candidate = scryptSync(password, salt, 64);
	const expected = Buffer.from(hash, "hex");
	return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSessionToken(userId: string): string {
	const payload = Buffer.from(JSON.stringify({ userId })).toString("base64url");
	const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
	return `${payload}.${signature}`;
}

export function readSessionToken(token: string | undefined): string | null {
	if (!token) return null;
	const [payload, signature] = token.split(".");
	if (!payload || !signature) return null;
	const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
	if (signature.length !== expected.length) return null;
	if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
	try {
		const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId?: string };
		return parsed.userId ?? null;
	} catch {
		return null;
	}
}

export type SessionUser = {
	id: string;
	username: string;
	name: string;
	role: Role;
};
