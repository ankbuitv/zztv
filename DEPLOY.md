# 🚀 playZ — Deploy (Cloudflare Workers)

This is the runbook for the **current** layout. It supersedes
`DEPLOY_SAU_MERGE.md` and `docs/legacy-DEPLOY_SAU_MERGE.md`, which were written
for the pre-monorepo single-`dist/` build and still tell you to run
`wrangler d1 execute --file=./schema.sql`.

---

## 0. What the repo builds, and where it lands

This is a monorepo. Vite runs **inside each workspace** and writes to that
workspace's own `outDir`. There is no root `./dist`, and there is not supposed
to be one.

| What | Command | Output directory | Wrangler config | Worker name |
|---|---|---|---|---|
| Consumer app | `npm run build:web` | `apps/web/dist` | `wrangler.toml` | `chrtv-ott` |
| Admin app | `npm run build:admin` | `apps/admin/dist` | `wrangler.admin.toml` | `playz-admin` |
| API | *(nothing to build)* | — | `wrangler.api.toml` | `chrtv-api` |
| API + consumer, one origin | `npm run build:web` | `apps/web/dist` | `wrangler.toml` | `chrtv-ott` |
| License server | *(nothing to build)* | — | `wrangler.license.toml` | `chrtv-license` |
| Local dev API | *(nothing to build)* | — | `wrangler.dev.toml` | — |

`wrangler.toml` is the default deployment: the Worker serves `/api`, `/auth`,
`/user`, `/admin`, `/ws` **and** the built consumer app from one origin, so the
browser makes same-origin requests and no CORS is involved. That is the
recommended production shape.

`wrangler.api.toml` exists so the API can be deployed and rolled back on its
own. Use it only if you also move the front end onto a separate hostname — a
client pointed at that Worker needs `VITE_API_BASE` set and the origin added to
`CORS_ALLOWED_ORIGINS`.

---

## 1. Why the deploy was failing

```
ERROR: assets.directory does not exist: /opt/buildhome/repo/dist
```

`wrangler.toml` declared `assets = { directory = "./dist" }`. No build in this
repository writes `./dist`. The apps build to `apps/web/dist` and
`apps/admin/dist`, so Wrangler aborted while packaging the upload.

The fix is **not** to copy one app's output to the repo root — that would have
made the deploy succeed while the admin stayed unreachable, and it would have
re-broken the moment the second app was deployed. Each config now points at the
directory its own build produces, and `npm run verify:assets` fails locally
long before Cloudflare would.

```bash
npm run verify:assets
```

---

## 2. Cloudflare Workers Builds — required settings

### Step 1 — the Worker name must match

`npx wrangler deploy` deploys to whatever `name` says in the wrangler config,
**not** to whatever the connected project happens to be called.

| Config | `name` |
|---|---|
| `wrangler.toml` | `chrtv-ott` |
| `wrangler.admin.toml` | `playz-admin` |
| `wrangler.api.toml` | `chrtv-api` |
| `wrangler.license.toml` | `chrtv-license` |

Open **Workers & Pages** and read the Worker name at the top of the page. If it
is not `chrtv-ott`, change that line in `wrangler.toml`. A mismatch either
fails the build, or — worse — succeeds and publishes to a Worker that has none
of your domains attached, so the site quietly keeps serving the old build.

### Step 2 — the build commands

Go to **Workers & Pages → your project → Settings → Builds**.

> ⚠️ **The build command must be `npm ci`, not `npm run build`.**
> Each `wrangler*.toml` already has a `[build] command` that builds the right
> app for that Worker. If the dashboard also runs `npm run build`, the whole
> monorepo is built a second time after the upload has already been assembled —
> that was the duplicate build.

| Setting | Value |
|---|---|
| **Root directory** | *(repository root — leave empty)* |
| **Build command** | `npm ci` |
| **Deploy command** | `npx wrangler deploy` |
| **Build output directory** | *(leave empty — the Workers build pipeline ignores it; `assets.directory` in the wrangler config is what matters)* |

For the admin project, use the same table with:

| Setting | Value |
|---|---|
| **Build command** | `npm ci` |
| **Deploy command** | `npx wrangler deploy -c wrangler.admin.toml` |

`npx wrangler deploy` alone is enough for the API-only project, because
`wrangler.api.toml` has no `[build]` table — there is nothing to build.

### If your build fails on a secrets/vars error

`VITE_*` values are **build variables**, not runtime secrets. Set them under
**Settings → Builds → Variables and Secrets**. See `docs/SECRETS.md`.

---

## 3. Deploy commands

```bash
npm ci

# 0. one-time: schema (see §4)
npm run db:migrate:remote

# consumer + API on one origin
npm run deploy

# admin
npm run deploy:admin

# API only, if you split the hosts
npm run deploy:api

# license server
npm run deploy:license
```

Each `wrangler*.toml` runs its own `[build]`, so **do not** prefix these with
`npm run build` — that is the duplicate-build problem again.

### Dry run before you touch production

```bash
npx wrangler deploy --dry-run                     # chrtv-ott
npx wrangler deploy -c wrangler.admin.toml --dry-run
npx wrangler deploy -c wrangler.api.toml --dry-run
npx wrangler deploy -c wrangler.license.toml --dry-run
```

Each one prints `Read N files from the assets directory …`. If that line is
missing or names the wrong directory, stop.

---

## 4. Database — migrations, not `--file=schema.sql`

The old mechanism was:

```bash
npx wrangler d1 execute chrtv-db --remote --file=./schema.sql   # DO NOT USE
```

Two problems with it: `schema.sql` is stale (32 tables, while the Worker
actually uses 78), and running it on every deploy meant D1's own
`d1_migrations` table stayed empty, so the database had no history and no way
to tell what had been applied.

The replacement is a real migration set in `migrations/`:

| File | What it does |
|---|---|
| `0000_baseline.sql` | The full current schema — 78 tables, 24 indexes. Generated from `SCHEMA_STATEMENTS` in `worker/worker.js` by `scripts/gen-d1-baseline.mjs`. |
| `0001_seed_plans.sql` | The five default subscription tiers, `INSERT OR IGNORE`. |

`0000_baseline.sql` is written so that applying it to the **existing
production database changes nothing**: every table is `CREATE TABLE IF NOT
EXISTS`, every column that `ensureSchema()` ever added by `ALTER TABLE` is
folded into that table's `CREATE TABLE`, and every index is `IF NOT EXISTS`.
There is no `DROP`, no `DELETE` and no data rewrite anywhere in the file.
`npm test` asserts that by rebuilding a populated database and checking the rows
survive.

```bash
npm run db:status          # what has been applied
npm run db:migrate:local   # dry run against a local D1
npm run db:migrate:remote  # apply to production
```

> Before the first `db:migrate:remote`, take a backup. It should be a no-op, but
> a backup costs nothing:
>
> ```bash
> npx wrangler d1 export chrtv-db --remote --output=backup-$(date +%F).sql
> ```

### Adding a migration later

```bash
# 1. change SCHEMA_STATEMENTS in worker/worker.js
# 2. regenerate the baseline so it still matches
npm run db:baseline
# 3. for anything that is NOT part of the baseline shape, add the next file
$EDITOR migrations/0002_something.sql     # additive statements only
# 4. verify
npm run db:migrate:local && npm test
```

`npm test` fails if the baseline drifts away from `worker/worker.js`, so the
generator cannot be forgotten.

`worker.js` still calls `ensureSchema()` on cold starts. That is deliberate —
it is the safety net for a database that predates migrations, and removing it
would turn a missing migration into an outage.

---

## 5. Local verification

```bash
npm ci
npm run build                  # web + admin
npm run verify:assets          # every assets.directory resolves
npm test                       # deploy invariants + migration safety
npm run test:smoke             # renders every route in jsdom (needs jsdom)

npx wrangler d1 migrations apply DB --local   # schema on a local D1
npm run dev:api                # Worker on :8787
npm run dev                    # web on :3000
```

`npm run test:smoke` needs `npm i --no-save jsdom`; it mounts the real `App` and
walks every tab **and** every CHRTV rollback surface
(`playz_home_legacy`, `playz_tv_legacy`, `playz_sports_legacy`,
`playz_community_legacy`) so a broken lazy import is caught here rather than in
production.

---

## 6. Domains

No hostname is hardcoded into a wrangler config. Custom domains are attached
in the dashboard so one config can serve any environment:

**Dashboard → Workers & Pages → `<worker>` → Settings → Domains & Routes → Add
→ Custom domain**

The application also keeps its own hostnames configurable:

| Where | Variable | Default |
|---|---|---|
| `apps/web/src/services/config.js` | `VITE_PRODUCTION_API_BASE` | `https://thelac.dpdns.org` |
| `wrangler.toml` `name` | — | **must equal your Workers Builds Worker name** |
| `apps/web/vite.config.js` (dev proxy only) | `VITE_API_ORIGIN` | `https://thelac.dpdns.org` |
| `apps/admin/src/api.js` | `VITE_WEB_APP_URL` | the admin's own origin |
| both apps | `VITE_API_BASE` | empty = same origin |
| Worker `[vars]` | `PUBLIC_WEB_ORIGIN` | `https://thelac.dpdns.org` |
| Worker `[vars]` | `PUBLIC_ADMIN_ORIGIN` | *(empty)* |
| Worker secret/var | `CORS_ALLOWED_ORIGINS` | the built-in list |

`VITE_*` values are read at **build** time — set them in Cloudflare's build
variables, not as Worker secrets.

---

## 7. Rollback

```bash
npx wrangler rollback                       # chrtv-ott
npx wrangler rollback -c wrangler.admin.toml
npx wrangler deployments list
```

Because the consumer, admin and API are separate Workers, a bad front-end build
can be rolled back without touching the API and vice versa.

---

## 8. If something is wrong

| Symptom | Check |
|---|---|
| Build fails with no useful log | Read the build log at the link GitHub posts on the check. The Workers Builds project is `playz` while `wrangler.toml` says `chrtv-ott` — see §2 Step 1 |
| Build succeeds, site unchanged | The `name` in the wrangler config does not match the Worker your domains are attached to |
| `assets.directory does not exist` | `npm run build` then `npm run verify:assets` |
| Build is slow / deploys twice | Dashboard build command must be `npm ci`, not `npm run build` |
| 404 on the whole site | Custom domain not attached, or attached to the wrong Worker |
| Admin 401s everywhere | Admin origin missing from the API Worker's `CORS_ALLOWED_ORIGINS` |
| `d1 migrations apply` fails on a column | Run `npm run db:migrate:local` first; if the remote DB has never been served by the current Worker, hit the site once so `ensureSchema()` converges, then retry |
| Old APK / web cannot play | `npx wrangler secret put PUBLIC_STREAM_URL` → `1` (emergency, disables stream protection) |
