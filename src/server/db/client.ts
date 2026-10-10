import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../../..");

function resolveDatabaseUrl(raw: string): string {
	if (!raw.startsWith("file:") || raw.startsWith("file:/")) return raw;
	// Path relatif (file:./x.db) diselesaikan terhadap root project, bukan cwd proses.
	return `file:${path.resolve(projectRoot, raw.slice("file:".length))}`;
}

export const DATABASE_URL = resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./data/learnmap.db");

export const client = createClient({ url: DATABASE_URL });
export const db = drizzle(client, { schema });

export type Database = typeof db;
