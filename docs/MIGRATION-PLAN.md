# CHRTV Play → playZ — Migration Plan

> Phase 2 deliverable. Derived entirely from `docs/AUDIT.md`.
> Governing rule: **CHRTV is the source of truth for existing functionality.**
> Default classification when uncertain = **KEEP + REDESIGN**.

---

## 1. Target architecture

A **workspace monorepo** — two real applications plus a modularised worker, instead of
one bundle that contains the admin, and one 484 KB worker file.

```
zztv/                            (repo = playZ)
├── apps/
│   ├── web/                     consumer app   → thelac.dpdns.org
│   │   ├── src/                 (evolved from CHRTV src/ — imports stay intact)
│   │   ├── public/brand/        SVG + PNG identity
│   │   ├── index.html
│   │   └── vite.config.js
│   └── admin/                   admin app      → admin.thelac.dpdns.org
│       ├── src/
│       └── vite.config.js
├── packages/
│   └── shared/                  design tokens, API client, i18n core, types
├── worker/                      Cloudflare Worker
│   ├── index.js                 router only
│   ├── routes/                  one module per domain (auth, stream, epg, admin, …)
│   ├── lib/                     helpers: jwt, crypto, rate-limit, audit, cors
│   └── migrations/              D1 migrations (derived from ensureSchema, NOT schema.sql)
├── docs/
├── .github/workflows/
├── wrangler.toml
└── .env.example
```

**Why workspaces.** The spec requires the admin on its own subdomain with server-enforced
roles. Today the admin code ships inside the consumer bundle. Splitting removes admin
code from the consumer download, gives the admin an independent deploy, and lets both
apps share one API client and one token set — without rewriting 116 consumer files.

**Import-path safety.** The consumer `src/` tree moves as a unit, so all relative imports
inside it remain valid. Only build config paths change. This is the low-risk path to a
monorepo.

---

## 2. Classification of existing functionality

### KEEP — working backend/plumbing, no redesign needed
| Asset | Reason |
|---|---|
| All 271 worker endpoints | Core product value |
| Auth stack (JWT, `PASSWORD_PEPPER`, legacy-secret rotation, `sessions` table) | Correct and hard-won; F2 rotation only |
| 2FA TOTP | RFC 6238 compliant |
| Rate limiting (D1 + in-memory fallback) | Directly reusable for chat/community throttling |
| Stream token + AES-GCM opaque token + plan gating | Preserve exactly |
| `stream-protect.js`, `license-worker.js` | Preserve |
| SSRF host allowlist + CSP builder | Preserve |
| TMDB proxy + edge cache | Hides API key; keep |
| Sports proxies (TheSportsDB + ESPN) | Keep |
| Scheduler / `scheduled_posts` | Keep |
| Audit log | Extend, don't replace |
| Android/Capacitor project + CI APK workflow | Keep, renaming only |
| D1 tables and all user data | Preserve; additive migrations only |

### KEEP + REDESIGN — functionality stays, presentation is rebuilt
| Feature | New treatment |
|---|---|
| Home | Cinematic hero + configurable rails, admin-driven |
| Sidebar | Real collapsible sidebar 80 → 248 px, overlay backdrop |
| Header | Logo · search · language · notifications · app · subscribe · profile |
| Top 10 | Signature outlined-numeral rail, elevated |
| Movies / TV detail | Netflix × information-page hybrid |
| Player | Full visual redesign; keep Shaka/HLS parsing untouched |
| Live TV + EPG | Player left, EPG rail right; no page mini-player |
| Sports | Keep density; add sport selector + competition chips |
| Shorts | Desktop centred 9:16, mobile near-fullscreen |
| Community | Feed + realtime chat, split into two surfaces |
| Plans / packages | 3-step wizard with progress indicator |
| Notifications | Animated panel, read/unread, deep links |
| Account | Consolidated hub |
| Auth | Premium modal + dedicated responsive flow |
| QR login | **Already real** — restyle only |
| Watermark / ads / broadcast / gift codes | Preserved, restyled |

### REFACTOR — same behaviour, better structure
| Target | Action |
|---|---|
| `worker/worker.js` (7,737 lines) | Split into `routes/*` + `lib/*`, router-only `index.js` |
| `App.jsx` `activeTab` routing | Introduce a real router; preserve all `?channel/?party/?gift/?movie/?u/?tab=` deep links |
| Admin-in-consumer-bundle | Extract to `apps/admin` |
| `schema.sql` (stale) | Replace with generated `worker/migrations/*.sql` from `ensureSchema` |
| Design values scattered in JSX | Centralise into `packages/shared/tokens` |
| Repeated inline component CSS | Extract design primitives |
| `config.js` `PRODUCTION_API_BASE` hardcoded to `play.ankb.qzz.io` | Make env-driven |
| Dual movie-source list (client + worker) | Single source of truth, keep the safety fallback |
| i18n `translations.js` (1,040 lines) | Keep, extract to shared, add missing keys |

### REPLACE
| Removed | Replaced by |
|---|---|
| `public/templates/t01–t10.html`, `public/templates/mytv/*` | New playZ component library (verify no runtime reference first) |
| `preview/template-a–e.html` | Design explorations; archive, do not ship |
| `worker/worker-fixed.js` (23 lines, dead) | Delete after verifying no reference |
| `patch_worker.py` (one-shot migration script) | Move to `scripts/archive/` |
| CHRTV logo/watermark assets | playZ identity |

### DEPRECATED / DO NOT CARRY FORWARD
| Item | Reason |
|---|---|
| `.env` in git | Secret leak (F1) — remove from index, rotate, add to CI secrets |
| Leaked Stream-Engine admin token in docs | Secret leak (F2) — redact to `Ke•••2@`, rotate upstream |
| Stale `.env.example` carrying the real TMDB key | Replace with placeholders |
| `SECURITY_FIX_RUNBOOK.md` raw hostnames/paths | Redact to placeholders in the public repo |

---

## 3. Design system

### Identity
Original **ZZ broken-ring monogram**: two interlocking Z geometries inside a circle whose
outer stroke is intentionally cut in two places. Monochrome primary. Built as geometry
(no traced image), so it stays crisp at 16 px and scales to 1024 px.

### Palette
| Role | Token | Usage |
|---|---|---|
| Surface | OLED near-black `#08080A` | Backgrounds |
| Text | White / muted gray | Primary / secondary |
| **Blue** | Brand + primary action | Buttons, active nav, links |
| **Orange** | Major CTA, selected promo, certain live states | Checkout, hero primary |
| **Yellow** | Premium, rating, awards | Badges, stars |
| **Red** | Live, destructive, urgent | Live dot, errors, delete |

Gradients reserved for active navigation, marketing blocks, selected cards, glows.
Logo stays monochrome. No gaming aesthetic.

### Motion tokens
`instant 90ms` · `fast 180ms` · `base 240ms` · `slow 300ms` · `hero 700ms`
Easing: `standard cubic-bezier(.2,.8,.2,1)`, `spring-like cubic-bezier(.34,1.4,.64,1)`.
Animate **opacity/transform only**. Full `prefers-reduced-motion` bypass.

### Primitives to build
Button · IconButton · Modal · Drawer · Dropdown · Tooltip · Card · MediaCard · PosterCard ·
Rail · Tabs · Chip · Badge · Skeleton · Toast · Input · Switch · PlayerControls.

---

## 4. Legacy feature preservation contract

Before any removal: (1) locate the implementation, (2) determine usage, (3) map
dependencies, (4) confirm user data survives, (5) migrate or document why not.

**Data preservation — no destructive migration.**
Accounts, watch history, favorites, packages, device links, community data and settings
stay in the same D1 tables under additive-only migrations.

**Deep-link contract that must keep working:**
`?channel=` `?party=` `?gift=` `?movie=` `?u=` `?tab=` `?viewCountry=` + hash equivalents,
plus `localStorage` keys `chrtv_tab`, `chrtv_channels_v1`, `chrtv_settings`,
`chrtv_api_base`, `chrtv_unlocked`.

---

## 5. Execution phases

| # | Phase | Status |
|---|---|---|
| 1 | Repository audit | ✅ complete |
| 2 | Architecture / migration plan | ✅ this document |
| 3 | Design system + playZ identity + PNG exports | next |
| 4 | App shell — sidebar, header, router, responsive | |
| 5 | Home — hero + configurable rails | |
| 6 | Movies / detail / player | |
| 7 | Live TV + EPG | |
| 8 | Sports | |
| 9 | Shorts | |
| 10 | Community + live chat | |
| 11 | Account / auth / QR pairing / packages | |
| 12 | PWA | |
| 13 | Admin application | |
| 14 | Security, performance, accessibility | |
| 15 | Cloudflare deployment configuration | |
| 16 | Regression testing vs legacy | |

---

## 6. Open decisions requiring the owner

These cannot be settled from the repository alone:

1. **Cloudflare topology** — one Worker serving both hostnames, or two Workers sharing
   D1? And is `dpdns.org` delegated to a Cloudflare zone the owner controls (required for
   Workers custom domains on `thelac.dpdns.org` and `admin.thelac.dpdns.org`)?
2. **Reference screenshots** — the brief references them, but none are attached.
   Proceed from the written IA, or wait?
3. **Credentials** — which external accounts already exist and can be rotated/provisioned
   (TMDB, Brevo, SePay, TheSportsDB, Cloudflare account ID, VAPID keys)?
4. **Live TV provenance** — 181 channels mix official CDNs with public aggregator mirrors.
   Keep the list as-is (verified working, but rights unverified), or curate down to
   known-safe sources?

Detailed credential/resource checklist: `docs/CREDENTIALS.md`.
Security posture and required rotations: `docs/SECURITY-NOTES.md`.
