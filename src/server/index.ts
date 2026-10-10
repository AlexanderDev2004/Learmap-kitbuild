import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { app } from "./app";

const port = Number(process.env.PORT ?? 3210);

// Mode produksi: sajikan hasil build frontend dari dist/.
if (process.env.SERVE_STATIC === "1") {
	app.use("*", serveStatic({ root: "./dist" }));
}

console.log(`LearnMap API berjalan di http://localhost:${port}`);
serve({ fetch: app.fetch, port });
