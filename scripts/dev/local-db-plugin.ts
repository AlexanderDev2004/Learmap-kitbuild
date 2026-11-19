/**
 * Vite plugin: make sure the local LibSQL-compatible HTTP server is running
 * whenever the dev server starts.
 *
 * `vp dev` runs the app's SSR inside workerd, which can only reach LibSQL over
 * HTTP (`http:`/`https:`), never a `file:` SQLite database. When the local
 * server (`scripts/dev/sqlite-server.ts`, port 8080 by default) is not
 * listening, every auth query fails and Better Auth answers sign-in with an
 * opaque empty 500 — which is easy to mistake for a bug in the login form.
 *
 * This plugin probes `TURSO_DATABASE_URL`; if it points at a local HTTP
 * endpoint that is not listening, it starts the shim as a child process.
 * Endpoints that are already listening (e.g. a manual `pnpm db:server` or a
 * Docker sqld) are reused as-is, and remote Turso URLs are left alone.
 *
 * Environment values are read the same way the worker sees them: `.dev.vars`
 * takes precedence over `.env`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { join } from "node:path";

import { loadEnv, type PluginOption } from "vite-plus";

type Endpoint = { host: string; port: number };

function parseEnvFile(path: string): Record<string, string> {
	if (!existsSync(path)) return {};
	const values: Record<string, string> = {};
	for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const separator = line.indexOf("=");
		if (separator === -1) continue;
		const key = line.slice(0, separator).trim();
		const value = line
			.slice(separator + 1)
			.trim()
			.replace(/^(['"])(.*)\1$/, "$2");
		values[key] = value;
	}
	return values;
}

function localDbEndpoint(url: string | undefined): Endpoint | null {
	if (!url || !/^https?:\/\//.test(url)) return null;
	const parsed = new URL(url);
	const host = parsed.hostname.replace(/^\[|\]$/g, "");
	if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") return null;
	const port = Number(parsed.port || (url.startsWith("https://") ? 443 : 80));
	return { host, port };
}

function isListening(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host, port });
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => resolve(false));
	});
}

/** Path to the `tsx` CLI, so the shim runs with the same resolver as the repo scripts. */
function tsxCliPath(root: string): string {
	const require = createRequire(join(root, "package.json"));
	const packagePath = require.resolve("tsx/package.json");
	const { bin } = JSON.parse(readFileSync(packagePath, "utf8")) as {
		bin: string | Record<string, string>;
	};
	const relative = typeof bin === "string" ? bin : bin.tsx;
	return join(packagePath, "..", relative);
}

const STARTUP_TIMEOUT_MS = 10_000;

export function localDbServer(): PluginOption {
	let child: ChildProcess | undefined;

	return {
		name: "learnmap:local-db-server",
		apply: "serve",
		async configureServer(server) {
			const { logger, mode, root } = server.config;
			// The shim is intentionally left running when the dev server closes:
			// a config reload starts a new server that reuses it, and killing it
			// here would race with that reuse. It exits with the process instead.
			process.once("exit", () => child?.kill());

			const env = {
				...loadEnv(mode, root, ""),
				...parseEnvFile(join(root, ".dev.vars")),
			};
			if ((env.DATABASE_MODE ?? "remote") === "local") return;

			const endpoint = localDbEndpoint(env.TURSO_DATABASE_URL);
			if (!endpoint) return;
			const address = `${endpoint.host}:${endpoint.port}`;

			if (await isListening(endpoint.host, endpoint.port)) {
				logger.info(`[db] reusing local database at ${address}`);
				return;
			}

			logger.info(`[db] starting local database at ${address}...`);
			child = spawn(
				process.execPath,
				[tsxCliPath(root), join(root, "scripts/dev/sqlite-server.ts")],
				{
					cwd: root,
					stdio: "inherit",
					env: { ...process.env, ...env, SQLD_LITE_PORT: String(endpoint.port) },
				},
			);
			child.once("error", (error) => {
				logger.error(`[db] failed to start local database: ${error.message}`);
			});
			child.once("exit", (code) => {
				if (code !== 0 && code !== null) {
					logger.error(`[db] local database exited with code ${code}`);
				}
			});

			const deadline = Date.now() + STARTUP_TIMEOUT_MS;
			while (Date.now() < deadline) {
				if (await isListening(endpoint.host, endpoint.port)) {
					logger.info(`[db] local database ready at ${address}`);
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			logger.error(
				`[db] local database did not start at ${address}. ` +
					"Run `pnpm db:server` in another terminal and check its output.",
			);
		},
	};
}
