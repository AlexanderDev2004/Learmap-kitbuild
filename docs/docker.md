# Deploying with Docker (self-hosted)

Prefer to run KitBuild on your own server? The Docker image builds the app for a **Bun runtime** (no Cloudflare/Workers required) and serves it as a regular HTTP server:

- **Database**: local SQLite file (default) or a remote Turso database
- **Uploads**: material images are stored on a local disk volume instead of R2
- **Static assets**: served by the Bun server itself (no asset platform)

## Files

| File                                 | Purpose                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                         | Multi-stage image: pnpm install → `vp build -c vite.docker.config.ts` → run with Bun                                                |
| `docker-compose.yml`                 | `migrate` (one-shot) + `app` services, shared data volume                                                                           |
| `vite.docker.config.ts`              | Build config: swaps `cloudflare:workers` for a filesystem shim (`docker/shims/`), forces the Node `@libsql/client` for `file:` URLs |
| `docker/server.ts`                   | Bun HTTP server: serves `dist/client` assets + delegates to the app handler                                                         |
| `docker/shims/cloudflare-workers.ts` | `env.MATERIAL_IMAGES` backed by `MATERIAL_UPLOAD_DIR` on disk                                                                       |

## Local quick start

```bash
# 1. Configure environment (copy the example and adjust)
cp .env.example .env

# For a fully-local setup, set these in .env:
# DATABASE_MODE=local
# TURSO_DATABASE_URL=file:/app/data/kitbuild.sqlite
# (leave TURSO_AUTH_TOKEN empty)

# 2. Build and start (migrations run automatically, then the app)
vp run docker:up
# → open http://localhost:3000

# 3. Optional: seed demo data (admin@kitbuild.mail / admin123)
docker compose run --rm app bunx tsx scripts/seed/index.ts

# 4. Stop
vp run docker:down
```

`BETTER_AUTH_SECRET` is **required** — compose fails fast if it is missing from `.env` (use a random string of 32+ characters).

## Production deployment

On your VPS (requires Docker with the compose plugin):

```bash
# 1. Get the code
git clone <your-repo> kitbuild && cd kitbuild

# 2. Configure environment
cp .env.example .env
# Set (all values are interpolated into compose):
#   BETTER_AUTH_SECRET=<random 32+ chars>
#   VITE_APP_URL=https://maps.example.com   ← public URL, baked into the client bundle at build time
#   SITE_URL=https://maps.example.com
#   BETTER_AUTH_URL=https://maps.example.com
#   DATABASE_MODE=remote                    ← or keep 'local' for the SQLite volume
#   TURSO_DATABASE_URL=libsql://your-db.turso.io
#   TURSO_AUTH_TOKEN=your-turso-token

# 3. Build & start (first `up` also runs the migrate service)
docker compose up -d --build

# 4. Seed initial data (optional)
docker compose run --rm app bunx tsx scripts/seed/index.ts
```

Then put a reverse proxy in front (example with Caddy, handling TLS automatically):

```caddyfile
maps.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

### Persistence & upgrades

- All persistent data lives in the `kitbuild-data` volume (`/app/data` inside the container): the SQLite file and uploaded images. **Back it up** (`docker run --rm -v kitbuild-data:/data -v $PWD:/backup alpine tar czf /backup/kitbuild-data.tar.gz -C /data .`).
- To upgrade: pull the new code, then `docker compose up -d --build` — the migrate service reapplies pending migrations before the new app starts.
- Changing the public URL requires a rebuild (`VITE_APP_URL` is inlined into the client bundle).

## Docker environment reference

| Variable                    | Default                          | Purpose                                            |
| --------------------------- | -------------------------------- | -------------------------------------------------- |
| `DATABASE_MODE`             | `local`                          | `local` (SQLite volume) or `remote` (Turso)        |
| `TURSO_DATABASE_URL`        | `file:/app/data/kitbuild.sqlite` | SQLite path (local) or `libsql://` URL (remote)    |
| `TURSO_AUTH_TOKEN`          | _(empty)_                        | Turso token (required when `DATABASE_MODE=remote`) |
| `BETTER_AUTH_SECRET`        | _(required)_                     | Session signing key, 32+ chars                     |
| `BETTER_AUTH_URL`           | `http://localhost:3000`          | Auth callback URL                                  |
| `SITE_URL`                  | `http://localhost:3000`          | Canonical site URL                                 |
| `VITE_APP_URL` _(build)_    | `http://localhost:3000`          | Public URL baked into the client bundle            |
| `VITE_SENTRY_DSN` _(build)_ | _(empty)_                        | Sentry DSN (optional)                              |
| `PORT`                      | `3000`                           | Host port mapped to the container                  |
| `MATERIAL_UPLOAD_DIR`       | `/app/data/uploads`              | Where uploaded material images are stored          |

## How the Docker build differs

`vite.docker.config.ts` produces the same worker-shaped bundle as the Cloudflare build, but:

- `cloudflare:workers` is aliased to `docker/shims/cloudflare-workers.ts` — `env.MATERIAL_IMAGES` reads/writes `MATERIAL_UPLOAD_DIR` instead of R2.
- `@libsql/client` is resolved to its `/node` build and kept external, so local `file:` SQLite URLs work through the native binding. (The worker build's `process` shim is restored by `docker/server.ts`, since the libsql binding needs the real `process.arch`.)
- `docker/server.ts` serves `dist/client` assets itself and forwards everything else to the app handler.
