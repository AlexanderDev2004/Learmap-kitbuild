import type { RecordSegmentActivityInput } from "./learner-map-service.shared";

const ENDPOINT = "/api/segment-activity";

/**
 * Reports a segment stay without waiting for a response.
 *
 * Reloading, closing the tab, or navigating away discards the document, and a
 * server-function call in flight is cancelled with it — the stay in progress is
 * lost. `sendBeacon` (or a keepalive `fetch`) is handed to the browser instead,
 * which delivers the request after the page is gone.
 *
 * Returns false when the browser refused to queue it, so the caller can fall
 * back to the regular RPC while the page is still alive.
 */
export function sendSegmentActivityBeacon(payload: RecordSegmentActivityInput): boolean {
	if (typeof window === "undefined") return false;
	const body = JSON.stringify(payload);

	// A Blob with a JSON type keeps the request a plain same-origin POST instead
	// of the text/plain a bare string would send.
	if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
		return true;
	}

	try {
		void fetch(ENDPOINT, {
			method: "POST",
			body,
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			keepalive: true,
		}).catch(() => {});
		return true;
	} catch {
		return false;
	}
}
