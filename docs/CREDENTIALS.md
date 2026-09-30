# playZ — required accounts, credentials and Cloudflare resources

> Everything on this page must be supplied by the owner. None of it can be
> generated from inside the repository. PlayZ ships **no default secret
> values** — a missing secret produces an explicit error instead of silently
> falling back to a shared or leaked key.

Legend: ✅ already exists in CHRTV · ⚠️ must be rotated · 🆕 must be created

---

## 1. Blocking questions (cannot be answered from the code)

### 1.1 Cloudflare topology
`thelac.dpdns.org` is a subdomain of a **public suffix domain that the owner
does not own** (`dpdns.org` is a shared dynamic-DNS provider, like DuckDNS).
Cloudflare Workers custom domains require the zone to be in the owner's
Cloudflare account.

Choose one:

| Option | What it needs | Trade-off |
|---|---|---|
| **A. Own the zone** (recommended) | Delegate `thelac.dpdns.org` to Cloudflare via NS records, or move to a domain you own and point `thelac.<yourdomain>` at Cloudflare | Full Workers custom-domain support, proper TLS, cleanest routing |
| **B. Workers route on an existing zone** | An existing Cloudflare zone (e.g. `ankb.qzz.io`) + a CNAME from `thelac.dpdns.org` | Works today; the consumer hostname stays a CNAME, and `admin.` needs its own CNAME |
| **C. Cloudflare Pages** | Both hostnames as Pages custom domains via CNAME | Pages supports custom domains on external hostnames more permissively |

> **Question for the owner:** which of A/B/C, and is `dpdns.org` delegation
> possible, or should playZ move to a domain you fully control?

### 1.2 Worker layout
- **One Worker** serving both hostnames, branching on `Host` header, with the
  admin bundle served only on `admin.*` — simplest, one deploy, one secrets set.
- **Two Workers** (`playz-api` + `playz-admin`) sharing the same D1 binding —
  stronger isolation, two deploys, secrets duplicated.

> **Question:** one Worker or two?

---

## 2. Secrets inventory

Run once per secret: `npx wrangler secret put <NAME>`
Generate values: `openssl rand -base64 48`

### 2.1 Core authentication — 🔴 required before any deploy
| Name | Purpose | Note |
|---|---|---|
| `JWT_SECRET` | signs session JWTs | ⚠️ rotating only revokes sessions |
| `PASSWORD_PEPPER` | separate pepper for password hashes | ⚠️ **rotating invalidates every password** unless the old value is listed in `LEGACY_PASSWORD_PEPPERS` |
| `STREAM_TOKEN_SECRET` | HMAC for short-lived playback tokens | |

### 2.2 Admin — 🔴 required
| Name | Purpose |
|---|---|
| `ADMIN_MASTER_TOKEN` | break-glass admin access; make it long and random |
| `ADMIN_ALLOWED_CIDRS` | optional IP allowlist, e.g. `1.2.3.4/32`; empty = no restriction |

### 2.3 Streaming — 🟡 required for premium channels
| Name | Purpose |
|---|---|
| `STREAM_MODE` | `direct` (default) / `auto` / `proxy` |
| `PROTECT` | `on` to enable AES-128 segment encryption |
| `PROXY_ALLOWED_HOSTS` | SSRF allowlist for the proxy |
| `LICENSE_SECRET` | must match the license worker |
| `LICENSE_BASE` | license server base URL |
| `UPSTREAM_UA_DEFAULT` | fallback User-Agent for stubborn upstreams |

> ⚠️ `STREAM_MODE=proxy` makes the Worker carry video bandwidth. On the free
> plan this will blow through the daily request budget quickly. Keep `direct`
> unless there is a specific reason not to.

### 2.4 Third-party APIs
| Name | Purpose | Source | Status |
|---|---|---|---|
| `TMDB_KEY` | movie/TV metadata — **required for the Movies section** | themoviedb.org/settings/api | ⚠️ A working key is committed (owner's decision). Set this secret to override it without touching code. |
| `TSDB_KEY` | TheSportsDB scores | thesportsdb.com | ✅ |
| `BREVO_API_KEY` | verification + password-reset email | brevo.com | ✅ |
| `BREVO_SENDER_EMAIL` | from-address | use `noreply@thelac.dpdns.org` | ✅ |
| `BREVO_SENDER_NAME` | display name | `playZ` | ✅ |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | health alerts | @BotFather | optional |
| `GITHUB_RAW_TOKEN` | only if a playlist lives in a private repo | github.com | optional |

### 2.5 Web push (VAPID)
| Name | Purpose |
|---|---|
| `VAPID_PUBLIC_KEY` | exposed to the client |
| `VAPID_PRIVATE_KEY` | server only |

Generate a P-256 keypair, or let the Worker create one on first use and store
it in KV (the existing implementation already has `getVapidKeys`).

### 2.6 Community / realtime
| Name | Purpose |
|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://thelac.dpdns.org,https://admin.thelac.dpdns.org` |
| `CHAT_SLOWMODE_SECONDS` | default slow-mode interval |

---

## 3. Cloudflare resources to create

```bash
# 1. D1 — application data
npx wrangler d1 create playz-db          # → copy database_id into wrangler.toml

# 2. KV — EPG + config cache
npx wrangler kv namespace create PLAYZ_KV

# 3. R2 — user/admin uploads (avatars, community images, ad creatives)
npx wrangler r2 bucket create playz-uploads

# 4. Durable Objects — live chat (only if DO-based chat is chosen)
#    no CLI step; declared in wrangler.toml and created on first deploy
```

Then fill in `wrangler.toml`:
- `[[d1_databases]] database_id`
- `[[kv_namespaces]] id`
- `[[r2_buckets]] bucket_name`
- `[vars]` — non-secret config
- `routes` / `custom_domain` for both hostnames once §1.1 is decided

---

## 4. Migration data (optional but valuable)

If the production CHRTV D1 dataset should be carried over:

```bash
# export the existing database
npx wrangler d1 export chrtv-db --remote --output=chrtv-backup.sql

# import into playZ
npx wrangler d1 execute playz-db --remote --file=chrtv-backup.sql
```

Tables are named identically, so a straight import works. Migrations in
`worker/migrations/` are **additive only** — no table is dropped or renamed, so
existing accounts, watch history, favourites, plans and device links survive.

> **Note:** the legacy `schema.sql` is stale — it lists 32 tables while the
> Worker's `ensureSchema()` creates many more at runtime. Migrations must be
> derived from the Worker, not from `schema.sql`.

---

## 5. Android / APK signing (only if the APK is rebuilt)

| Name | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of the release keystore |
| `CHRTV_KEYSTORE_PASSWORD` → rename to `PLAYZ_KEYSTORE_PASSWORD` | keystore password |
| `CHRTV_KEY_ALIAS` → `PLAYZ_KEY_ALIAS` | key alias |
| `CHRTV_KEY_PASSWORD` → `PLAYZ_KEY_PASSWORD` | key password |

> If the app id changes from `com.chrtvplay.app`, existing installs will not
> upgrade in place — they install side by side. Keep the original app id if
> in-place upgrade matters; only the display name needs to become playZ.

---

## 6. What I need from you to proceed

1. Cloudflare topology decision (§1.1) and Worker layout (§1.2).
2. Confirmation that the leaked TMDB key has been revoked and a new one issued.
3. Confirmation that the leaked Stream-Engine admin token has been rotated.
4. Whether to migrate the live CHRTV D1 dataset into playZ.
5. Whether the Android app id should stay `com.chrtvplay.app` (in-place upgrade)
   or become `com.playz.app` (clean break, side-by-side install).
6. The reference screenshots mentioned in the brief — not attached yet.
