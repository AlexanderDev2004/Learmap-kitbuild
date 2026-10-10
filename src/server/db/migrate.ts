import { mkdirSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL ?? "file:./data/learnmap.db";

if (url.startsWith("file:")) {
	const dir = path.dirname(url.slice("file:".length));
	mkdirSync(dir, { recursive: true });
}

const client = createClient({ url });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrasi selesai:", url);
