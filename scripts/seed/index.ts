import { Effect, Layer, Logger } from "effect";

import { Auth } from "@/lib/auth";
import { RateLimiter } from "@/lib/rate-limiter";
import { DatabaseLive } from "@/server/db/client";

import { seedRantaiMakanan } from "./rantai-makanan.js";
import { seedUsers } from "./seeders/index.js";

/**
 * Main database seed (`pnpm run db:seed`):
 *   1. Base accounts (admins, teachers, demo students)
 *   2. The "Rantai Makanan" dual-model experiment kit — the same dataset used
 *      on production: goal map + kit + 8 segments (P1-P4 Paragraf, D1-D4
 *      Depth-Topic) with frames, Pre/Post/Delayed-Test forms, perception and
 *      TAM questionnaires, and the assignment wiring them together.
 */
const program = Effect.gen(function* () {
	yield* Effect.log("Seeding database...");

	yield* seedUsers();
	yield* seedRantaiMakanan();

	yield* Effect.log(
		"--- Seed completed ---\n" +
			"Demo credentials:\n" +
			"  Admin: admin@kitbuild.mail / admin12345\n" +
			"  Admin: bagas@kitbuild.mail / bagas12345\n" +
			"  Admin: citra@kitbuild.mail / citra12345\n" +
			"  Teacher: banni@kitbuild.mail / banni12345\n" +
			"  Teacher: helmy@kitbuild.mail / helmy12345\n" +
			"  Teacher: alex@kitbuild.mail / alex12345\n" +
			"  Student: tanaka@kitbuild.mail / demo12345\n" +
			"  Student: sari@kitbuild.mail / demo12345\n" +
			"  Student: rudi@kitbuild.mail / demo12345\n" +
			"Created:\n" +
			"  - Goal map Rantai Makanan + kit + 8 segments (4 Paragraf, 4 Depth-Topic) with frames\n" +
			"  - Forms: Pre-Test, Post-Test, Delayed Test, Kuesioner Persepsi, TAM\n" +
			"  - Assignment: Uji Coba Dua Model Segmen - Rantai Makanan\n",
	);
}).pipe(
	Effect.provide(
		Layer.mergeAll(
			Layer.provideMerge(Auth.Default, DatabaseLive),
			RateLimiter.Default,
			Logger.pretty,
		),
	),
);

void Effect.runPromise(program);
