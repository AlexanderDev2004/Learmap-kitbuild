import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/learnmap.db";

export const client = createClient({ url: DATABASE_URL });
export const db = drizzle(client, { schema });

export type Database = typeof db;
