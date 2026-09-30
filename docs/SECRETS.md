# 🔐 Secrets & variables — playZ

Everything the Worker needs is listed here: what it is for, whether it is a
**secret** (encrypted, set per Worker) or a **variable** (plaintext, lives in
the wrangler config), and exactly how to set it.

> **The rule that matters most:** a value is a *secret* if it must never appear
> in the browser bundle. `JWT_SECRET` is a secret. `STREAM_MODE` is a variable.
> `VITE_*` is neither — it is baked into the JavaScript at build time and is
> public the moment the site loads, so a real credential must never go there.

---

## 1. How to set a secret

### Option A — dashboard (no CLI needed)

1. **Workers & Pages → `<worker>` → Settings → Variables and Secrets**
2. **Add** → **Secret**
3. Name it, paste the value, **Deploy**

The value is encrypted at rest and injected into the Worker at runtime. It
creates a new deployment version.

### Option B — CLI (needs `npx wrangler login`, or `CLOUDFLARE_API_TOKEN`)

```bash
npx wrangler secret put JWT_SECRET                                   # chrtv-ott
npx wrangler secret put LICENSE_SECRET -c wrangler.license.toml      # chrtv-license
```

`wrangler secret put` prompts for the value interactively — do not pass it as
an argument, or it lands in your shell history.

### Option C — from a file, all at once

Put the values in `.dev.vars` (git-ignored) and run:

```bash
npm run secrets:put            # main worker + license worker
npm run secrets:put -- main    # chrtv-ott only
npm run secrets:put -- lic     # chrtv-license only
```

### List and delete

```bash
npx wrangler secret list
npx wrangler secret delete PUBLIC_STREAM_URL     # names only; no value needed
```

---

## 2. `chrtv-ott` — the main Worker (`wrangler.toml`)

### Required — the app does not work without these

`worker/worker.js` throws a configuration error on the relevant route when any
of these is missing. There are no insecure fallbacks left in the code.

| Secret | Why | How to generate |
|---|---|---|
| `JWT_SECRET` | Signs session JWTs. Rotating it logs everyone out; nothing else breaks. | `openssl rand -base64 48` |
| `STREAM_TOKEN_SECRET` | HMAC for short-lived playback tokens. | `openssl rand -base64 48` |
| `PASSWORD_PEPPER` | Separate pepper for password hashes. **Never rotate blindly** — every existing password stops verifying. | `openssl rand -base64 48` |
| `ADMIN_MASTER_TOKEN` | Break-glass admin token for `/admin/*`. | `openssl rand -hex 32` |
| `TMDB_KEY` | The Movies tab. Server-side only. | <https://www.themoviedb.org/settings/api> |

```bash
openssl rand -base64 48   # run three times for JWT / STREAM_TOKEN / PASSWORD_PEPPER
openssl rand -hex 32      # ADMIN_MASTER_TOKEN

npx wrangler secret put JWT_SECRET
npx wrangler secret put STREAM_TOKEN_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put ADMIN_MASTER_TOKEN
npx wrangler secret put TMDB_KEY
```

### Strongly recommended

| Secret | Why |
|---|---|
| `M3U_SOURCE_URL` | The channel playlist. A raw `github.com/…` URL in a public repo hands the entire stream list to anyone with `curl`. Point this at R2, a private gist, or a private repo. |
| `BREVO_API_KEY` | Verification and password-reset email. Without it, no email is sent. |
| `LICENSE_SECRET` | Must be **identical** to the value on `chrtv-license`, or the player cannot fetch AES-128 keys. |
| `GITHUB_RAW_TOKEN` | Only if the playlist source is a private repo. |

### Optional

| Secret | Default when unset |
|---|---|
| `M3U_SOURCE_URLS` | Comma-separated fallback list |
| `LEGACY_JWT_SECRETS`, `LEGACY_PASSWORD_PEPPERS` | Comma-separated rotation support, oldest last |
| `ADMIN_ALLOWED_CIDRS` | Empty = any IP can use the master token |
| `ADMIN_ALERT_WEBHOOK` | Admin alert channel |
| `BREVO_SENDER_NAME`, `BREVO_SENDER_EMAIL` | Already in `[vars]` |
| `CORS_ALLOWED_ORIGINS` | Falls back to `PUBLIC_WEB_ORIGIN` + `PUBLIC_ADMIN_ORIGIN` + the built-in list |
| `MOVIE_FRAME_SRC` | Allowlisted partner domain for the `frame-src` CSP directive; without it the movie iframe is blocked |
| `STREAM_MANIFEST_TTL` | `300` seconds (range 60–1800) |
| `PROXY_ALLOWED_HOSTS` | Comma-separated SSRF allowlist for the stream proxy |
| `STANDARD_PREVIEW_SECONDS`, `STANDARD_PREVIEW_WINDOW` | Standard-plan trial length and window |
| `AD_SKIP_STANDARD`, `AD_SKIP_RECREATIONAL`, `AD_SKIP_ULTIMATE`, `AD_MAX_PER_HOUR` | `0` / `0` / `0` / `3` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | "Channel is dead" notifications |
| `TSDB_KEY` | TheSportsDB key (the free tier key works) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK` | Web push. The public half is safe to expose. |
| `UPSTREAM_UA_DEFAULT` | Upstream User-Agent for the proxy |
| `AUTO_HIDE_DEAD_CHANNELS` | `1` = hide a channel after 5 consecutive failures |
| `LICENSE_KEY_ROTATE`, `LICENSE_KEY_GRACE`, `PROTECT_MAX_BYTES`, `PROTECT_SKIP_HOSTS` | Stream-protection tuning |

### Emergency only

| Secret | What it does |
|---|---|
| `PUBLIC_STREAM_URL` | Set to `1` and clients fall back to the original stream URL — playback stops working behind hosts that block Cloudflare, and stream protection is effectively off. **Delete it again afterwards.** |

```bash
npx wrangler secret put PUBLIC_STREAM_URL   # type: 1
npx wrangler secret delete PUBLIC_STREAM_URL
```

---

## 3. `chrtv-license` — the license Worker (`wrangler.license.toml`)

| Secret | Notes |
|---|---|
| `LICENSE_SECRET` | **Must match** `LICENSE_SECRET` on `chrtv-ott`. |
| `ADMIN_SECRET` | Admin access to the license server. |

```bash
npx wrangler secret put LICENSE_SECRET -c wrangler.license.toml
npx wrangler secret put ADMIN_SECRET   -c wrangler.license.toml
```

Variables already in that file: `LICENSE_ALLOWED_ORIGINS` (`*` today — narrow
it to the consumer host), `LICENSE_STRICT_IP` (`0`).

Optional KV for long-term licences:

```bash
npx wrangler kv namespace create LICENSES   # then uncomment [[kv_namespaces]]
```

---

## 4. `chrtv-api` (`wrangler.api.toml`)

Same script, same secrets, **one extra**: this Worker is on its own hostname, so
its own origin has to be allowed explicitly.

```bash
npx wrangler secret put JWT_SECRET -c wrangler.api.toml
npx wrangler secret put STREAM_TOKEN_SECRET -c wrangler.api.toml
npx wrangler secret put PASSWORD_PEPPER -c wrangler.api.toml
npx wrangler secret put ADMIN_MASTER_TOKEN -c wrangler.api.toml
npx wrangler secret put TMDB_KEY -c wrangler.api.toml
```

And add the consumer + admin origins to `CORS_ALLOWED_ORIGINS` in that config's
`[vars]`, otherwise the browser blocks every request.

---

## 5. `playz-admin` (`wrangler.admin.toml`)

**No secrets.** It is an assets-only Worker: Cloudflare serves the static files
and never starts a JavaScript isolate, so there is nothing to put a secret in.
Authorisation happens on the API Worker, which checks the caller's role on every
`/admin/*` request. The client-side check in `apps/admin/src/main.jsx` is a
user-experience gate, not a security boundary.

---

## 6. Build variables (`VITE_*`)

These are **not** Worker secrets. Vite inlines them into the JavaScript at build
time, so they are public.

Set them in **Workers & Pages → `<project>` → Settings → Builds → Variables and
Secrets** (mark them as **Plaintext**), or in a local `.env` at the repo root
(which `.gitignore` already excludes).

| Variable | Used by | Leave empty when |
|---|---|---|
| `VITE_API_BASE` | web, admin | The Worker serves the app on the same origin (the default) |
| `VITE_PRODUCTION_API_BASE` | web | Same — only the native APK needs an absolute host |
| `VITE_API_ORIGIN` | web dev proxy only | You always run `npm run dev:api` locally |
| `VITE_WEB_APP_URL` | admin | The admin link should go to its own origin |
| `VITE_TMDB_KEY` | web | The server holds `TMDB_KEY` and proxies |
| `VITE_TMDB_IMG_BASE` | web | Using real TMDB image URLs |

> Never put `JWT_SECRET`, `PASSWORD_PEPPER`, `STREAM_TOKEN_SECRET`,
> `ADMIN_MASTER_TOKEN`, `BREVO_API_KEY` or `TMDB_KEY` into a `VITE_*` variable.
> Anything in that namespace is downloadable by anyone who opens the site.

---

## 7. First-time checklist

```bash
# 1. required secrets on the main worker
for s in JWT_SECRET STREAM_TOKEN_SECRET PASSWORD_PEPPER ADMIN_MASTER_TOKEN TMDB_KEY; do
  printf '%s = ' "$s"; openssl rand -base64 48;   # paste the real values below
done
npx wrangler secret put JWT_SECRET
npx wrangler secret put STREAM_TOKEN_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put ADMIN_MASTER_TOKEN
npx wrangler secret put TMDB_KEY

# 2. recommended
npx wrangler secret put M3U_SOURCE_URL
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put LICENSE_SECRET

# 3. the license worker must agree on LICENSE_SECRET
npx wrangler secret put LICENSE_SECRET -c wrangler.license.toml
npx wrangler secret put ADMIN_SECRET   -c wrangler.license.toml

# 4. verify
npx wrangler secret list
curl -s https://<your-domain>/api/health
```

---

## 8. Rotating a secret safely

| Secret | Safe to rotate? |
|---|---|
| `JWT_SECRET` | Yes — everyone is logged out once. |
| `STREAM_TOKEN_SECRET` | Yes — in-flight playback tokens stop validating within their TTL. |
| `PASSWORD_PEPPER` | **No.** Push the old value into `LEGACY_PASSWORD_PEPPERS` first, or every stored password stops verifying. |
| `ADMIN_MASTER_TOKEN` | Yes. |
| `TMDB_KEY` | Yes — issue a new key at themoviedb.org, update the old one into no configuration (there is no legacy list for it). |
| `LICENSE_SECRET` | Only on both Workers at the same time, or playback breaks in between. |

For gradual JWT rotation, set the previous value as a comma-separated list:

```bash
npx wrangler secret put LEGACY_JWT_SECRETS      # "<old-value>,<older-value>"
```

---

## 9. Never commit a secret

```bash
npm run secrets:check     # scans the tree for committed credentials
```

`.env`, `.env.*`, `.dev.vars*`, `*.pem`, `*.key`, `*.jks` are already in
`.gitignore`. Note that `wrangler.toml` is committed, so anything in `[vars]`
is public — that is exactly why the secrets above are set with
`wrangler secret put` instead.
