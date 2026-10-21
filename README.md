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

| Feature                  | Description                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Concept Map Editor       | Visual editor for creating goal maps with bi-directional/multi-link support                                   |
| Automatic Kit Generation | Disassembles goal maps into student-ready activity kits                                                       |
| Map Diagnosis            | Automatic comparison of learner maps against goal maps                                                        |
| Segmentation             | Splits a goal map into ordered kit segments using Paragraph or Depth-Topic models (see below)                 |
| Visual Grouping (Frames) | Named, colored frames that wrap nodes in the goal map editor for organization (see below)                     |
| Extended Assessments     | Quiz builder for MCQ, text, and Likert-scale questions (research extension)                                   |
| Aiken Import/Export      | Import and export assessment questions in the Moodle [Aiken format](https://docs.moodle.org/en/Aiken_format)  |
| Answer Review Control    | Teachers toggle "Show Answer" so students see which questions they missed after submission                    |
| Assignment Management    | Deadlines, time limits, access controls, and per-assignment associated forms (pretest/posttest/questionnaire) |
| Research Dashboard       | Analytics sheets, student-level results, and exportable CSV for research analysis                             |
| Feedback System          | Targeted feedback based on diagnosis results                                                                  |

### Segmentation vs Frames

These two editor tools are easy to confuse, but they serve different purposes:

- **Segments** (segmentation) divides a goal map into the kit segments students
  actually work through, in order. This is the mechanism used in the thesis
  experiment (Paragraph vs Depth-Topic models) and it directly affects what
  students receive.
- **Frames** are a visual aid only: select one or more nodes in the goal map
  editor (click, `Ctrl+click` to add more, or `Shift+drag` a selection box),
  press **Frame**, and the nodes get wrapped in a named, colored box that can
  be moved, renamed (double-click the label), and recolored (hover the frame)
  together. Frames never reach kits, scores, or student views; **Unframe**
  dissolves a frame and releases its nodes.

### Forms: Aiken format and Show Answer

- Forms support multiple choice, short answer, and Likert-scale questions.
  Teachers can import/export questions in the Aiken format for round-tripping
  with Moodle or plain-text question banks.
- On an assignment, the teacher decides whether students may review their
  answers. With **Show Answer** enabled, a student's result page lists each
  question with their answer marked wrong and the correct answer shown below
  it; when disabled, students only see their score.

## Workflow Guide: from Goal Map to Assignment

A complete Kit-Build activity is built in four stages. Everything below is done
from the teacher/admin dashboard (`alex@kitbuild.mail` in the demo data).

### 1. Topic and Goal Map (`/dashboard/goal-map`)

1. Create the reading material first if you have one: open a goal map (or a
   new one) and press **Material** in the editor toolbar to paste or upload
   (`.txt` / `.md`) the reading text students will read.
2. Build the map: **Concept** adds concept nodes, **Link** adds linking words
   and connects two nodes (bi-directional and multi-link are supported).
3. Press **Save** and pick the topic and map name in the _Save As…_ dialog.
   Saving the goal map also stores its segments.

### 2. Segmentation (`Segments` button in the goal map editor)

Open the **Segments** button in the editor toolbar to manage kit segments:

- **Paragraph model** — press _Add Segment_, give it a name, choose the
  **Paragraf (manual)** type, pick a color, then tick which nodes belong to it.
  Create one segment per paragraph of the reading material.
- **Depth-Topic model** — choose the **Depth-Topic (kedalaman topik)** type.
  Segments follow the depth levels of the topic hierarchy (core concept → main
  concepts → details); the dialog can also generate them automatically from the
  map structure.
- **Import Frame** — frames you drew in the editor can be converted into
  segments in one go. Pick the segmentation model once in the import dialog
  (Paragraf or Depth-Topic) and it is applied to every imported frame.

Both models can live in the **same goal map** — that is exactly how the
dual-model experiment kit is set up (see the seed script
`scripts/seed/kit-test-dual.ts` for a complete worked example: topic _Siklus
Air_, segments P1–P3 = Paragraph, D1–D3 = Depth-Topic).

### 3. Forms (`/dashboard/forms`)

Create the assessments in the form builder:

1. **New Form**, choose the type: `Pre-Test`, `Post-Test`, `Delayed Test`, or
   `Questionnaire`, then **Publish** it when done.
2. Add questions: multiple choice (with correct answer), short answer, or
   Likert scale. For MCQ question banks you can use **Import Aiken** to paste
   an [Aiken format](https://docs.moodle.org/en/Aiken_format) file, and
   **Export Aiken** to hand questions back out.

### 4. Assignment (`/dashboard/assignments`)

Press **Create Assignment** and follow the 4-step wizard:

1. **Basic Information** — title, description, and the reading material.
2. **Configuration** — pick the goal map, start/end date, and time limit. The
   kit is generated automatically from the goal map when the assignment is
   created.
3. **Procedure** — attach the **Pre-Test** (required), **Post-Test**,
   **Delayed Post-Test** (+ delay in days), and the questionnaire; here you can
   also toggle **Show Answer** per form.
4. **Assignment** — choose the target cohorts and/or individual students.

Students only see assignments targeted at them (via their cohort membership or
directly), so make sure the students are members of the chosen cohorts
(`/dashboard/users` manages cohorts and members).

### 5. Working as a Student

Student view (`tanaka@kitbuild.mail` in the demo data):

1. **My Assignments** lists the targeted assignments with the current phase
   badge. Open one to see the four-phase flow:
   **Pre-Test → Kitbuilding → Post-Test → Kuesioner**.
2. **Take Pre-Test** first — Kitbuilding stays locked until it is submitted.
3. **Kitbuilding** — rebuild the concept map by dragging concepts and
   connecting them with linking words. The segment pills let you work segment
   by segment (this is where Paragraph vs Depth-Topic segmentation is
   experienced). Press **Submit** when done — Post-Test unlocks after that.
4. **Post-Test**, then the questionnaire if one is attached.
5. If the teacher enabled **Show Answer**, the result page shows every missed
   question with the correct answer below the student's answer; otherwise only
   the score is shown.

---

## Quick Start (Development)

```bash
# Install dependencies
vp install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# First time: create the schema and load demo data
pnpm run db:migrate
pnpm run db:seed

# Start the development server
pnpm run dev
```

`pnpm run dev` = `vp dev` plus a small LibSQL-compatible HTTP server
(`scripts/dev/sqlite-server.ts`) that is started automatically when nothing is
listening on `TURSO_DATABASE_URL`. The Workers runtime used by `vp dev` cannot
open `file:` SQLite URLs, so local development talks to sqld over HTTP — with
no Docker and no Turso account. If you prefer a real sqld instance (Linux/WSL),
start Docker first and it will be reused as-is:

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm run dev
```

Visit http://localhost:5173

> Tip: cookies are scoped per host, so you can test two accounts side by side —
> sign in as a researcher at `http://localhost:5173` and as a student at
> `http://127.0.0.1:5173`.

### Demo accounts (after `pnpm run db:seed`)

| Role    | Email                | Password   |
| ------- | -------------------- | ---------- |
| Admin   | admin@kitbuild.mail  | admin12345 |
| Admin   | bagas@kitbuild.mail  | bagas12345 |
| Admin   | citra@kitbuild.mail  | citra12345 |
| Teacher | banni@kitbuild.mail  | banni12345 |
| Teacher | helmy@kitbuild.mail  | helmy12345 |
| Teacher | alex@kitbuild.mail   | alex12345  |
| Student | tanaka@kitbuild.mail | demo12345  |
| Student | sari@kitbuild.mail   | demo12345  |
| Student | rudi@kitbuild.mail   | demo12345  |

`db:seed:fotosintesis` additionally loads the photosynthesis experiment kit
(two segmentation models in one goal map: Kelompok A = Segmen Paragraf, Kelompok
B = Segmen Depth Topik) with the student accounts above.

For a **single kit containing both segmentation models at once** (segments
P1–P3 = Paragraph, D1–D3 = Depth-Topic, plus Pre-Test, Post-Test, and a
perception questionnaire), run the dual-model seed after `db:seed`:

```bash
npx tsx --env-file=.env scripts/seed/kit-test-dual.ts
```

It is idempotent and also reactivates the demo student accounts if a previous
run soft-deleted them. Sign in as `alex@kitbuild.mail` to inspect the _Siklus
Air_ goal map and assignment, or as `tanaka@kitbuild.mail` to work through the
four-phase flow.

This project is using these tech stack, so check their respective documentations for further information:

- [Tanstack Start](https://tanstack.com/start/latest)
- [Vite+](https://viteplus.dev)
- [Drizzle](https://orm.drizzle.team/)
- [TailwindCSS](https://tailwindcss.com/)
- [Effect](https://effect.website)

---

## Deploying to Cloudflare Workers

Aplikasi ini live di **https://learnmap.alexanderar.com** (Cloudflare Workers),
dengan Worker name `learnmap`, storage gambar di R2 bucket
`learnmap-materials`, dan database di Turso (LibSQL remote).

### Prasyarat

- Akun [Cloudflare](https://dash.cloudflare.com/sign-up) — R2 harus sudah
  **diaktifkan** sekali lewat dashboard (menu R2 → Get started), karena
  aktivasi R2 tidak bisa dilakukan lewat API. Tanpa ini `wrangler deploy`
  gagal dengan error `10042`.
- Database [Turso](https://turso.tech) (SQLite di edge).
- Wrangler ter-autentikasi: `npx wrangler login` (OAuth), atau set env
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

> **Catatan SSR/SPA:** aplikasi berjalan dalam **SPA mode**
> (`tanstackStart({ spa: { enabled: true } })` di `vite.config.ts`).
> Alasannya: plan gratis Workers membatasi CPU 10ms per request dan SSR
> kadang melewatinya (Cloudflare error 1102 "Worker exceeded resource
> limits"). Dengan SPA mode, worker hanya menyajikan aset statis (tanpa
> CPU) dan server function (IO database). Kalau nanti upgrade ke plan
> berbayar, SSR bisa diaktifkan kembali dengan menghapus opsi `spa`.

### 1. Buat Database Turso

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash   # macOS/Linux
irm get.tur.so/install.ps1 | iex                   # Windows PowerShell

turso auth login

# Buat database lalu ambil detail koneksinya
turso db create learnmap
turso db show learnmap --url        # -> TURSO_DATABASE_URL
turso db tokens create learnmap     # -> TURSO_AUTH_TOKEN
```

### 2. Set Konfigurasi Production

Yang sudah terpasang di `wrangler.json` (tidak perlu diubah):

- `routes`: custom domain `learnmap.alexanderar.com`
  (`custom_domain: true` — wrangler otomatis membuat DNS record di zone
  `alexanderar.com` saat deploy).
- `vars`: `VITE_APP_URL`, `BETTER_AUTH_URL`, `SITE_URL` menunjuk ke
  `https://learnmap.alexanderar.com` (vars ini juga ikut ter-bake ke build
  client oleh @cloudflare/vite-plugin).

### 3. Set Secrets Worker

Secrets di-set langsung ke Worker lewat wrangler (bukan lewat `.env`):

```bash
npx wrangler secret put TURSO_DATABASE_URL   # paste libsql://... turso
npx wrangler secret put TURSO_AUTH_TOKEN     # paste token Turso
npx wrangler secret put BETTER_AUTH_SECRET   # random string min. 32 karakter
```

### 4. Push Schema ke Turso lalu Deploy

```bash
# Push schema Drizzle ke database Turso production
$env:DATABASE_MODE='remote'
$env:TURSO_DATABASE_URL='libsql://learnmap-xxx.turso.io'
$env:TURSO_AUTH_TOKEN='your-turso-token'
npx drizzle-kit push

# Buat R2 bucket (sekali saja, setelah R2 diaktifkan di dashboard)
npx wrangler r2 bucket create learnmap-materials

# Deploy (menjalankan typecheck + lint + test dulu)
vp run deploy
```

### 5. Seeding Data Production (opsional)

Script seed membaca `.env`, jadi arahkan `.env` lokal ke database Turso
production untuk sementara (`DATABASE_MODE=remote`, `TURSO_DATABASE_URL=...`,
`TURSO_AUTH_TOKEN=...`), lalu jalankan misalnya `vp run db:seed:java`.
Kembalikan `.env` ke nilai lokal setelahnya.

### Environment Reference

| Variable             | Type          | Purpose                                     |
| -------------------- | ------------- | ------------------------------------------- |
| `TURSO_DATABASE_URL` | Worker secret | Database connection string                  |
| `TURSO_AUTH_TOKEN`   | Worker secret | Turso authentication                        |
| `BETTER_AUTH_SECRET` | Worker secret | Session signing key (32+ chars)             |
| `BETTER_AUTH_URL`    | wrangler vars | Auth callback URL                           |
| `SITE_URL`           | wrangler vars | Canonical site URL                          |
| `VITE_APP_URL`       | wrangler vars | Base URL yang ter-bake ke client build      |
| `MATERIAL_IMAGES`    | R2 binding    | Image storage bucket (`learnmap-materials`) |

---

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
