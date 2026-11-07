import { Config } from "effect";

export const ServerConfig = Config.all({
	siteUrl: Config.string("SITE_URL"),
	databaseUrl: Config.string("TURSO_DATABASE_URL"),
	dbAuthToken: Config.redacted("TURSO_AUTH_TOKEN"),
	authSecret: Config.redacted("BETTER_AUTH_SECRET"),
	authUrl: Config.string("BETTER_AUTH_URL"),
	// E2E runs many signups in quick succession; disable the limiter there.
	authRateLimitEnabled: Config.boolean("BETTER_AUTH_RATE_LIMIT_ENABLED").pipe(
		Config.withDefault(true),
	),
	signupRateLimitMax: Config.integer("SIGNUP_RATE_LIMIT_MAX").pipe(Config.withDefault(5)),
});
