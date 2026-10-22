/**
 * Seed: akun uji untuk eksperimen Dua Model Segmentasi.
 *
 * Membuat 15 akun student yang dibagi ke dua cohort:
 *   - Uji Segmen A — Paragraf     : para01..para08@kitbuild.mail  (8 user)
 *   - Uji Segmen B — Depth-Topic  : depth01..depth07@kitbuild.mail (7 user)
 *
 * Kedua cohort ditambahkan sebagai target assignment
 * "Uji Coba Dua Model Segmen — Paragraf + Depth-Topic" dari
 * scripts/seed/kit-test-dual.ts (assignment-nya harus sudah ada —
 * jalankan kit-test-dual.ts terlebih dulu).
 *
 * Idempotent (aman dijalankan ulang). Run AFTER `db:seed`:
 *   npx tsx --env-file=.env scripts/seed/segment-test-users.ts
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Effect, Layer, Logger } from "effect";

import { Auth } from "@/lib/auth";
import { RateLimiter } from "@/lib/rate-limiter";
import { randomString } from "@/lib/utils";
import { Database, DatabaseLive } from "@/server/db/client";
import { assignments, assignmentTargets } from "@/server/db/schema/app-schema";
import { cohortMembers, cohorts, user } from "@/server/db/schema/auth-schema";

const PASSWORD = "segmen12345";
const ASSIGNMENT_TITLE_PREFIX = "Uji Coba Dua Model Segmen";

const GROUPS = [
	{
		cohortName: "Uji Segmen A — Paragraf",
		prefix: "para",
		count: 8,
	},
	{
		cohortName: "Uji Segmen B — Depth-Topic",
		prefix: "depth",
		count: 7,
	},
] as const;

const program = Effect.gen(function* () {
	const db = yield* Database;
	const auth = yield* Auth;

	const assignment = yield* db
		.select()
		.from(assignments)
		.where(eq(assignments.title, `${ASSIGNMENT_TITLE_PREFIX} — Paragraf + Depth-Topic`))
		.limit(1);
	if (!assignment[0]) {
		return yield* Effect.fail(
			new Error(
				"Assignment 'Uji Coba Dua Model Segmen — Paragraf + Depth-Topic' not found — run scripts/seed/kit-test-dual.ts first",
			),
		);
	}
	const assignmentId = assignment[0].id;

	for (const group of GROUPS) {
		// Cohort ------------------------------------------------------------------
		const existingCohort = yield* db
			.select()
			.from(cohorts)
			.where(eq(cohorts.name, group.cohortName))
			.limit(1);
		let cohortId: string;
		if (existingCohort[0]) {
			cohortId = existingCohort[0].id;
			yield* Effect.log(`  Cohort exists: ${group.cohortName}`);
		} else {
			cohortId = randomString();
			yield* db.insert(cohorts).values({ id: cohortId, name: group.cohortName });
			yield* Effect.log(`  Created cohort: ${group.cohortName}`);
		}

		// Users -------------------------------------------------------------------
		for (let i = 1; i <= group.count; i++) {
			const email = `${group.prefix}${String(i).padStart(2, "0")}@kitbuild.mail`;
			const name = `${group.prefix === "para" ? "Paragraf" : "Depth"} ${String(i).padStart(2, "0")}`;

			const existingUser = yield* db
				.select()
				.from(user)
				.where(eq(user.email, email))
				.limit(1);
			let userId: string;
			if (existingUser[0]) {
				userId = existingUser[0].id;
				if (existingUser[0].deletedAt !== null) {
					yield* db.update(user).set({ deletedAt: null }).where(eq(user.id, userId));
				}
			} else {
				const signup = yield* Effect.tryPromise({
					try: () =>
						auth.api.signUpEmail({
							body: {
								email,
								password: PASSWORD,
								name,
								studyGroup: "experiment",
							},
						}),
					catch: (error) => new Error(`Failed to sign up ${email}: ${String(error)}`),
				});
				if (!signup.user) {
					return yield* Effect.fail(new Error(`Signup returned no user for ${email}`));
				}
				userId = signup.user.id;
				yield* db.update(user).set({ role: "student" }).where(eq(user.id, userId));
				yield* Effect.log(`  Created user: ${email}`);
			}

			// Membership --------------------------------------------------------------
			const membership = yield* db
				.select()
				.from(cohortMembers)
				.where(and(eq(cohortMembers.cohortId, cohortId), eq(cohortMembers.userId, userId)))
				.limit(1);
			if (membership[0]) {
				if (membership[0].deletedAt !== null) {
					yield* db
						.update(cohortMembers)
						.set({ deletedAt: null })
						.where(eq(cohortMembers.id, membership[0].id));
				}
			} else {
				yield* db.insert(cohortMembers).values({
					id: randomString(),
					cohortId,
					userId,
				});
			}
		}

		// Assignment target ---------------------------------------------------------
		const existingTarget = yield* db
			.select()
			.from(assignmentTargets)
			.where(
				and(
					eq(assignmentTargets.assignmentId, assignmentId),
					eq(assignmentTargets.cohortId, cohortId),
					isNull(assignmentTargets.deletedAt),
				),
			)
			.limit(1);
		if (!existingTarget[0]) {
			yield* db.insert(assignmentTargets).values({
				id: randomString(),
				assignmentId,
				cohortId,
				userId: null,
			});
			yield* Effect.log(`  Cohort added as assignment target: ${group.cohortName}`);
		} else {
			yield* Effect.log(`  Cohort already targeted: ${group.cohortName}`);
		}
	}

	const totalTargets = yield* db
		.select({ id: assignmentTargets.id })
		.from(assignmentTargets)
		.where(
			and(
				inArray(assignmentTargets.assignmentId, [assignmentId]),
				isNull(assignmentTargets.deletedAt),
			),
		);
	yield* Effect.log(
		`--- Seed user uji segmentasi selesai (total ${totalTargets.length} target aktif) ---`,
	);
}).pipe(
	Effect.tapError((e) => Effect.log(`Seed gagal: ${String(e)}`)),
	Effect.provide(
		Layer.mergeAll(
			Layer.provideMerge(Auth.Default, DatabaseLive),
			RateLimiter.Default,
			Logger.pretty,
		),
	),
);

void Effect.runPromise(program).catch((e) => {
	console.error(e);
	process.exit(1);
});
