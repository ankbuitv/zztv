# playZ

Premium OTT platform — consumer app, admin app, and Cloudflare Workers API.

Migrated from **CHRTV Play** (`ankbuitv/ott`). This is an evolution of a working
production product, not a rewrite: the backend, database and authentication were
preserved, and the product was rebranded and re-shelled around them.

| | |
|---|---|
| Consumer | `https://thelac.dpdns.org` |
| Admin | `https://admin.thelac.dpdns.org` |
| Previous deployment | `https://play.ankb.qzz.io` |

> **Deploying?** Start with **[`DEPLOY.md`](DEPLOY.md)** for the build layout,
> the Cloudflare Workers Builds settings and the migration procedure, and
> **[`docs/SECRETS.md`](docs/SECRETS.md)** for every secret and variable.

> **Status: foundation phase.** See §5 for what is done versus what is next.
> The Cloudflare configs and the migration set are in place; no credentials are
> committed to this repository.

---

## 1. Documentation map

| Document | Contents |
|---|---|
| [`docs/AUDIT.md`](docs/AUDIT.md) | **Phase 1** — full audit of CHRTV Play: stack, 271 endpoints, 32 tables, every feature, content sources, security findings |
| [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md) | **Phase 2** — target architecture, and how each legacy feature is classified (KEEP / KEEP+REDESIGN / REFACTOR / REPLACE / DEPRECATED) |
| [`DEPLOY.md`](DEPLOY.md) | **Deploy runbook** — where each build lands, the Workers Builds settings, migrations, rollback |
| [`docs/SECRETS.md`](docs/SECRETS.md) | **Every secret and variable**, per Worker, with how to set and rotate each one |
| [`docs/CREDENTIALS.md`](docs/CREDENTIALS.md) | Every account, secret and Cloudflare resource required to deploy |
| [`docs/SECURITY-NOTES.md`](docs/SECURITY-NOTES.md) | Findings, what was fixed, what the owner must still rotate |
| [`docs/brand-preview.png`](docs/brand-preview.png) | The playZ identity on real surfaces |
| [`docs/legacy-*.md`](docs/) | The original CHRTV operational documentation, carried over and redacted |

---

## 2. Repository layout

```
zztv/
├── apps/
│   ├── web/                    consumer application  → thelac.dpdns.org
│   │   ├── src/                116 files migrated from CHRTV (imports intact)
│   │   └── public/brand/       playZ SVG + real PNG exports
│   └── admin/                  admin application     → admin.thelac.dpdns.org
├── packages/shared/            design tokens, API client, i18n (planned)
├── worker/
│   ├── worker.js               the API — 271 routes (to be split into routes/)
│   ├── stream-protect.js       AES-128 segment encryption
│   ├── license-worker.js       license server
│   └── migrations/             superseded — see the note in §6
├── migrations/                 D1 migrations (0000_baseline, 0001_seed_plans)
├── docs/                       audit, plan, credentials, secrets, security, brand
├── scripts/                    build tools, deploy checks, brand builder, secret scanner
├── playlists/tv.m3u            181 live channels
├── android/                    Capacitor project
├── wrangler.toml               consumer app + API   (chrtv-ott)  → apps/web/dist
├── wrangler.admin.toml         admin app            (playz-admin) → apps/admin/dist
├── wrangler.api.toml           API only, no assets  (chrtv-api)
├── wrangler.license.toml       license server       (chrtv-license)
└── wrangler.dev.toml           local Worker (no assets, never deployed)
```

### Build outputs

Each Vite build runs inside its own workspace and writes to that workspace's
`outDir`. **There is no root `dist/`**, and each wrangler config points at the
directory its own build produces:

| Workspace | Command | Output |
|---|---|---|
| `@playz/web` | `npm run build:web` | `apps/web/dist` |
| `@playz/admin` | `npm run build:admin` | `apps/admin/dist` |
| API Worker | — | `worker/worker.js` (no static assets) |

`npm run verify:assets` fails locally if any `assets.directory` does not exist,
which is the check that would have caught the `assets.directory does not exist:
/opt/buildhome/repo/dist` production failure before it ever reached Cloudflare.

---

## 3. Getting started

Requires Node ≥ 20.

```bash
npm install                 # installs all workspaces

npm run dev                 # consumer app   → http://localhost:3000
npm run dev:admin           # admin app      → http://localhost:3100
npm run dev:api             # Worker + local D1 → http://127.0.0.1:8787

# point a dev server at a local Worker instead of production:
VITE_DEV_API_TARGET=http://127.0.0.1:8787 npm run dev
```

Both apps default to the production API, which is the right thing on a machine
that can reach it. Where it cannot — a sandbox, a plane, an offline laptop — the
symptom is not an obvious error: Vite's proxy turns every `/api/*` request into a
500, the page still loads, and the app renders empty states as though there were
simply no content.

Run against the fixture instead. It serves generated channels, EPG, catalogue,
sports, community and short clips from memory, and nothing in it is deployed:

```bash
npm run dev:fixture         # fixture API on :8788 (leave running)

VITE_DEV_API_TARGET=http://127.0.0.1:8788 npm run dev
VITE_DEV_API_TARGET=http://127.0.0.1:8788 npm run dev:admin

npm run dev:offline         # or: fixture + consumer app in one command
```

`npm run dev:fixture` also proxies artwork and serves real vertical clips for
Shorts. Regenerate those clips after a clone with:

```bash
node tools/make-fixture-media.mjs   # needs ffmpeg on PATH for the video
```

Other scripts:

```bash
npm run build               # build both apps
npm run build:web           # consumer only
npm run brand               # regenerate every logo asset from scripts/build-brand.mjs
npm run secrets:check       # fail the build if a secret is ever committed
```

### Two constraints that are not obvious

**React is pinned at the workspace root.** `react` and `react-dom` are declared
in the root `package.json`, and both Vite configs dedupe them. This is not
tidiness. The legacy TV-navigation dependency pins React 16, and without the
root declaration npm hoists that copy upward — at which point `react-dom@18`
resolves *it*, the renderer drives React 16's hook dispatcher, and the app mounts
nothing but a black background. If you add a dependency that wants an older
React, leave the root pin alone and let the duplicate nest.

**`packages/shared` is the intended home for the design tokens.** `apps/web`
and `apps/admin` currently each carry their own copy, which is why they can
drift. Moving them is planned, not done.

### Configure

```bash
cp .env.example .env        # then fill in values
```

A missing secret produces an explicit error at runtime. There is **no fallback
default**, by design — see `docs/SECURITY-NOTES.md` F1.

---

## 4. The playZ identity

Original **ZZ broken-ring monogram**: two Z letterforms sharing a middle bar,
inside a ring whose stroke is cut in two places on the diagonal.

- Geometry only — not traced, not adapted from any existing brand
- Monochrome: black/white primary, colour belongs to the UI
- The wordmark **playZ** is drawn as vector paths, not set in a font, so it
  renders identically everywhere and the Z reuses the mark's construction

Every asset is generated from one source (`scripts/build-brand.mjs`), so the SVG
and the raster exports can never drift apart:

```bash
npm run brand                       # writes all SVG + PNG assets
node scripts/brand-preview.mjs      # renders docs/brand-preview.png for review
```

| Asset | Path |
|---|---|
| Symbol (colour-inheriting) | `apps/web/public/brand/playz-symbol.svg` |
| Symbol on dark / light | `playz-symbol-dark.svg` · `playz-symbol-light.svg` |
| Lockup | `playz-logo.svg` · `-dark` · `-light` |
| PNG exports | `playz-symbol-{1024,512,192,64}.png` · `playz-logo-{dark,light}.png` |
| Favicon | `favicon.ico` (64/32/16) · `favicon.svg` |
| PWA | `pwa-{192,512}.png` · `maskable-{192,512}.png` · `apple-touch-icon.png` |

Small sizes use simplified cuts: **bold** at 32–64px and a **ZZ-only** mark at
16px, because a ring plus a ligature collapses into mud below ~24px.

### Accent semantics

| Colour | Token | Meaning |
|---|---|---|
| Blue | `#2F6BFF` | brand + primary action |
| Orange | `#FF6B2C` | major CTA, promotional, live-action |
| Yellow | `#FFC53D` | premium, rating, awards |
| Red | `#FF3B47` | live, destructive, urgent |

---

## 5. Status

### Done

- ✅ **Phase 1** — full repository audit (`docs/AUDIT.md`)
- ✅ **Phase 2** — architecture and migration plan (`docs/MIGRATION-PLAN.md`)
- ✅ npm workspaces established; `apps/web` builds clean (2.77 MB JS)
- ✅ Consumer app migrated — 116 files, all relative imports intact
- ✅ **Secrets removed** — leaked TMDB key (which was in three places, including
  hardcoded in the Worker) and the leaked admin token are gone; `handleTMDBProxy`
  now fails explicitly when `TMDB_KEY` is unset
- ✅ `npm run secrets:check` — dependency-free scanner, wired for CI
- ✅ **Phase 3 (brand)** — original identity, 21 assets, SVG + genuine PNG
  exports, favicon tuned and visually verified at 16/32/64px
- ✅ Legacy operational docs carried over and redacted

### Next, in order

| # | Phase | Notes |
|---|---|---|
| 4 | App shell — sidebar, header, router, responsive | replaces state-based `activeTab` while preserving every deep link |
| 5 | Home — cinematic hero, configurable rails, Top 10 | |
| 6–11 | Movies/player · Live TV + EPG · Sports · Shorts · Community + chat · Account/auth/pairing/packages | |
| 12–13 | PWA · **Admin application** | admin moves out of the consumer bundle |
| 14–16 | Security, performance, accessibility · deployment · regression | |

### Known limitations

- `worker/worker.js` is still one 7,700-line file — the split into `routes/` and
  `lib/` is planned but not done.
- The consumer bundle was one 2.86 MB (865 KB gzipped) chunk. It is now
  route-split: the entry chunk is ~183 KB and the initial load is ~510 KB raw
  (~163 KB gzipped), with hls.js, shaka-player, jsqr and the QR/XML libraries
  fetched on first use. `npm test` fails if a chunk creeps back over 900 KB.
- `npm test` (`scripts/deploy-check.mjs`) covers the deploy invariants: wrangler
  config validity, `assets.directory` resolution, migration safety (including
  that the baseline loses no rows on a populated database), and the bundle
  budget. `npm run test:smoke` renders every route and every CHRTV rollback
  surface in jsdom. A browser-based test suite is still phase 16.
- The D1 database and its resources still have to be created and pointed at —
  see `docs/CREDENTIALS.md` §3 and `docs/SECRETS.md`.
- Reference screenshots mentioned in the brief were not provided; the layout is
  built from the written information architecture.

---

## 6. Deployment

Full runbook: **[`DEPLOY.md`](DEPLOY.md)**. Secrets:
**[`docs/SECRETS.md`](docs/SECRETS.md)**.

```bash
npm ci

# resources (once)
npx wrangler d1 create chrtv-db      # then put database_id into wrangler.toml
npx wrangler kv namespace create EPG_KV
npx wrangler r2 bucket create chrtv-private

# schema — migrations, never `d1 execute --file=schema.sql`
npm run db:migrate:remote

# deploy each surface independently
npm run deploy          # consumer app + API  → chrtv-ott
npm run deploy:admin    # admin app           → playz-admin
npm run deploy:api      # API only            → chrtv-api
npm run deploy:license  # license server      → chrtv-license
```

Each config runs its own `[build]`, so **do not** prefix these with
`npm run build` — that is the duplicate-build problem described in
[`DEPLOY.md`](DEPLOY.md) §2.

---

### Schema history

`schema.sql` at the repository root and `worker/migrations/000-legacy-schema.sql`
are **stale**: they describe 32 tables, while the Worker actually uses 78
(`SCHEMA_STATEMENTS` in `worker/worker.js`). They are kept for reference only.

The schema of record is `migrations/`, applied with
`npm run db:migrate:remote`. `migrations/0000_baseline.sql` is generated from
`worker/worker.js` and is additive-only, so applying it to the existing
production database is a no-op. `worker.js` still self-heals through
`ensureSchema()` on cold starts as a safety net.

---

## 7. Security

Three pre-existing issues were inherited as **leaks that were already public**,
not new bugs. Two are fixed in code; both still require the owner to rotate
credentials upstream. Details and the remaining work: `docs/SECURITY-NOTES.md`.

Never commit `.env`, never hardcode a secret, and run `npm run secrets:check`
before every push.
