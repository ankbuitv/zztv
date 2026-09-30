# playZ — security notes

> Status of every security-relevant finding from the CHRTV Play audit, plus the
> controls playZ relies on. Read alongside `docs/AUDIT.md` §8.

---

## 1. Findings and current state

| ID | Finding | Severity | State in playZ |
|---|---|---|---|
| F1 | Real TMDB key committed in `.env`, duplicated in `.env.example`, **and hardcoded in `worker/worker.js` line 658** | **P0** | ✅ **Removed** — no key exists anywhere in the repo. `handleTMDBProxy` now requires `env.TMDB_KEY` and returns `503 NO_TMDB_KEY` when unset. ⚠️ **Owner must still revoke the old key** — it remains in the public Git history of `ankbuitv/ott`. |
| F2 | Stream-Engine admin token printed verbatim in `README.md`, `SECURITY_FIX_RUNBOOK.md`, `SECURITY_ACCEPTANCE_RESULTS_local.md` and `worker/worker.js` comments | **P0** | ✅ **Redacted** to `<token>` across the repo. ⚠️ **Owner must rotate the token upstream** — redaction does not un-leak it. |
| F3 | Infrastructure disclosure: engine hostnames, premium channel paths, D1 `database_id`, full secret-name inventory | P2 | ✅ Engine hostnames replaced with `<redacted>.example` in the migrated docs. `wrangler.toml` still needs the real `database_id` at deploy time — keep the repo private, or use `wrangler secret`/env substitution instead of committing it. |
| F4 | `.env` tracked by Git despite being listed in `.gitignore` | **P0** | ✅ Not carried over. `.gitignore` now blocks `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `*.jks`, `.dev.vars*`. |

### Git history is permanent
Removing a secret from the working tree does **not** remove it from history.
Anyone can run `git log -p` on the public `ankbuitv/ott` repository and read the
old TMDB key. Rotation is the only real remedy. If the ott repo stays public and
you prefer the history clean:

```bash
git filter-repo --path .env --invert-paths        # rewrites history
git filter-repo --replace-text replacements.txt   # replacements.txt: <leaked-key>==>REDACTED
git push --force-with-lease
```

Coordinate with anyone who has a clone first — history rewriting breaks them.

---

## 2. Controls inherited from CHRTV (verified in the audit, preserved)

These are genuinely good and were **not** rebuilt from scratch:

| Control | Where |
|---|---|
| Password pepper decoupled from `JWT_SECRET` | `passwordSecret()` / `hashPassword()` |
| Seamless secret rotation | `LEGACY_JWT_SECRETS`, `LEGACY_PASSWORD_PEPPERS` — old hashes still log in, then re-hash |
| Session revocation | real `sessions` table consulted on every authenticated request |
| 2FA TOTP | RFC 6238, ±1 window, base32 |
| Login brute-force protection | 5 attempts/account or 20/IP → 15-minute lockout |
| CORS allowlist | `corsAllowedOrigins()` echoes only known origins — no `*` |
| Security headers | `SECURITY_HEADERS` applied to every response incl. static assets |
| CSP with `frame-src` allowlist | `cspFor(env)`; movie embeds only from approved origins |
| SSRF defence | `proxyAllowedHosts()` host allowlist on the proxy route |
| Parameterised SQL | `env.DB.prepare(...).bind(...)` throughout — no string concatenation |
| SVG upload sanitisation | `sanitizeSvg` — strips `<script>`, event handlers, external links |
| Raw-byte upload guard | extension + magic-byte checks on image upload |
| `Permissions-Policy` | camera/mic/geolocation/payment locked by default |
| Rate limiting | D1-backed with in-memory fallback |
| Audit log | `logAudit(env, userId, action, detail)` on every admin mutation |
| Legacy-secret damage contained | `users.token_version` allows targeted revocation |

---

## 3. Security work still to do in playZ (not yet implemented)

Ordered by risk:

1. **Server-enforced admin authorization.** Today the admin UI hides itself with
   `user?.role === 'admin'`, and the API checks the role server-side — but the
   admin bundle still ships inside the consumer app. The role check must be
   verified on *every* `/admin/*` route, and the admin bundle must move to
   `apps/admin`. *(In progress — the app split is scaffolded, role enforcement
   audit pending.)*
2. **Community rate limiting.** Spam protection, chat throttling, slow mode,
   mute/ban, word blacklist, message deletion, pin, moderator badges.
3. **Upload hardening** — size limits, MIME sniffing, R2 signed URLs.
4. **CSRF** for cookie-authenticated admin mutations (token auth is not CSRF-prone;
   cookie auth is).
5. **Realtime auth.** Any Durable Object for chat must authenticate the socket
   handshake, not trust a client-sent user id.
6. **PWA service worker hygiene** — never cache `/api`, `/auth`, `/user`,
   `/admin` responses, and never cache media segments.
7. **Dependency review.** `npm audit` currently reports issues inherited from the
   legacy tree; triage before launch.

---

## 4. Deployment rules

1. **Never commit `.env`.** `.env.example` contains placeholders only.
2. **Never hardcode a secret.** `npm run secrets:check` scans for the known
   legacy values and for high-entropy literals; wire it into CI.
3. **Do not use `STREAM_MODE=proxy` casually** — it turns the Worker into a video
   bandwidth proxy and also weakens the value of the AES-128 layer if the mode is
   later switched back to `direct`.
4. **Rotate on any suspected exposure** — do not rely on the code change alone.
5. **Keep `ankbuitv/ott` public only if you accept its history.** Otherwise make
   it private or rewrite history.
