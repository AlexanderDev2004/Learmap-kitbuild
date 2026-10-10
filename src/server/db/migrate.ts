import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../../..");

function resolveDatabaseUrl(raw: string): string {
	if (!raw.startsWith("file:") || raw.startsWith("file:/")) return raw;
	return `file:${path.resolve(projectRoot, raw.slice("file:".length))}`;
}

const url = resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./data/learnmap.db");

if (url.startsWith("file:")) {
	const dir = path.dirname(url.slice("file:".length));
	mkdirSync(dir, { recursive: true });
}

const client = createClient({ url });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrasi selesai:", url);
