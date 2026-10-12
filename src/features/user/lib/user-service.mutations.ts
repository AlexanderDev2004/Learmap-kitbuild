import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";

import { Auth } from "@/lib/auth";
import { randomString } from "@/lib/utils";
import { Database } from "@/server/db/client";
import { cohortMembers, cohorts, user } from "@/server/db/schema/auth-schema";

import { getUserById } from "./user-service.queries";
import {
	CannotModifySelfError,
	CohortAlreadyExistsError,
	CohortNotFoundError,
	EmailAlreadyExistsError,
	LastAdminError,
	UserNotFoundError,
	type BanUserInput,
	type BulkCohortAssignInput,
	type CohortIdInput,
	type CreateCohortInput,
	type CreateUserInput,
	type UpdateCohortInput,
	type UpdateRoleInput,
	type UpdateUserInput,
} from "./user-service.shared";

// Create a user account on behalf of someone else. Uses Better Auth's admin
// plugin createUser API so the password is hashed and the account/email tables
// stay consistent. Crucially it does NOT create a session — signUpEmail would
// write a session cookie for the new user via tanstackStartCookies() and
// silently replace the acting admin's session.
export const createUserByAdmin = Effect.fn("createUserByAdmin")(
	(data: CreateUserInput) =>
		Effect.gen(function* () {
			const db = yield* Database;
			const authService = yield* Auth;

			const existing = yield* db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, data.email))
				.limit(1);
			if (existing.length > 0) {
				return yield* new EmailAlreadyExistsError({ email: data.email });
			}

			const result = yield* Effect.tryPromise({
				try: () =>
					authService.api.createUser({
						body: {
							email: data.email,
							password: data.password,
							name: data.name,
							role: data.role,
							...(data.studentId ? { data: { studentId: data.studentId } } : {}),
						},
					}),
				catch: (error) => {
					console.error(`Failed to create user ${data.email}:`, error);
					return new EmailAlreadyExistsError({ email: data.email });
				},
			});

			const userId = result?.user?.id ?? null;
			if (!userId) {
				return yield* new EmailAlreadyExistsError({ email: data.email });
			}
			yield* db.update(user).set({ role: data.role }).where(eq(user.id, userId));
			if (data.studentId) {
				yield* db
					.update(user)
					.set({ studentId: data.studentId })
					.where(eq(user.id, userId));
			}

			return yield* getUserById(userId);
		}),
);

export const updateUser = Effect.fn("updateUser")(
	(_actorId: string, userId: string, data: UpdateUserInput) =>
		Effect.gen(function* () {
			const db = yield* Database;

			const existingRows = yield* db
				.select()
				.from(user)
				.where(and(eq(user.id, userId), isNull(user.deletedAt)))
				.limit(1);

			if (existingRows.length === 0) {
				return yield* new UserNotFoundError({ userId });
			}

			const updateData: Record<string, unknown> = {};

			if (data.name !== undefined) updateData.name = data.name;
			if (data.email !== undefined) updateData.email = data.email;
			if (data.studentId !== undefined) updateData.studentId = data.studentId;
			if (data.age !== undefined) updateData.age = data.age;
			if (data.jlptLevel !== undefined) updateData.jlptLevel = data.jlptLevel;
			if (data.japaneseLearningDuration !== undefined) {
				updateData.japaneseLearningDuration = data.japaneseLearningDuration;
			}
			if (data.previousJapaneseScore !== undefined) {
				updateData.previousJapaneseScore = data.previousJapaneseScore;
			}
			if (data.mediaConsumption !== undefined)
				updateData.mediaConsumption = data.mediaConsumption;
			if (data.motivation !== undefined) updateData.motivation = data.motivation;
			if (data.studyGroup !== undefined) updateData.studyGroup = data.studyGroup;

			if (Object.keys(updateData).length === 0) {
				return yield* getUserById(userId);
			}

			yield* db.update(user).set(updateData).where(eq(user.id, userId));

			return yield* getUserById(userId);
		}),
);

export const updateUserRole = Effect.fn("updateUserRole")(
	(actorId: string, input: UpdateRoleInput) =>
		Effect.gen(function* () {
			const db = yield* Database;

			if (actorId === input.userId) {
				return yield* new CannotModifySelfError({
					message: "Cannot change your own role",
				});
			}

			const existingRows = yield* db
				.select()
				.from(user)
				.where(and(eq(user.id, input.userId), isNull(user.deletedAt)))
				.limit(1);

			const existing = existingRows[0];

			if (!existing) {
				return yield* new UserNotFoundError({ userId: input.userId });
			}

			if (existing.role === "admin" && input.role !== "admin") {
				const countRows = yield* db
					.select({ count: count() })
					.from(user)
					.where(and(eq(user.role, "admin"), isNull(user.deletedAt)));

				const adminCount = countRows[0]?.count ?? 0;

				if (adminCount <= 1) {
					return yield* new LastAdminError({
						message: "Cannot demote the last admin",
					});
				}
			}

			yield* db
				.update(user)
				.set({ role: input.role })
				.where(and(eq(user.id, input.userId), isNull(user.deletedAt)));

			return yield* getUserById(input.userId);
		}),
);

export const banUser = Effect.fn("banUser")((actorId: string, input: BanUserInput) =>
	Effect.gen(function* () {
		const db = yield* Database;

		if (actorId === input.userId) {
			return yield* new CannotModifySelfError({
				message: "Cannot ban yourself",
			});
		}

		const existingRows = yield* db
			.select()
			.from(user)
			.where(and(eq(user.id, input.userId), isNull(user.deletedAt)))
			.limit(1);

		const existing = existingRows[0];

		if (!existing) {
			return yield* new UserNotFoundError({ userId: input.userId });
		}

		if (existing.role === "admin") {
			const countRows = yield* db
				.select({ count: count() })
				.from(user)
				.where(and(eq(user.role, "admin"), isNull(user.deletedAt)));

			const adminCount = countRows[0]?.count ?? 0;

			if (adminCount <= 1) {
				return yield* new LastAdminError({
					message: "Cannot ban the last admin",
				});
			}
		}

		yield* db
			.update(user)
			.set({
				banned: true,
				banReason: input.reason,
				banExpires: input.expiresAt ?? null,
			})
			.where(and(eq(user.id, input.userId), isNull(user.deletedAt)));

		return yield* getUserById(input.userId);
	}),
);

export const unbanUser = Effect.fn("unbanUser")((actorId: string, userId: string) =>
	Effect.gen(function* () {
		const db = yield* Database;

		if (actorId === userId) {
			return yield* new CannotModifySelfError({
				message: "Cannot unban yourself",
			});
		}

		const existingRows = yield* db
			.select()
			.from(user)
			.where(and(eq(user.id, userId), isNull(user.deletedAt)))
			.limit(1);

		if (existingRows.length === 0) {
			return yield* new UserNotFoundError({ userId });
		}

		yield* db
			.update(user)
			.set({
				banned: false,
				banReason: null,
				banExpires: null,
			})
			.where(and(eq(user.id, userId), isNull(user.deletedAt)));

		return yield* getUserById(userId);
	}),
);

export const deleteUser = Effect.fn("deleteUser")((actorId: string, userId: string) =>
	Effect.gen(function* () {
		const db = yield* Database;

		if (actorId === userId) {
			return yield* new CannotModifySelfError({ message: "Cannot delete yourself" });
		}

		const existingRows = yield* db
			.select()
			.from(user)
			.where(and(eq(user.id, userId), isNull(user.deletedAt)))
			.limit(1);

		if (existingRows.length === 0) {
			return yield* new UserNotFoundError({ userId });
		}

		yield* db
			.update(user)
			.set({ deletedAt: new Date() })
			.where(and(eq(user.id, userId), isNull(user.deletedAt)));

		return true;
	}),
);

export const bulkAssignCohort = Effect.fn("bulkAssignCohort")((input: BulkCohortAssignInput) =>
	Effect.gen(function* () {
		const db = yield* Database;

		const { userIds, cohortId, action } = input;

		if (action === "add") {
			const existing = yield* db
				.select({ userId: cohortMembers.userId })
				.from(cohortMembers)
				.where(and(eq(cohortMembers.cohortId, cohortId), isNull(cohortMembers.deletedAt)));

			const existingIds = new Set(existing.map((e) => e.userId));
			const newIds = userIds.filter((id) => !existingIds.has(id));

			if (newIds.length === 0) {
				return { successCount: 0, failedCount: 0 };
			}

			const values = newIds.map((userId) => ({
				id: crypto.randomUUID(),
				cohortId,
				userId,
				role: "member" as const,
			}));

			yield* db.insert(cohortMembers).values(values);

			return { successCount: newIds.length, failedCount: 0 };
		}

		if (action === "remove") {
			yield* db
				.update(cohortMembers)
				.set({ deletedAt: new Date() })
				.where(
					and(
						eq(cohortMembers.cohortId, cohortId),
						inArray(cohortMembers.userId, userIds),
					),
				);

			return { successCount: userIds.length, failedCount: 0 };
		}

		return { successCount: 0, failedCount: 0 };
	}),
);


export const createCohort = Effect.fn("createCohort")(function* (data: CreateCohortInput) {
	const db = yield* Database;

	const existing = yield* db
		.select({ id: cohorts.id })
		.from(cohorts)
		.where(and(sql`lower(${cohorts.name}) = lower(${data.name})`, isNull(cohorts.deletedAt)))
		.limit(1);
	if (existing.length > 0) {
		return yield* new CohortAlreadyExistsError({ name: data.name });
	}

	const cohortId = randomString();
	yield* db.insert(cohorts).values({
		id: cohortId,
		name: data.name,
		description: data.description ?? null,
	});

	return { id: cohortId, name: data.name, description: data.description ?? null };
});

export const updateCohort = Effect.fn("updateCohort")(function* (data: UpdateCohortInput) {
	const db = yield* Database;

	const cohortRows = yield* db
		.select()
		.from(cohorts)
		.where(and(eq(cohorts.id, data.cohortId), isNull(cohorts.deletedAt)))
		.limit(1);
	const cohort = cohortRows[0];
	if (!cohort) {
		return yield* new CohortNotFoundError({ cohortId: data.cohortId });
	}

	const nextName = data.name ?? cohort.name;
	if (data.name !== undefined && data.name !== cohort.name) {
		const duplicate = yield* db
			.select({ id: cohorts.id })
			.from(cohorts)
			.where(and(sql`lower(${cohorts.name}) = lower(${data.name})`, isNull(cohorts.deletedAt)))
			.limit(1);
		if (duplicate.length > 0) {
			return yield* new CohortAlreadyExistsError({ name: data.name });
		}
	}

	yield* db
		.update(cohorts)
		.set({
			name: nextName,
			...(data.description !== undefined && { description: data.description }),
		})
		.where(eq(cohorts.id, data.cohortId));

	return { id: data.cohortId, name: nextName, description: data.description ?? cohort.description };
});

export const deleteCohort = Effect.fn("deleteCohort")(function* (data: CohortIdInput) {
	const db = yield* Database;

	const cohortRows = yield* db
		.select({ id: cohorts.id })
		.from(cohorts)
		.where(and(eq(cohorts.id, data.cohortId), isNull(cohorts.deletedAt)))
		.limit(1);
	if (cohortRows.length === 0) {
		return yield* new CohortNotFoundError({ cohortId: data.cohortId });
	}

	// Soft-delete the cohort and its memberships in one go so members stop
	// receiving assignments targeted at the deleted cohort.
	const now = new Date();
	yield* db.update(cohorts).set({ deletedAt: now }).where(eq(cohorts.id, data.cohortId));
	yield* db
		.update(cohortMembers)
		.set({ deletedAt: now })
		.where(and(eq(cohortMembers.cohortId, data.cohortId), isNull(cohortMembers.deletedAt)));

	return true;
});
