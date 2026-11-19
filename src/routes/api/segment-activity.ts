import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";

import { recordSegmentActivity } from "@/features/learner-map/lib/learner-map-service.mutations";
import { RecordSegmentActivityInput } from "@/features/learner-map/lib/learner-map-service.shared";
import { getServerUser } from "@/lib/auth";
import { AppRuntime } from "@/server/app-runtime";

/**
 * Sink for segment timing sent while the learner is leaving the page.
 *
 * A server-function call is cancelled with the document, so a reload or tab
 * close used to lose the stay in progress. The client hands that last stay to
 * `navigator.sendBeacon` instead, which the browser delivers after the page is
 * gone — and beacons cannot read a response, so this answers with a bare status.
 *
 * The body is untrusted: it goes through the same service as the RPC, which
 * checks assignment membership, rejects segments from another goal map, and
 * clamps the duration.
 */
const handler = async (request: Request) => {
	const user = await AppRuntime.runPromise(getServerUser(request.headers));
	if (!user) return new Response(null, { status: 401 });

	let input: RecordSegmentActivityInput;
	try {
		input = Schema.decodeUnknownSync(RecordSegmentActivityInput)(await request.json());
	} catch {
		return new Response(null, { status: 400 });
	}

	await AppRuntime.runPromise(recordSegmentActivity(user.id, input).pipe(Effect.ignore));

	return new Response(null, { status: 204 });
};

export const Route = createFileRoute("/api/segment-activity")({
	server: {
		handlers: {
			POST: ({ request }) => handler(request),
		},
	},
});
