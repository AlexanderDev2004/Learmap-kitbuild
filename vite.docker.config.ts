import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite-plus";

/**
 * Build configuration for Docker deployments (self-hosted, served by Bun).
 *
 * Identical to `vite.config.ts` except that the `cloudflare:workers` builtin
 * module is aliased to a filesystem-backed shim (`docker/shims/`), so the
 * produced bundle runs outside of workerd. Storage for uploaded material
 * images is then a local directory instead of R2.
 *
 * Build with: `vp build -c vite.docker.config.ts`
 */
export default defineConfig({
	resolve: {
		conditions: ["development", "module", "browser", "default"],
		alias: {
			// fileURLToPath (not `.pathname`) so this works on Windows too.
			"@": fileURLToPath(new URL("./src/", import.meta.url)),
			// The `@libsql/client` web build (selected by the workerd/browser
			// conditions) only speaks libsql:/wss:/https: — it cannot open local
			// SQLite files. The Docker deployment runs on Bun/Node, so force the
			// node build, which supports `file:` URLs via the native binding.
			"@libsql/client": "@libsql/client/node",
			"cloudflare:workers": fileURLToPath(
				new URL("./docker/shims/cloudflare-workers.ts", import.meta.url),
			),
		},
	},
	build: {
		target: "es2023",
		cssCodeSplit: true,
		assetsInlineLimit: 4096,
		rolldownOptions: {
			// The native libsql binding must not be bundled — the worker build's
			// unenv `process` polyfill (empty `process.arch`) breaks @neon-rs/load.
			// Keep the client external so Bun/Node resolve it from node_modules.
			external: ["@libsql/client"],
		},
	},
	optimizeDeps: {
		// Exclude TanStack Start packages from Vite's dependency optimization
		// to prevent issues with virtual imports (#tanstack-router-entry, etc.)
		exclude: [
			"@tanstack/start-server-core",
			"@tanstack/react-start",
			"@tanstack/react-start/client",
			"@tanstack/react-start/server",
		],
	},

	ssr: {
		optimizeDeps: {
			include: ["@tanstack/react-start", "@tanstack/start-client-core"],
		},
	},

	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	] as PluginOption[],
});
