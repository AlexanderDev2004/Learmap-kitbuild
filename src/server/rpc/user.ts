import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import {
	deleteUser,
	createUserByAdmin,
	setUserPassword,
	updateUser,
	updateUserRole,
	banUser,
	unbanUser,
	bulkAssignCohort,
	createCohort,
	updateCohort,
	deleteCohort,
} from "@/features/user/lib/user-service.mutations";
import { listUsers, getUserById } from "@/features/user/lib/user-service.queries";
import {
	BanUserInput,
	BulkCohortAssignInput,
	CohortIdInput,
	CreateCohortInput,
	CreateUserInput,
	SetUserPasswordInput,
	UpdateCohortInput,
	UpdateRoleInput,
	UpdateUserInput,
	UserFilterInput,
} from "@/features/user/lib/user-service.shared";
import { requireRoleMiddleware, requireRoleWithHeadersMiddleware } from "@/middlewares/auth";

import { AppRuntime } from "../app-runtime";
import {
	Rpc,
	TIMEOUT_DURATION,
	logRpcError,
	logAndReturnError,
	logAndReturnDefect,
} from "../rpc-helper";

export const listUsersRpc = createServerFn()
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(UserFilterInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			listUsers(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("listUsers"),
				Effect.tapError(logRpcError("listUsers")),
				Effect.catchAll(logAndReturnError("listUsers")),
				Effect.catchAllDefect(logAndReturnDefect("listUsers")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const getUserByIdRpc = createServerFn()
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) =>
		Schema.decodeUnknownSync(Schema.Struct({ userId: Schema.String }))(raw),
	)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			getUserById(data.userId).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("getUserById"),
				Effect.tapError(logRpcError("getUserById")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
				}),
				Effect.catchAll(logAndReturnError("getUserById")),
				Effect.catchAllDefect(logAndReturnDefect("getUserById")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const createUserRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(CreateUserInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			// Teachers may only create student accounts; admins may create any role.
			(context.user.role !== "admin" && data.role !== "student"
				? Effect.fail(new Error("Only admins can create teacher or admin accounts"))
				: Effect.succeed(null)
			).pipe(
				Effect.andThen(createUserByAdmin(data)),
				Effect.map(Rpc.ok),
				Effect.withSpan("createUser"),
				Effect.tapError(logRpcError("createUser")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
					EmailAlreadyExistsError: (e: { email: string }) =>
						Rpc.err(`A user with email ${e.email} already exists`, "EMAIL_EXISTS"),
				}),
				Effect.catchAll(logAndReturnError("createUser")),
				Effect.catchAllDefect(logAndReturnDefect("createUser")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const updateUserRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) =>
		Schema.decodeUnknownSync(
			Schema.Struct({
				userId: Schema.String,
				data: UpdateUserInput,
			}),
		)(raw),
	)
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			updateUser(context.user.id, data.userId, data.data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("updateUser"),
				Effect.tapError(logRpcError("updateUser")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
				}),
				Effect.catchAll(logAndReturnError("updateUser")),
				Effect.catchAllDefect(logAndReturnDefect("updateUser")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const setUserPasswordRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleWithHeadersMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(SetUserPasswordInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			setUserPassword(data, context.headers).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("setUserPassword"),
				Effect.tapError(logRpcError("setUserPassword")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
				}),
				Effect.catchAll(logAndReturnError("setUserPassword")),
				Effect.catchAllDefect(logAndReturnDefect("setUserPassword")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const updateUserRoleRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(UpdateRoleInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			updateUserRole(context.user.id, data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("updateUserRole"),
				Effect.tapError(logRpcError("updateUserRole")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
					CannotModifySelfError: (e) => Rpc.err(e.message),
					LastAdminError: (e) => Rpc.err(e.message),
				}),
				Effect.catchAll(logAndReturnError("updateUserRole")),
				Effect.catchAllDefect(logAndReturnDefect("updateUserRole")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const banUserRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(BanUserInput)(raw))
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			banUser(context.user.id, data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("banUser"),
				Effect.tapError(logRpcError("banUser")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
					CannotModifySelfError: (e) => Rpc.err(e.message),
					LastAdminError: (e) => Rpc.err(e.message),
				}),
				Effect.catchAll(logAndReturnError("banUser")),
				Effect.catchAllDefect(logAndReturnDefect("banUser")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const unbanUserRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("admin")])
	.inputValidator((raw) =>
		Schema.decodeUnknownSync(Schema.Struct({ userId: Schema.String }))(raw),
	)
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			unbanUser(context.user.id, data.userId).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("unbanUser"),
				Effect.tapError(logRpcError("unbanUser")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
					CannotModifySelfError: (e) => Rpc.err(e.message),
				}),
				Effect.catchAll(logAndReturnError("unbanUser")),
				Effect.catchAllDefect(logAndReturnDefect("unbanUser")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const deleteUserRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("admin")])
	.inputValidator((raw) =>
		Schema.decodeUnknownSync(Schema.Struct({ userId: Schema.String }))(raw),
	)
	.handler(({ data, context }) =>
		AppRuntime.runPromise(
			deleteUser(context.user.id, data.userId).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("deleteUser"),
				Effect.tapError(logRpcError("deleteUser")),
				Effect.catchTags({
					UserNotFoundError: () => Rpc.notFound("User"),
					CannotModifySelfError: (e) => Rpc.err(e.message),
				}),
				Effect.catchAll(logAndReturnError("deleteUser")),
				Effect.catchAllDefect(logAndReturnDefect("deleteUser")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const bulkAssignCohortRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(BulkCohortAssignInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			bulkAssignCohort(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("bulkAssignCohort"),
				Effect.tapError(logRpcError("bulkAssignCohort")),
				Effect.catchAll(logAndReturnError("bulkAssignCohort")),
				Effect.catchAllDefect(logAndReturnDefect("bulkAssignCohort")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const createCohortRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(CreateCohortInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			createCohort(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("createCohort"),
				Effect.tapError(logRpcError("createCohort")),
				Effect.catchTags({
					CohortAlreadyExistsError: () =>
						Rpc.err(`A cohort named "${data.name}" already exists`),
				}),
				Effect.catchAll(logAndReturnError("createCohort")),
				Effect.catchAllDefect(logAndReturnDefect("createCohort")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const updateCohortRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(UpdateCohortInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			updateCohort(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("updateCohort"),
				Effect.tapError(logRpcError("updateCohort")),
				Effect.catchTags({
					CohortAlreadyExistsError: () =>
						Rpc.err(`A cohort named "${data.name}" already exists`),
					CohortNotFoundError: () => Rpc.notFound("Cohort"),
				}),
				Effect.catchAll(logAndReturnError("updateCohort")),
				Effect.catchAllDefect(logAndReturnDefect("updateCohort")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const deleteCohortRpc = createServerFn({ method: "POST" })
	.middleware([requireRoleMiddleware("teacher", "admin")])
	.inputValidator((raw) => Schema.decodeUnknownSync(CohortIdInput)(raw))
	.handler(({ data }) =>
		AppRuntime.runPromise(
			deleteCohort(data).pipe(
				Effect.map(Rpc.ok),
				Effect.withSpan("deleteCohort"),
				Effect.tapError(logRpcError("deleteCohort")),
				Effect.catchTags({
					CohortNotFoundError: () => Rpc.notFound("Cohort"),
				}),
				Effect.catchAll(logAndReturnError("deleteCohort")),
				Effect.catchAllDefect(logAndReturnDefect("deleteCohort")),
				Effect.timeout(TIMEOUT_DURATION),
				Effect.catchTag("TimeoutException", () => Rpc.err("Request timed out", "TIMEOUT")),
			),
		),
	);

export const UserRpc = {
	users: () => ["users"],
	listUsers: (filters: Partial<UserFilterInput> = {}) =>
		queryOptions({
			queryKey: [...UserRpc.users(), "list", filters],
			queryFn: () => listUsersRpc({ data: { page: 1, pageSize: 20, ...filters } }),
		}),
	createUser: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "create"],
			mutationFn: (data: CreateUserInput) => createUserRpc({ data }),
		}),
	getUserById: (userId: string) =>
		queryOptions({
			queryKey: [...UserRpc.users(), userId],
			queryFn: () => getUserByIdRpc({ data: { userId } }),
		}),
	updateUser: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "update"],
			mutationFn: (data: { userId: string; data: UpdateUserInput }) =>
				updateUserRpc({ data }),
		}),
	setUserPassword: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "setCredential"],
			mutationFn: (data: SetUserPasswordInput) => setUserPasswordRpc({ data }),
		}),
	updateUserRole: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "updateRole"],
			mutationFn: (data: UpdateRoleInput) => updateUserRoleRpc({ data }),
		}),
	banUser: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "ban"],
			mutationFn: (data: BanUserInput) => banUserRpc({ data }),
		}),
	unbanUser: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "unban"],
			mutationFn: (data: { userId: string }) => unbanUserRpc({ data }),
		}),
	bulkAssignCohort: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "bulkCohort"],
			mutationFn: (data: BulkCohortAssignInput) => bulkAssignCohortRpc({ data }),
		}),
	createCohort: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "createCohort"],
			mutationFn: (data: CreateCohortInput) => createCohortRpc({ data }),
		}),
	updateCohort: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "updateCohort"],
			mutationFn: (data: UpdateCohortInput) => updateCohortRpc({ data }),
		}),
	deleteCohort: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "deleteCohort"],
			mutationFn: (data: CohortIdInput) => deleteCohortRpc({ data }),
		}),
	deleteUser: () =>
		mutationOptions({
			mutationKey: [...UserRpc.users(), "delete"],
			mutationFn: (data: { userId: string }) => deleteUserRpc({ data }),
		}),
};
