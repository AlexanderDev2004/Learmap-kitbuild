import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";

/**
 * Filesystem-backed replacement for the `cloudflare:workers` builtin module.
 *
 * The app reads its R2 bucket binding (`env.MATERIAL_IMAGES`) from this module.
 * Outside of workerd (Docker/Bun deployments) there is no R2, so this shim
 * implements the same surface over a directory on disk, configured with
 * `MATERIAL_UPLOAD_DIR` (default: `./data/uploads`).
 *
 * Only the subset of the R2 API the app actually uses is implemented:
 * - `get(key)` -> R2ObjectBody-like `{ body, writeHttpMetadata }` or `null`
 * - `put(key, data, { httpMetadata })` -> writes the file plus a sidecar JSON
 *   holding the content type (keys are UUIDs, so it cannot be derived from
 *   the filename).
 */

const uploadDir = resolve(process.env.MATERIAL_UPLOAD_DIR ?? "./data/uploads");

/** Resolve a storage key to a safe path inside the upload dir, or null if unsafe. */
function resolveKey(key: string): string | null {
	if (key.length === 0 || key.includes("\\") || key.includes("\0")) return null;
	const resolved = resolve(uploadDir, key);
	if (resolved !== uploadDir && !resolved.startsWith(uploadDir + sep)) return null;
	return resolved;
}

function makeWriteHttpMetadata(contentType: string, contentLength: number, etag: string) {
	return function writeHttpMetadata(headers: Headers): void {
		headers.set("Content-Type", contentType);
		headers.set("Content-Length", String(contentLength));
		headers.set("ETag", etag);
	};
}

async function get(key: string) {
	const filePath = resolveKey(key);
	if (!filePath) return null;

	try {
		const info = await stat(filePath);
		if (!info.isFile()) return null;

		const metaPath = `${filePath}.meta.json`;
		const meta: { contentType?: string } = JSON.parse(await readFile(metaPath, "utf8"));
		const contentType = meta.contentType ?? "application/octet-stream";
		const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;

		return {
			key,
			body: Readable.toWeb(createReadStream(filePath)),
			writeHttpMetadata: makeWriteHttpMetadata(contentType, info.size, etag),
		};
	} catch {
		return null;
	}
}

async function put(
	key: string,
	data: ArrayBuffer,
	options?: { httpMetadata?: { contentType?: string } },
) {
	const filePath = resolveKey(key);
	if (!filePath) throw new Error(`Invalid storage key: ${key}`);

	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, new Uint8Array(data));
	await writeFile(
		`${filePath}.meta.json`,
		JSON.stringify({ contentType: options?.httpMetadata?.contentType }),
	);

	const info = await stat(filePath);
	const contentType = options?.httpMetadata?.contentType ?? "application/octet-stream";
	const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;

	return {
		key,
		size: info.size,
		writeHttpMetadata: makeWriteHttpMetadata(contentType, info.size, etag),
	};
}

export const env = {
	MATERIAL_IMAGES: { get, put },
} as const;

// The `cloudflare:workers` module also exports entrypoint classes. This app
// does not use them, but the Cloudflare plugin's type-generation module
// imports them, so provide minimal stand-ins.
export class WorkerEntrypoint {}
export class DurableObject {}
export class WorkflowEntrypoint {}
