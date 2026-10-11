import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

export default defineConfig({
	test: {
		environment: "jsdom",
		include: ["**/*.ignored"], // Don't run any tests by default - use test:ui or test:service
		globals: true,
		setupFiles: ["src/__tests__/setup/ui.ts"],
		alias: {
			// fileURLToPath (not `.pathname`) so this works on Windows too.
			"@": fileURLToPath(new URL("./src/", import.meta.url)),
			"cloudflare:workers": fileURLToPath(
				new URL("./src/__tests__/mocks/cloudflare-workers.ts", import.meta.url),
			),
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"node_modules/",
				"src/__tests__/",
				"**/*.test.ts",
				"**/*.test.tsx",
				"**/*.d.ts",
				"src/**/*.stories.tsx",
			],
		},
	},
});
