import { Hono } from "hono";

import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { catalogRoutes } from "./routes/catalog";
import { experimentRoutes } from "./routes/experiments";
import { participationRoutes } from "./routes/participations";
import { resultRoutes } from "./routes/results";

export const app = new Hono();

app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api", catalogRoutes);
app.route("/api/experiments", experimentRoutes);
app.route("/api/participations", participationRoutes);
app.route("/api/results", resultRoutes);

app.onError((error, c) => {
	console.error(error);
	return c.json({ error: "Kesalahan server internal" }, 500);
});
