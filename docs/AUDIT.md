# CHRTV Play — Repository Audit

> Phase 1 deliverable for the **playZ** migration.
> Source of truth: `ankbuitv/ott` @ `0493309` (2496 commits, 2026-09-25).
> Every claim below was verified against the working tree, not inferred from the README.

---

## 0. Snapshot

| Metric | Value |
|---|---|
| Tracked files | 269 |
| Working-tree size (no `.git`) | 6.5 MB |
| Commits | 2,496 |
| Pull requests | 28 (27 merged, **#27 open**) |
| Branches | `main` + 28 `arena/*` |
| Frontend LOC (`src/`) | 25,667 JS/JSX · 18,941 JSX |
| Backend | `worker/worker.js` — **7,737 lines**, 484 KB, single file |
| API endpoints | **271 unique paths** |
| D1 tables | 32 |
| React components | 61 |
| Services | 32 |
| Contexts | 6 · Hooks 5 |
| Android | Capacitor 7, appId `com.chrtvplay.app` |
| License | MIT |

Languages by volume: JavaScript 2.00 MB · HTML 287 KB · Shell 40 KB · CSS 40 KB · Java 1.3 KB · Python 1 KB.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Build | Vite 6, PostCSS, `@tailwindcss/postcss` + Tailwind 3.4 |
| UI | React 18.3 (no framework router) |
| Player | **Shaka Player 4.16** (HLS + DASH) with `hls.js 1.7` fallback |
| TV navigation | `@norigemedia/react-spatial-navigation` (D-pad) |
| Icons | `lucide-react` |
| QR | `jsqr` + `qrcode.react` |
| XML | `fast-xml-parser` (EPG parsing) |
| Native | Capacitor 7 (`@capacitor/android`, `cli`, `core`) |
| Backend | Cloudflare Workers (single module worker) |
| Data | D1 (SQLite) + KV (EPG cache) |
| CI | GitHub Actions → signed release APK → GitHub Release (tag `latest`) |

No TypeScript. No test runner in `package.json` (test scripts are ad-hoc `node scripts/*.mjs` checks).
No `react-router` — navigation is **state-based** via a single `activeTab` string.

---

## 2. Routing model (critical for migration)

`src/App.jsx` (778 lines) is the de-facto router. It holds:

- `activeTab` — persisted to `localStorage['chrtv_tab']`, seeded from URL `?tab=`/hash
- deep-link params: `?channel=`, `?party=`, `?gift=`, `?u=` (public profile), `?movie=`, `?viewCountry=`
- global overlays: splash, PIN gate, `ProfileGate`, `KidsShell`, admin page, settings page

Gates evaluated in order: **PIN lock → profile gate → kids shell → main shell**.
`goTab()` is the single navigation primitive passed down everywhere.

> **Migration consequence:** a real router must be introduced carefully. Every legacy
> deep link listed above must keep resolving, or shared links and the Android app break.

---

## 3. Backend surface (`worker/worker.js`)

271 routes. Grouped:

| Group | Count | Examples |
|---|---|---|
| `/api/*` | ~120 | playlist, epg, stream/token, stream/proxy, favorites, history, plans, payments, comments, fan-groups, gifts, codes, presence, watch-party, ratings, shorts, sports, movies, tmdb, geo |
| `/admin/*` | ~110 | users, channels, epg-overrides, watermark, themes, ads, broadcasts, payments, plans, analytics, audit, reports, scheduled, movie_sources, channel-health, player-errors |
| `/auth/*` | ~15 | login, register, verify, reset, 2fa, sessions, qr/{request,approve,poll} |
| `/user/*` | ~15 | profile, plans, sub-profiles, watchlist, onboarding |
| `/lic` | 1 | AES-128 segment license server |

### Backend subsystems found

**Auth & identity**
- Custom HMAC-SHA256 JWT (`generateJWT` / `verifyJWT`), TTL-based
- Password hashing with a **dedicated `PASSWORD_PEPPER`**, decoupled from `JWT_SECRET`
- Legacy secret support: `LEGACY_JWT_SECRETS`, `LEGACY_PASSWORD_PEPPERS` → seamless re-hash on login
- Session revocation via a real `sessions` table
- **2FA TOTP** (RFC 6238, `base32Encode/Decode`, `verifyTOTP` with ±1 window)
- Login rate-limit: 5/account or 20/IP → 15-min lockout
- Email verification via Brevo; falls back to an on-screen `devCode` when `BREVO_API_KEY` is unset
- Email password reset with a token template
- `ADMIN_MASTER_TOKEN` break-glass path; `ADMIN_ALLOWED_CIDRS` allowlist

**Authorization**
- Roles observed: `admin`, plus a `moderator`-adjacent concept in community features
- `logAudit(env, userId, action, detail)` exists and is already wired to admin mutations
- Admin gates are server-side in the worker (good) but the admin UI is a **hidden tab inside
  the consumer app**, gated only by `user?.role === 'admin'` — needs to become a real app

**Streaming**
- Three modes: `direct` (current default), `auto`, `proxy` — selected by `STREAM_MODE`
- `/api/stream/token` issues a 60-s HMAC playback token; server enforces login + plan + preview quota
- **Opaque token** = AES-GCM-256 sealed payload carrying the real upstream URL
- `stream-protect.js` (212 lines) + `license-worker.js` (277 lines) = AES-128 segment encryption + license server
- Upstream credential store for premium `.mpd` channels (`?token=` appended server-side)
- Per-plan channel gating by group rank (vtv/box/sport/film/all)
- SSRF defence: proxy **host allowlist**, `PROXY_ALLOWED_HOSTS`
- `X-CHRTV-Upstream-Error` → client retries direct on 502

**EPG**
- `parseEPGXml` (fast-xml-parser), KV cache TTL 3600 s, D1 `epg_cache` fallback
- `mergeEPGOverrides` — admin per-channel corrections
- `generateMockEPG()` — synthetic fallback so the grid is never empty
- `/api/epg` returns `{data:{programmes}}`; client also has a direct-XML path
  (`epg.io.vn`, `lichphatsong.io.vn`) and a per-user custom EPG source in localStorage

**Media & metadata**
- TMDB proxy with edge cache (`handleTMDBProxy`) to hide the API key
- Geo-aware movie region (`/api/geo`, `request.cf.country`, timezone fallback)
- 6 built-in embed sources, duplicated server-side (`BUILTIN_MOVIE_SOURCES`) and
  client-side (`BUILTIN_SOURCES`) — deliberate two-layer redundancy
- Admin-managed `movie_sources` table + CSP `frame-src` allowlist

**Sports**
- Two upstreams proxied through the worker: **TheSportsDB** (`tsdb`) and **ESPN**
- `cachedUpstream` with edge Cache API
- Client also reads them through `src/services/sports.js` (541 lines) + `tsdb.js`

**Realtime / social**
- `watch_party` polling over D1 (`/api/presence`, `/api/realtime`)
- Community: comments, fan-groups, ratings, XP/achievements, public profiles
- Web Push **VAPID** implemented in-worker (ECDSA P-256 JWT, subscription storage)
- Notifications table + admin broadcast

**Monetisation**
- 5 plans: Standard → Recreational → Ultimate → Elite → Signature (rank 1–5)
- `Payments`: order creation + **SePay webhook** + admin confirmation; VietQR config table
- Gift codes, share codes (6-char), referral/affiliate
- Pre-roll ads (migration: 5/hr, per-plan skip thresholds)
- 5-min preview window for Standard on out-of-plan channels

**Ops**
- `ensureSchema(env)` — worker self-bootstraps all tables on first request
- Rate limiting in D1 with in-memory fallback
- Channel health checks + `/status` + player-error telemetry
- `clientErrors.js` — global JS/render error reporting back to the admin console
- `contentGuard.js` — runtime content protection

---

## 4. D1 schema (32 tables)

`users`, `sessions`, `user_settings`, `user_favorites`, `watch_history`, `channels`,
`site_config`, `channel_watermark`, `channel_ratings`, `notifications`, `analytics`,
`program_reminders`, `epg_cache`, `epg_overrides`, `m3u_sources`, `broadcasts`,
`user_profiles`, `watch_counters`, `presence`, `user_xp`, `public_profiles`, `comments`,
`fan_groups`, `fan_members`, `gift_codes`, `gift_redemptions`, `user_plans`, `payments`,
`payment_config`, `ads`, `scheduled_posts`, `predictions`.

Plus tables created at runtime by `ensureSchema` that are **not** in `schema.sql`:
`channel_reports`, `player_errors`, `share_codes`, `movie_progress`, `followed_series`,
`creator_stars`, `short_comments`, `shorts`, `challenge_*`, `affiliates`, `realtime_*`,
`site_themes`, `newsletter`, and more.

> **Migration consequence:** `schema.sql` is stale relative to `ensureSchema`.
> Migrations must be generated from the worker's own DDL, not from `schema.sql`.

---

## 5. Content sources (real, as configured)

**Playlist** — `playlists/tv.m3u`, 74 KB, **181 channels** across 7 groups:

| Group | Channels |
|---|---|
| `TH - Vietnamese Channels` | 101 |
| `🎬 BOX - International Channels` | 44 |
| `⚽ SPORTS - Thể thao` | 14 |
| `Sự Kiện VTVPrime` | 12 |
| `Asian Games Aichi-Nagoya 2026` | 9 |
| `mediacorp-asiad` | 7 |
| `Thể Thao` | 1 |

Upstream hosts seen: `devda.undo.it` (84), `raw.githubusercontent.com` (50),
`tshift.fptplay.net` (18), `vips-livecdn.fptplay.net` (12), `vtvprime.vn` (12),
`api.vthanhtivi.pw` (12), `s2129134.cdn.mytvnet.vn` (11), `sv.cvtv.xyz:3000` (11),
`freem3u.xyz` (15).

**Remote playlist** — `https://cdn.ankb.qzz.io/tv.m3u` (worker default source)
**EPG** — `https://epg.io.vn/epgc.xml`
**Fallback stream** — `http://bore.pub:30113/hls/index.m3u8`
**Movies** — TMDB metadata + 6 third-party embed players

> ⚠️ Mixed provenance: FPT Play CDN, MyTV CDN, VTV Prime, plus public aggregator mirrors.
> Redistribution rights for some entries are unverified. Flagged in `docs/SECURITY-NOTES.md`;
> the migration does **not** alter or re-host any upstream content.

---

## 6. Feature inventory (user-facing)

Verified as implemented, not aspirational:

**Watch** — Live TV; EPG 7-day grid (past + future); catch-up playback; timeshift;
movie & TV-show catalog (TMDB); seasons/episodes; continue-watching with cross-device
progress; My List; recommendations; trailer mode when no source resolves.

**Sports** — fixtures, live scores auto-refresh 60 s, standings, F1/motorsport,
match detail modal, team detail modal, predictions/quiz.

**Shorts** — dedicated vertical feed, creator stars, short comments, admin curation.

**Community** — posts/feed, comments, fan groups, watch party (chat + reactions),
public profiles with handles, XP/achievements, ratings.

**Account** — registration, email verification, login, 2FA, password change & reset,
session revocation per device, sub-profiles (Netflix-style, incl. child profiles),
kids shell, PIN lock, onboarding quiz, language picker (5 languages), settings sync,
notification centre, Web Push opt-in.

**Monetisation** — plan ladder, package purchase flow, VietQR + SePay, gift codes,
share codes, referrals/affiliates, pre-roll ads, preview window.

**Device / handoff** — **QR login is real**: `/auth/qr/request`, `/auth/qr/approve`,
`/auth/qr/poll`, with `QrScanner.jsx` (camera + 6-char manual entry). Also share-code
"enter code" to jump to a title, and deep links `?channel=&party=&gift=&movie=`.

**Other** — Shorts, racing section, sleep timer, keyboard shortcuts, data-saver ≤480p,
network-quality auto-downgrade, multi-language, theme decorator for events,
watermark overlay, broadcast banner, download-app modal, legal modals, share sheets,
report-channel, status page.

---

## 7. Documentation already in repo (19 files)

`README.md`, `50_TINH_NANG_DE_XUAT.md` (50 proposals), `KE_HOACH_33_TINH_NANG.md`
(33 selected features), `CHONG_RIP_STREAM.md`, `CHONG_CRASH.md`, `BAO_VE_LUONG.md`,
`TOKEN_KENH_MPD.md`, `LOGO_WATERMARK.md`, `SECURITY_FIX_RUNBOOK.md`,
`SECURITY_ACCEPTANCE_RESULTS_local.md`, `DANG_NHAP_TROUBLESHOOT.md`, `EMAIL.md`,
`TMDB.md`, `TAI_APK.md`, `QUANG_CAO_VA_XEM_THU.md`, `DEPLOY_SAU_MERGE.md`,
`docs/PACK48_BUILD.md`, `TAI_APK.md`, plus `ci/build-android.yml`.

---

## 8. 🔴 Security findings (must be resolved before/at cutover)

### F1 — `.env` is tracked in Git, with a live TMDB key (P0)
`.gitignore` lists `.env` but the file is **committed** (first added 2026-08-23,
commit `79d2a97`). The same key is also duplicated into the public `.env.example`.
Anyone can consume the owner's TMDB quota. Git history retains it → rotation is mandatory,
not optional.

### F2 — Stream-Engine admin token printed verbatim (P0)
`SECURITY_FIX_RUNBOOK.md` documents that this token leaked and grants full admin on
`sg001-…` / `sg002-…`, yet the same file (plus `README.md` line 47 and
`SECURITY_ACCEPTANCE_RESULTS_local.md`) still prints it. The acceptance file shows
check `[2]` ("old token must fail") with **no recorded result**.

### F3 — Infrastructure disclosure (P2)
`SECURITY_FIX_RUNBOOK.md` and `wrangler.toml` reveal engine hostnames, premium channel
paths, the D1 `database_id`, and the full secret-name inventory
(`JWT_SECRET`, `LICENSE_SECRET`, `ADMIN_MASTER_TOKEN`, `TELEGRAM_BOT_TOKEN`, …).

### F4 — Positive findings (keep these)
`PASSWORD_PEPPER` decoupled from `JWT_SECRET`; CORS allowlist instead of `*`;
SSRF host allowlist; CSP incl. `frame-src` allowlist; parameterised SQL throughout;
`Permissions-Policy` locking camera/mic/geo/payment; SVG upload sanitisation
(strips script/handler/external link); rate limiting; audit log.

---

## 9. What the audit changes about the plan

1. **Do not start from a blank slate.** The worker's 271 endpoints, 32+ tables and
   auth stack are the product's value. playZ is a **rebrand + re-shell + selective
   refactor**, not a rewrite.
2. **The single 7,737-line worker must be split into modules** — this is the highest-value
   structural change, and it is what makes the rest safe to iterate on.
3. **The admin must become a separate application.** Today it is a tab in the consumer
   bundle, so every consumer visitor downloads the full admin UI.
4. **A real router must replace `activeTab`** without breaking the ten or more legacy
   deep-link parameters.
5. **`schema.sql` is not authoritative** — migrations must derive from `ensureSchema`.
6. **QR login and 5-plan monetisation genuinely exist** → preserve, do not rebuild.
7. **F1 and F2 must be fixed as part of cutover**, and the owner must rotate credentials
   regardless of what the code does.
