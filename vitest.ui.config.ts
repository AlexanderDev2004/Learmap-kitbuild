import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

const baseConfig = {
	environment: "jsdom",
	alias: {
		// fileURLToPath (not `.pathname`) so this works on Windows too.
		"@": fileURLToPath(new URL("./src/", import.meta.url)),
		"cloudflare:workers": fileURLToPath(
			new URL("./src/__tests__/mocks/cloudflare-workers.ts", import.meta.url),
		),
	},
	globals: true,
};

export default defineConfig({
	test: {
		...baseConfig,
		environment: "jsdom",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		setupFiles: ["./src/__tests__/setup/ui.ts"],
		name: "ui",
	},
});
