import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

/**
 * Minimal Bun global surface. The project does not install bun-types, so only
 * the piece of the Bun API this file uses is declared here.
 */
declare const Bun: {
	serve(options: {
		port: number;
		hostname: string;
		fetch(request: Request): Promise<Response> | Response;
		error(error: unknown): Response;
	}): unknown;
};

interface WorkerHandler {
	fetch(
		request: Request,
		env: Record<string, string | undefined>,
		ctx: { waitUntil(promise: Promise<unknown>): void },
	): Promise<Response>;
}

const clientDir = fileURLToPath(new URL("../dist/client/", import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".webmanifest": "application/manifest+json",
	".map": "application/json",
	".xml": "application/xml",
};

function serveStaticFile(pathname: string): Response | null {
	if (pathname.includes("..")) return null;

	const filePath = join(clientDir, pathname);
	if (!existsSync(filePath)) return null;
	const info = statSync(filePath);
	if (!info.isFile()) return null;

	const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
	const headers = new Headers({ "Content-Type": contentType });
	// Hashed assets are immutable; everything else gets a short cache.
	if (pathname.startsWith("/assets/")) {
		headers.set("Cache-Control", "public, max-age=31536000, immutable");
	} else {
		headers.set("Cache-Control", "public, max-age=3600");
	}

	return new Response(Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream, {
		headers,
	});
}

// The worker bundle replaces `globalThis.process` with a partial shim at
// import time (its `process.arch` is empty), which breaks native modules like
// the libsql binding. Capture the real process first and restore it after the
// bundle has loaded.
const realProcess = globalThis.process;

// @ts-expect-error — `dist/server/index.js` is a generated bundle without type declarations.
const { default: worker } = await import("../dist/server/index.js");
globalThis.process = realProcess;

const handler = worker as unknown as WorkerHandler;

Bun.serve({
	port,
	hostname,
	fetch(request) {
		const url = new URL(request.url);

		// Serve built client assets (the Cloudflare deployment gets these from
		// the platform's asset binding; a self-hosted Bun server has to).
		const staticResponse = serveStaticFile(decodeURIComponent(url.pathname));
		if (staticResponse) return staticResponse;

		// Everything else — SSR pages, server functions, API routes — goes to
		// the app. `env` is only consumed by the cloudflare:workers shim, which
		// reads process.env directly, so the raw environment is passed through.
		return handler.fetch(request, process.env, { waitUntil: () => {} });
	},
	error(error) {
		console.error("Unhandled error:", error);
		return new Response("Internal Server Error", { status: 500 });
	},
});

console.log(`LearnMap listening on http://${hostname}:${port} (client: ${clientDir})`);
