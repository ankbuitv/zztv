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

> **Status: foundation phase.** See §5 for what is done versus what is next.
> Nothing in this repository is deployed yet, and no credentials are configured.

---

## 1. Documentation map

| Document | Contents |
|---|---|
| [`docs/AUDIT.md`](docs/AUDIT.md) | **Phase 1** — full audit of CHRTV Play: stack, 271 endpoints, 32 tables, every feature, content sources, security findings |
| [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md) | **Phase 2** — target architecture, and how each legacy feature is classified (KEEP / KEEP+REDESIGN / REFACTOR / REPLACE / DEPRECATED) |
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
│   └── migrations/             D1 migrations (additive only)
├── docs/                       audit, plan, credentials, security, brand
├── scripts/                    brand builder, brand preview, secret scanner
├── playlists/tv.m3u            181 live channels
├── android/                    Capacitor project
└── wrangler.toml               Cloudflare configuration
```

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
- The consumer bundle is 2.77 MB (838 KB gzipped) with no code splitting. The
  admin UI is still inside it, which is the main thing the app split will fix.
- **No automated tests exist yet.** CHRTV shipped ad-hoc `node scripts/*.mjs`
  checks; a real test suite is part of phase 16.
- No `wrangler.toml` has been pointed at playZ resources yet — see
  `docs/CREDENTIALS.md` §3.
- The admin app directory is scaffolded but empty.
- Reference screenshots mentioned in the brief were not provided; the layout is
  built from the written information architecture.

---

## 6. Deployment (once credentials exist)

```bash
npx wrangler d1 create playz-db       # then put database_id into wrangler.toml
npx wrangler kv namespace create PLAYZ_KV
npx wrangler r2 bucket create playz-uploads

npx wrangler secret put JWT_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put STREAM_TOKEN_SECRET
npx wrangler secret put ADMIN_MASTER_TOKEN
npx wrangler secret put TMDB_KEY

npm run deploy
```

Full checklist, including the domain question that must be resolved first:
[`docs/CREDENTIALS.md`](docs/CREDENTIALS.md).

---

## 7. Security

Three pre-existing issues were inherited as **leaks that were already public**,
not new bugs. Two are fixed in code; both still require the owner to rotate
credentials upstream. Details and the remaining work: `docs/SECURITY-NOTES.md`.

Never commit `.env`, never hardcode a secret, and run `npm run secrets:check`
before every push.
