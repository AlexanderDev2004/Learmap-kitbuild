/**
 * `pnpm run dev` wrapper: guarantees the local LibSQL-compatible DB server is
 * reachable before booting `vp dev`, on both Windows and Linux.
 *
 * Without this, restarting the dev server while the DB shim is down makes
 * every server-side DB call fail (e.g. sign-in reports "Unable to sign in"),
 * because workerd can only reach the database over HTTP — see the header of
 * scripts/dev/sqlite-server.ts.
 *
 * Behaviour:
 * - DATABASE_MODE=remote with a local http(s) TURSO_DATABASE_URL: probe the
 *   endpoint; if nothing listens, start the shim in this process, then run
 *   `vp dev` as a child. The shim dies with this process.
 * - Anything already listening on the endpoint (e.g. a manual
 *   `pnpm run db:server` in another terminal) is reused as-is.
 * - Non-local endpoints (Turso cloud) or other modes: just run `vp dev`.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";

const require = createRequire(import.meta.url);

function localDbEndpoint(): { host: string; port: number } | null {
	if (process.env.DATABASE_MODE !== "remote") return null;
	const url = process.env.TURSO_DATABASE_URL;
	if (!url?.startsWith("http://") && !url?.startsWith("https://")) return null;
	const parsed = new URL(url);
	const host = parsed.hostname;
	if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") return null;
	return { host, port: Number(parsed.port || (url.startsWith("https://") ? 443 : 80)) };
}

function isReachable(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host, port });
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => resolve(false));
	});
}

async function main() {
	const endpoint = localDbEndpoint();
	if (endpoint) {
		if (await isReachable(endpoint.host, endpoint.port)) {
			console.log(
				`[dev] reusing DB server already listening at ${endpoint.host}:${endpoint.port}`,
			);
		} else {
			console.log("[dev] starting local DB server (scripts/dev/sqlite-server.ts)...");
			// The shim starts listening as an import side effect; it shares this
			// process, so it shuts down together with the dev server.
			await import("./sqlite-server.ts");
			for (let i = 0; i < 50 && !(await isReachable(endpoint.host, endpoint.port)); i++) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}
	}

	const vpBin = require.resolve("vite-plus/package.json").replace(/package\.json$/, "bin/vp");
	const child = spawn(process.execPath, [vpBin, "dev", ...process.argv.slice(2)], {
		stdio: "inherit",
	});
	child.on("exit", (code, signal) => {
		process.exit(code ?? (signal ? 1 : 0));
	});
	// If only this process receives the signal (e.g. `kill` on Linux), take the
	// child down too; in an interactive terminal Ctrl+C reaches both anyway.
	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.on(signal, () => {
			child.kill();
			process.exit(0);
		});
	}
}

await main();
