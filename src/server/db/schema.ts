import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = integer("created_at", { mode: "timestamp_ms" })
	.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
	.notNull();

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	username: text("username").notNull().unique(),
	name: text("name").notNull(),
	passwordHash: text("password_hash").notNull(),
	role: text("role", { enum: ["peneliti", "siswa"] }).notNull(),
	/** Kelas siswa (mis. "XI-A"); null untuk peneliti. */
	className: text("class_name"),
	/** Jurusan siswa (mis. "IPA"); null untuk peneliti. */
	major: text("major"),
	/** pending = menunggu ACC, active = disetujui. Akun peneliti selalu active. */
	status: text("status", { enum: ["pending", "active", "rejected"] })
		.notNull()
		.default("active"),
	createdAt,
});

export const materials = sqliteTable("materials", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	/** Materi dengan paragraf dipisahkan baris kosong. */
	content: text("content").notNull(),
	createdBy: text("created_by")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt,
});

export const goalMaps = sqliteTable(
	"goal_maps",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		/** JSON array MapNode[] */
		nodes: text("nodes", { mode: "json" }).notNull(),
		/** JSON array MapEdge[] */
		edges: text("edges", { mode: "json" }).notNull(),
		materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt,
	},
	(table) => [index("goal_maps_createdBy_idx").on(table.createdBy)],
);

export const experiments = sqliteTable(
	"experiments",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		description: text("description"),
		goalMapId: text("goal_map_id")
			.notNull()
			.references(() => goalMaps.id, { onDelete: "cascade" }),
		/** JSON array McqQuestion[] */
		pretest: text("pretest", { mode: "json" }).notNull(),
		/** JSON array McqQuestion[] */
		posttest: text("posttest", { mode: "json" }).notNull(),
		/** JSON array LikertItem[] */
		questionnaire: text("questionnaire", { mode: "json" }).notNull(),
		/** Batas waktu menyusun peta (menit), null = tanpa batas. */
		buildTimeLimitMinutes: integer("build_time_limit_minutes"),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt,
	},
	(table) => [index("experiments_createdBy_idx").on(table.createdBy)],
);

export const participations = sqliteTable(
	"participations",
	{
		id: text("id").primaryKey(),
		experimentId: text("experiment_id")
			.notNull()
			.references(() => experiments.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Kelompok eksperimen yang ditetapkan saat mulai: paragraph | depth. */
		segmentModel: text("segment_model", { enum: ["paragraph", "depth"] }).notNull(),
		/** pretest | material | build | posttest | questionnaire | completed */
		phase: text("phase").notNull().default("pretest"),
		/** JSON array jawaban pretest (index opsi per soal). */
		pretestAnswers: text("pretest_answers", { mode: "json" }),
		pretestScore: real("pretest_score"),
		/** JSON MapGraph peta siswa (terakhir disimpan). */
		learnerNodes: text("learner_nodes", { mode: "json" }),
		learnerEdges: text("learner_edges", { mode: "json" }),
		/** JSON DiagnosisResult */
		diagnosis: text("diagnosis", { mode: "json" }),
		mapScore: real("map_score"),
		/** JSON array jawaban posttest. */
		posttestAnswers: text("posttest_answers", { mode: "json" }),
		posttestScore: real("posttest_score"),
		/** JSON array jawaban kuesioner (nilai 1..5 per item). */
		questionnaireAnswers: text("questionnaire_answers", { mode: "json" }),
		/** JSON ParticipationTimings — durasi tiap fase. */
		timings: text("timings", { mode: "json" }),
		startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		createdAt,
	},
	(table) => [
		index("participations_experimentId_idx").on(table.experimentId),
		index("participations_userId_idx").on(table.userId),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	participations: many(participations),
}));

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
	goalMap: one(goalMaps, {
		fields: [experiments.goalMapId],
		references: [goalMaps.id],
	}),
	participations: many(participations),
}));

export const participationsRelations = relations(participations, ({ one }) => ({
	experiment: one(experiments, {
		fields: [participations.experimentId],
		references: [experiments.id],
	}),
	user: one(users, {
		fields: [participations.userId],
		references: [users.id],
	}),
}));
