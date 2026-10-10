# LearnMap

A modern reimplementation of the [KitBuild Concept Map](https://collab.kit-build.net/) platform using contemporary web technologies. Originally built as part of a bachelor thesis.

---

## What is LearnMap?

LearnMap is a modern, researcher-friendly reimplementation of the KitBuild Concept Map platform originally developed by the [Learning Engineering Laboratory at Hiroshima University](https://lel.main.jp/kb/).

The original system (operational since 2009) pioneered automatic diagnosis of concept maps for formative assessment. This reimplementation aims to:

- Provide a cleaner, more accessible interface for researchers and educators. Everything is managed in a single place: pre-test, post-test, delayed-test, questionnaires — no external platforms like Google Forms needed.
- Run on modern web infrastructure (Cloudflare Workers + Turso/LibSQL). No VPS required to deploy.

All core assessment methods — automatic map diagnosis, kit generation algorithms, feedback frameworks — come directly from the original KitBuild research. This reimplementation **does not** introduce new pedagogical approaches; it reimplements the proven ones in a more maintainable, extensible form. All credits belong to the original researchers.

---

## About KitBuild

KitBuild is a pedagogical approach developed by Tsukasa Hirashima and colleagues at Hiroshima University. The original system has been used across 1700+ institutions worldwide for:

- Automatic diagnosis of student understanding through concept map reconstruction
- Formative assessment in large classroom settings
- Visualizing gaps between instructor expectations and student comprehension

### Original System

- Live System: [collab.kit-build.net](https://collab.kit-build.net/)
- Homepage: [lel.main.jp/kb](https://lel.main.jp/kb)

### Foundational Research

The KitBuild methodology is backed by extensive peer-reviewed research:

| Paper                                                                                                                                   | Authors             | Year |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---- |
| [Framework of Kit-Build Concept Map for Automatic Diagnosis](https://telrp.springeropen.com/articles/10.1186/s41039-015-0018-9)         | Hirashima et al.    | 2015 |
| [The Practical Use of Kit-Build Concept Map on Formative Assessment](https://telrp.springeropen.com/articles/10.1186/s41039-017-0060-x) | Pailai et al.       | 2017 |
| [Collaborative Concept Mapping with Reciprocal Kit-Build](https://link.springer.com/article/10.1186/s41039-020-00136-6)                 | Hayashi & Hirashima | 2020 |
| [Evaluating the Kit-Build Process Using Sub-Map Scoring](https://rptel.apsce.net/index.php/RPTEL/article/view/2024-19021)               | Rismanto et al.     | 2024 |

---

## How It Works

The KitBuild method follows a 4-step cycle:

1. Goal Map: Instructor creates an expert concept map showing correct relationships
2. Kit Generation: System disassembles the goal map into components (concepts + links)
3. Reconstruction: Students rebuild the map from the kit, demonstrating their understanding
4. Automatic Diagnosis: System compares student maps against the goal map and identifies misconceptions

This approach reduces cognitive load on students (no need to invent terminology) while giving instructors precise, actionable data about understanding gaps.

---

## Research Focus

LearnMap is built for a thesis experiment comparing **two segmentation models** for Kit-Build concept maps:

| Model                    | Description                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Paragraph Segmentation   | The concept map is segmented following the paragraph structure of the learning material.                   |
| Depth-Topic Segmentation | The concept map is segmented following topic hierarchy depth (general concepts toward more specific ones). |

Grounded in segmentation theory (Schneider et al., 2021), which applies Mayer's Segmenting Principle to concept maps: meaningful, coherent segmentation can reduce cognitive load and improve learning outcomes.

**Measured variables:** pretest, posttest, map score (learner map vs goal map match), completion time, and student perception questionnaire. Sub-Map Scoring (SMS) and build-order analysis are deliberately **not** used.

---

## Features

LearnMap reimplements the core KitBuild workflow with modern tooling:

| Feature                  | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| Concept Map Editor       | Visual editor for creating goal maps with bi-directional/multi-link support |
| Automatic Kit Generation | Disassembles goal maps into student-ready activity kits                     |
| Map Diagnosis            | Automatic comparison of learner maps against goal maps                      |
| Extended Assessments     | Quiz builder for MCQ, text, and Likert-scale questions (research extension) |
| Assignment Management    | Deadlines, time limits, access controls                                     |
| Research Dashboard       | Analytics and exportable data for research analysis                         |
| Feedback System          | Targeted feedback based on diagnosis results                                |

---

## Quick Start (Development)

```bash
# Install dependencies
vp install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start the local LibSQL server (dev database) — the Workers runtime used by
# `vp dev` cannot open `file:` SQLite URLs, so dev talks to sqld over HTTP:
docker compose -f docker-compose.dev.yml up -d

# Push database schema
vpx drizzle-kit push

# (Optional) load demo users, goal maps, kit, assignment, and forms
pnpm run db:seed

# Start development server
vp dev
```

Visit http://localhost:5173

This project is using these tech stack, so check their respective documentations for further information:

- [Tanstack Start](https://tanstack.com/start/latest)
- [Vite+](https://viteplus.dev)
- [Drizzle](https://orm.drizzle.team/)
- [TailwindCSS](https://tailwindcss.com/)
- [Effect](https://effect.website)

---

## Deploying to Cloudflare Workers

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Turso database](https://turso.tech) (SQLite at the edge)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) authenticated

### 1. Create Turso Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# Create database
turso db create kitbuild

# Get connection details
turso db show kitbuild --url
turso db tokens create kitbuild
```

### 2. Configure Environment

Create `.env`:

```bash
DATABASE_MODE=remote
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token
BETTER_AUTH_SECRET=your-random-secret-min-32-chars
BETTER_AUTH_URL=https://your-domain.com
SITE_URL=https://your-domain.com
VITE_SENTRY_DSN=https://your-sentry-dsn  # optional
```

### 3. Configure Wrangler

Edit `wrangler.json`:

```json
{
	"name": "kitbuild",
	"compatibility_date": "2025-09-02",
	"compatibility_flags": ["nodejs_compat"],
	"main": "@tanstack/react-start/server-entry",
	"r2_buckets": [
		{
			"binding": "MATERIAL_IMAGES",
			"bucket_name": "kitbuild-materials"
		}
	]
}
```

### 4. Create R2 Bucket & Deploy

```bash
# Create storage bucket
wrangler r2 bucket create kitbuild-materials

# Wipe local SQLite db file, then rerun migrations
vp run db:wipe
vp run db:migrate

# Wipe remote Turso DB, then rerun migrations
vp run db:wipe --force
vp run db:migrate

# Push database schema (remote Turso)
export DATABASE_MODE=remote
export TURSO_DATABASE_URL=libsql://your-db.turso.io
export TURSO_AUTH_TOKEN=your-turso-token
vpx drizzle-kit push

# Deploy
vp run deploy
```

### Environment Reference

| Variable             | Type       | Purpose                                   |
| -------------------- | ---------- | ----------------------------------------- |
| `DATABASE_MODE`      | env        | `remote` (Turso) or `local` (SQLite file) |
| `TURSO_DATABASE_URL` | env        | Database connection string                |
| `TURSO_AUTH_TOKEN`   | secret     | Turso authentication                      |
| `BETTER_AUTH_SECRET` | secret     | Session signing key (32+ chars)           |
| `BETTER_AUTH_URL`    | env        | Auth callback URL                         |
| `SITE_URL`           | env        | Canonical site URL                        |
| `MATERIAL_IMAGES`    | R2 binding | Image storage bucket                      |

---

## Deploying with Docker (self-hosted)

Prefer to run KitBuild on your own server instead of Cloudflare Workers? The Docker image builds the app for a **Bun runtime** and serves it as a regular HTTP server with a local SQLite database and on-disk image storage.

```bash
cp .env.example .env        # then set DATABASE_MODE=local, TURSO_DATABASE_URL=file:/app/data/kitbuild.sqlite
vp run docker:up            # build + start (migrations run automatically)
# → open http://localhost:3000
```

Full instructions — including the production setup, environment reference, persistence, and backups — are in [docs/docker.md](docs/docker.md).

---

## Attribution

- Original research and algorithms: Tsukasa Hirashima and colleagues
- Original system: [collab.kit-build.net](https://collab.kit-build.net/)

If you use KitBuild for research, please cite the original KitBuild papers to acknowledge the foundational work.

## License

See [LICENSE](./LICENSE)
