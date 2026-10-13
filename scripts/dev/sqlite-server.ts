/**
 * Minimal LibSQL "sqld"-compatible HTTP server for local development.
 *
 * `vp dev` runs the app's SSR in workerd, where the web build of
 * `@libsql/client` can only talk LibSQL's Hrana-over-HTTP protocol
 * (`http:`/`https:`) — it cannot open `file:` SQLite databases, and the
 * official `sqld` binary is not published for Windows. This server speaks
 * the same wire protocol (Hrana v2 JSON, `POST /v2/pipeline`) against a
 * local SQLite file through the native `libsql` binding, so the dev server
 * can use a plain SQLite file with no Docker and no Turso account.
 *
 * The wire format was derived from `@libsql/hrana-client` 0.10.x
 * (http/stream.js + encoding/json), which is what the app's libsql client
 * actually sends for `http://` URLs.
 *
 * Start it (in a separate terminal) before `vp dev` / `db:seed`:
 *   pnpm run db:server
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";

// `libsql` is a CJS package with `export =`; createRequire avoids needing
// esModuleInterop just for this dev script. pnpm resolves it at runtime from
// its virtual store, but tsc cannot, so type it structurally instead of via
// `typeof import("libsql")`.
interface LibsqlStatement {
	reader: boolean;
	columns(): { name: string; type?: string | null }[];
	all(...args: unknown[]): unknown[];
	run(...args: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint | null };
}

interface LibsqlDatabase {
	prepare(sql: string): LibsqlStatement;
	exec(sql: string): void;
	pragma(sql: string): unknown;
	close(): void;
}

const require = createRequire(import.meta.url);
const DatabaseLibsql = require("libsql") as new (
	path: string,
	options?: { fileMustExist?: boolean },
) => LibsqlDatabase;

const DB_PATH = (() => {
	const fromArg = process.argv[2];
	if (fromArg) return fromArg;
	const fromEnv = process.env.TURSO_DATABASE_URL;
	if (fromEnv?.startsWith("file:")) return fromEnv.slice("file:".length);
	return "learnmap-local.db";
})();

const PORT = Number(process.env.SQLD_LITE_PORT ?? 8080);

// ---------------------------------------------------------------------------
// Value encoding (Hrana JSON <-> SQLite JS values)
// ---------------------------------------------------------------------------

type HranaValue =
	| { type: "null" }
	| { type: "integer"; value: string }
	| { type: "float"; value: number }
	| { type: "text"; value: string }
	| { type: "blob"; base64: string };

function decodeValue(v: unknown): unknown {
	if (v === null || v === undefined) return null;
	const { type, value, base64 } = v as { type: string; value?: unknown; base64?: string };
	if (type === "null") return null;
	if (type === "integer") return BigInt(String(value));
	if (type === "float") return Number(value);
	if (type === "text") return String(value);
	if (type === "blob") return Buffer.from(String(base64), "base64");
	throw new Error(`Unsupported Hrana value type: ${String(type)}`);
}

function encodeValue(v: unknown): HranaValue {
	if (v === null || v === undefined) return { type: "null" };
	if (typeof v === "bigint") return { type: "integer", value: v.toString() };
	if (typeof v === "number") {
		return Number.isInteger(v)
			? { type: "integer", value: String(v) }
			: { type: "float", value: v };
	}
	if (typeof v === "string") return { type: "text", value: v };
	if (v instanceof Uint8Array) return { type: "blob", base64: Buffer.from(v).toString("base64") };
	throw new Error(`Unsupported SQLite value: ${String(v)}`);
}

// ---------------------------------------------------------------------------
// Baton state: one SQLite connection per Hrana stream, plus stored SQL texts
// ---------------------------------------------------------------------------

interface Baton {
	db: InstanceType<typeof DatabaseLibsql>;
	sqls: Map<number, string>;
	lastUsed: number;
}

const batons = new Map<string, Baton>();

function openBaton(id: string): Baton {
	const db = new DatabaseLibsql(DB_PATH);
	db.pragma("journal_mode = WAL");
	db.pragma("busy_timeout = 5000");
	const baton: Baton = { db, sqls: new Map(), lastUsed: Date.now() };
	batons.set(id, baton);
	return baton;
}

function getBaton(id: string | undefined): { id: string; baton: Baton } {
	if (id && batons.has(id)) {
		const baton = batons.get(id) as Baton;
		baton.lastUsed = Date.now();
		return { id, baton };
	}
	// Reuse the client-provided id when given, otherwise mint one.
	const newId =
		id ?? `baton-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return { id: newId, baton: openBaton(newId) };
}

function destroyBaton(id: string): void {
	const baton = batons.get(id);
	if (baton) {
		try {
			baton.db.close();
		} catch {
			// already closed — nothing to do
		}
		batons.delete(id);
	}
}

// Reap idle batons so long-lived dev servers don't leak connections.
const BATON_IDLE_MS = 10 * 60 * 1000;
const BATON_MAX = 200;
setInterval(() => {
	const now = Date.now();
	for (const [id, baton] of batons) {
		if (now - baton.lastUsed > BATON_IDLE_MS) destroyBaton(id);
	}
	while (batons.size > BATON_MAX) {
		let oldestId: string | undefined;
		let oldest = Number.POSITIVE_INFINITY;
		for (const [id, baton] of batons) {
			if (baton.lastUsed < oldest) {
				oldest = baton.lastUsed;
				oldestId = id;
			}
		}
		if (!oldestId) break;
		destroyBaton(oldestId);
	}
}, 60_000).unref();

// ---------------------------------------------------------------------------
// Statement execution
// ---------------------------------------------------------------------------

interface HranaStmt {
	sql?: string;
	sql_id?: number;
	args?: unknown[];
	named_args?: { name: string; value: unknown }[];
	want_rows?: boolean;
}

interface StmtResult {
	cols: { name?: string; decltype?: string }[];
	rows: HranaValue[][];
	affected_row_count: number;
	last_insert_rowid?: string;
}

// better-sqlite3-style bindings forbid transaction control through prepared
// statements, so route BEGIN/COMMIT/ROLLBACK through exec(). PRAGMA is left
// on the normal prepare path so row-returning pragmas (e.g. `PRAGMA
// user_version`) report their rows like sqld does.
const TX_RE = /^\s*(BEGIN|COMMIT|ROLLBACK|END)\b/i;

function resolveSql(baton: Baton, stmt: HranaStmt): string {
	if (typeof stmt.sql === "string") return stmt.sql;
	if (stmt.sql_id !== undefined) {
		const stored = baton.sqls.get(stmt.sql_id);
		if (stored === undefined) throw new Error(`Unknown sql_id: ${stmt.sql_id}`);
		return stored;
	}
	throw new Error("Statement has neither sql nor sql_id");
}

function bindArgs(stmt: HranaStmt): unknown[] | Record<string, unknown> {
	const named = stmt.named_args ?? [];
	if (named.length > 0) {
		const obj: Record<string, unknown> = {};
		for (const arg of named) obj[arg.name] = decodeValue(arg.value);
		return obj;
	}
	return (stmt.args ?? []).map(decodeValue);
}

function stmtCols(prepared: LibsqlStatement): StmtResult["cols"] {
	return prepared.columns().map((c) => ({ name: c.name, decltype: c.type ?? undefined }));
}

function runStmt(baton: Baton, stmt: HranaStmt): StmtResult {
	const sql = resolveSql(baton, stmt);

	if (TX_RE.test(sql)) {
		baton.db.exec(sql);
		return { cols: [], rows: [], affected_row_count: 0 };
	}

	const params = bindArgs(stmt);

	let prepared: ReturnType<InstanceType<typeof DatabaseLibsql>["prepare"]>;
	try {
		prepared = baton.db.prepare(sql);
	} catch (error) {
		// Some pragmas cannot be prepared; run them through db.pragma().
		if (/^\s*pragma\b/i.test(sql)) {
			baton.db.pragma(sql.replace(/^\s*pragma\s+/i, "").replace(/\s*;\s*$/, ""));
			return { cols: [], rows: [], affected_row_count: 0 };
		}
		throw error;
	}

	const cols = stmtCols(prepared);

	if (prepared.reader) {
		const rows = (
			prepared.all(...(Array.isArray(params) ? params : [params])) as unknown[]
		).map((row) => {
			const record = row as Record<string, unknown>;
			return cols.map((c) => encodeValue(record[c.name ?? ""]));
		});
		return { cols, rows, affected_row_count: 0 };
	}

	const info = prepared.run(...(Array.isArray(params) ? params : [params]));
	const result: StmtResult = { cols, rows: [], affected_row_count: Number(info.changes) };
	if (info.lastInsertRowid !== undefined && info.lastInsertRowid !== null) {
		result.last_insert_rowid = String(info.lastInsertRowid);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Pipeline request handling
// ---------------------------------------------------------------------------

type BatchCond =
	| { type: "ok" | "error"; step: number }
	| { type: "not"; cond: BatchCond }
	| { type: "and" | "or"; conds: BatchCond[] }
	| { type: "is_autocommit" };

interface BatchStep {
	condition?: BatchCond;
	stmt: HranaStmt;
}

function evalCond(cond: BatchCond, stepOk: (i: number) => boolean | undefined): boolean {
	switch (cond.type) {
		case "ok":
			return stepOk(cond.step) === true;
		case "error":
			return stepOk(cond.step) === false;
		case "not":
			return !evalCond(cond.cond, stepOk);
		case "and":
			return cond.conds.every((c) => evalCond(c, stepOk));
		case "or":
			return cond.conds.some((c) => evalCond(c, stepOk));
		case "is_autocommit":
			// Only used by protocol v3 clients; v2 never sends it.
			return false;
	}
}

type PipelineRequest =
	| { type: "execute"; stmt: HranaStmt }
	| { type: "batch"; batch: { steps: BatchStep[] } }
	| { type: "sequence"; sql: string; sql_id?: number }
	| { type: "store_sql"; sql_id: number; sql: string }
	| { type: "close_sql"; sql_id: number }
	| { type: "describe"; sql?: string; sql_id?: number }
	| { type: "close" };

interface PipelineResult {
	type: "ok" | "error";
	response?: Record<string, unknown>;
	error?: { message: string; code?: string };
}

function handleRequest(baton: Baton, req: PipelineRequest): PipelineResult {
	switch (req.type) {
		case "execute": {
			return { type: "ok", response: { type: "execute", result: runStmt(baton, req.stmt) } };
		}
		case "sequence": {
			const sql =
				typeof req.sql === "string" ? req.sql : resolveSql(baton, { sql_id: req.sql_id });
			baton.db.exec(sql);
			return { type: "ok", response: { type: "sequence" } };
		}
		case "batch": {
			const stepResults: (StmtResult | null)[] = [];
			const stepErrors: ({ message: string; code?: string } | null)[] = [];
			const outcome = new Map<number, boolean>();
			req.batch.steps.forEach((step, i) => {
				const shouldRun =
					step.condition === undefined || evalCond(step.condition, (j) => outcome.get(j));
				if (!shouldRun) {
					stepResults.push(null);
					stepErrors.push(null);
					return;
				}
				try {
					// Batch step results are plain StmtResult objects — unlike
					// pipeline "execute" responses they are NOT wrapped in
					// {type:"execute", result} (see hrana-client BatchResult decoder).
					stepResults.push(runStmt(baton, step.stmt));
					stepErrors.push(null);
					outcome.set(i, true);
				} catch (error) {
					const err = error as { message?: string; code?: string };
					stepResults.push(null);
					stepErrors.push({
						message: err.message ?? String(error),
						code: err.code ?? "SQLITE_ERROR",
					});
					outcome.set(i, false);
				}
			});
			return {
				type: "ok",
				response: {
					type: "batch",
					result: { step_results: stepResults, step_errors: stepErrors },
				},
			};
		}
		case "store_sql": {
			baton.sqls.set(req.sql_id, req.sql);
			return { type: "ok", response: { type: "store_sql" } };
		}
		case "close_sql": {
			baton.sqls.delete(req.sql_id);
			return { type: "ok", response: { type: "close_sql" } };
		}
		case "describe": {
			const sql = resolveSql(baton, req);
			const prepared = baton.db.prepare(sql);
			return {
				type: "ok",
				response: {
					type: "describe",
					result: {
						params: [],
						cols: stmtCols(prepared),
						is_explain: false,
						is_readonly: prepared.reader,
					},
				},
			};
		}
		case "close": {
			return { type: "ok", response: { type: "close" } };
		}
	}
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, { "content-type": "application/json" });
	res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
	let body = "";
	for await (const chunk of req) body += chunk;
	return body;
}

const server = createServer((req, res) => {
	void (async () => {
		const url = req.url ?? "/";
		if (req.method === "GET" && (url === "/" || url === "/v2" || url === "/health")) {
			sendJson(res, 200, { version: "0.24.0-dev (sqlite-server shim)" });
			return;
		}
		if (req.method !== "POST" || !url.endsWith("/pipeline")) {
			sendJson(res, 404, { message: `Not found: ${req.method} ${url}` });
			return;
		}

		let body: { baton?: string; requests?: PipelineRequest[] };
		try {
			body = JSON.parse(await readBody(req));
		} catch {
			sendJson(res, 400, { message: "Invalid JSON body" });
			return;
		}

		const { id, baton } = getBaton(body.baton);
		if (process.env.SQLD_LITE_LOG === "1") {
			console.log(
				`[db:server] pipeline baton=${body.baton ?? "(new)"}: ${(body.requests ?? []).map((r) => r.type).join(",")}`,
			);
		}
		const results: PipelineResult[] = [];
		let clientClosed = false;
		for (const request of body.requests ?? []) {
			try {
				const result = handleRequest(baton, request);
				results.push(result);
				if (request.type === "close") clientClosed = true;
			} catch (error) {
				console.error(
					`[db:server] ${request.type} failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				const err = error as { message?: string; code?: string };
				results.push({
					type: "error",
					error: {
						message: err.message ?? String(error),
						code: err.code ?? "SQLITE_ERROR",
					},
				});
			}
		}

		if (clientClosed) {
			destroyBaton(id);
			sendJson(res, 200, { results });
		} else {
			baton.lastUsed = Date.now();
			sendJson(res, 200, { baton: id, results });
		}
	})().catch((error) => {
		sendJson(res, 500, { message: String(error) });
	});
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`[db:server] LibSQL-compatible server for ${DB_PATH}`);
	console.log(`[db:server] Listening on http://127.0.0.1:${PORT} (Hrana v2 JSON)`);
});
