import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { Auth } from "@/lib/auth";
import { AppRuntime } from "@/server/app-runtime";

const authHandler = (request: Request) =>
	AppRuntime.runPromise(
		Effect.gen(function* () {
			const auth = yield* Auth;
			const result = yield* Effect.tryPromise(() => auth.handler(request));

			// Better Auth logs internal failures (e.g. the database is
			// unreachable) and returns an empty 5xx response. Give the client a
			// message it can show instead of a bare "Internal Server Error".
			if (result.status >= 500) {
				const body = yield* Effect.promise(() => result.clone().text());
				if (!body) {
					yield* Effect.logError("Auth handler failed with an empty 5xx response", {
						method: request.method,
						url: request.url,
						status: result.status,
					});
					const headers = new Headers(result.headers);
					headers.set("content-type", "application/json");
					return Response.json(
						{ message: "Authentication service temporarily unavailable" },
						{ status: result.status, headers },
					);
				}
			}

			return result;
		}).pipe(
			Effect.catchTag("UnknownException", (exception) =>
				Effect.gen(function* () {
					const errorDetails =
						exception instanceof Error
							? {
									message: exception.message,
									stack: exception.stack,
								}
							: {
									message: String(exception),
								};
					yield* Effect.logError("Auth handler failed", {
						...errorDetails,
						method: request.method,
						url: request.url,
					});
					return Response.json({ message: "Internal Server Error" }, { status: 500 });
				}),
			),
		),
	);

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => authHandler(request),
			POST: ({ request }) => authHandler(request),
		},
	},
});
