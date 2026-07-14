# AIQTrader Viewer — Configuration Reference

Every setting the `aiqtrader-next-js` app reads: what it does, where to put it, and what breaks without it.

**Where settings live**

| Environment | File / place | Committed? |
|---|---|---|
| Local dev (`next dev`) | `.env.local` (also `.dev.vars` for the Cloudflare context) | ❌ gitignored |
| Production (Cloudflare) | Pages/Workers → **Settings → Environment Variables** (mark secrets *Encrypted*) | ❌ never in git |

> Cloudflare env changes require a **redeploy** to take effect.

---

## 1. Required

### `SECRET` — session signing key ⚠️ **required, fail-closed**
HMAC key for the signed session cookie.

- **There is deliberately NO fallback.** If unset: `signSession()` throws, `verifySession()` returns `null`, and `/api/auth/redeem` returns `500 server_misconfigured`. **Nobody can log in.**
- This is intentional — an earlier version fell back to a hardcoded string that was public in the repo, which would have let anyone forge an **admin** session.
- Use a long random value; keep it identical across deploys (changing it invalidates every existing session).

```
SECRET="<64+ random hex chars>"
```

### `ADMIN_KEYS` — who gets the admin console
Comma-separated **subscription codes**. A logged-in user whose code matches **any one** of them gets `/app/admin` + all `/api/admin/*` routes.

```
ADMIN_KEYS="AIQ-XXXX-YYYY"                      # single
ADMIN_KEYS="AIQ-XXXX-YYYY,AIQ-AAAA-BBBB"        # several — any match wins
```

Also accepted (all merged together, `src/lib/admin.ts`):
- `ADMIN_KEY` — singular alias.
- `ADMIN_USER_IDS` — comma-separated `u_…` ids instead of codes.
- A KV user record with `"role": "admin"` — lets you grant admin **without a redeploy**.

**Local-dev fallback:** outside production, if *no* admin env var is set, the public demo code `AIQ-DEMO-2026` is treated as admin so the console works with zero config. **This never applies in production** — you *must* set `ADMIN_KEYS` there, or nobody is admin.

---

## 2. Bindings (Cloudflare)

### `KV` — the user store *(wrangler.jsonc)*
The single source of truth for **users, access requests, feedback, and rate-limit counters**. Reports are **not** in KV (they're static files).

| Key | Value |
|---|---|
| `u_<id>` | the `UserRecord` JSON (userid, name, email, code, tier, status, validity, myList, seenReports, delivery) |
| `idx:code:<CODE>` | `"<userid>"` — redeem-by-code lookup |
| `idx:users` | JSON array of minted userids |
| `req:<id>` / `idx:reqs` | access requests (from `/request-access`) |
| `fb:<id>` / `idx:feedback` | user feedback |
| `rl:<bucket>:<ip>` | rate-limit counters (auto-expire via TTL) |

> **Real subscriber codes are NOT in source.** They live only in KV, provisioned via `/app/admin` or `scripts/mint-code.mjs`. Never re-add them to `user-store.ts` or `scripts/users.seed.json` — that file is gitignored for this reason.

---

## 3. Optional — email (currently OFF)

Emailing access codes is **disabled**. `/api/admin/send-code` returns `501` and the admin UI falls back to **copy the code and share it manually** (or use **Export not-sent** on the Users tab to feed your own local mailer).

- **Gmail App Password / SMTP does NOT work on Cloudflare Workers** (no raw sockets; `nodemailer` won't bundle). An earlier attempt to use `cloudflare:sockets` **broke the deploy build**, so it was removed.
- The only build-safe path is the **Gmail REST API over OAuth2**, enabled by setting:

```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_SENDER=you@gmail.com
```

(One-time: Google Cloud Console → OAuth credentials with scope `https://www.googleapis.com/auth/gmail.send`, then mint a refresh token.) If `GMAIL_CLIENT_ID` is unset, email stays off.

> Alternative in use: **Module 1 (`market-data-server`) sends the emails locally** via Gmail SMTP (`GMAIL_USER` / `GMAIL_APP_PASSWORD` in `market-data-server/.env`) — real SMTP works there because it isn't on the edge.

---

## 4. Security settings (code, not env)

These are configured in source; listed so they aren't a surprise. Full review: `docs/DEVPLAN-security.md`.

| Setting | Where | Value |
|---|---|---|
| Session lifetime | `src/lib/session.ts` | `SESSION_MAX_SECONDS` = 14 days (capped by the user's `validity`) |
| Session cookie | `api/auth/redeem` | `httpOnly`, `secure` (prod), `sameSite=lax` |
| **Login rate limit** | `api/auth/redeem` | **10 failed** code attempts per IP / **10 min** → `429` |
| **Access-request limit** | `api/access-requests` | **5** per IP / **10 min** → `429` |
| Client IP source | `src/lib/rate-limit.ts` | `CF-Connecting-IP` (never `X-Forwarded-For`) |
| **CSP + headers** | `next.config.ts` | `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, nosniff, Referrer-Policy, HSTS (prod) |
| **CSRF** | `src/middleware.ts` | mutating `/api/**` with a mismatched `Origin` → `403` |
| Tier gate | `src/middleware.ts` | `free` tier blocked from symbol-detail (charts are pro-only) |

Rate-limiting **fails open** if KV is unavailable — it never blocks a legitimate user because the limiter's store is down. Consider a Cloudflare **WAF Rate-Limiting Rule** as a hard edge cap.

---

## 5. Reports (no env — static files)

Reports are **static assets**, not env/DB config.

```
market-data-server writes → <repo-root>/reports/<NNN-slug>/
  → scripts/import-reports.bat        (mirror into the app)
  → data/reports/**                   (committed source of truth)
  → node scripts/sync-reports.mjs     (runs automatically on predev/prebuild)
      ├─ public/reports/**            (served as static assets)
      ├─ src/lib/reports-manifest.ts  (SCHEDULE_IDS / SCHEDULES / WATCHLISTS)
      └─ public/reports/manifest.json (the notification feed)
```

- **AI extension:** an optional sibling `<report_version>.ai.json` per run. Absent → AI panels hide themselves.
- **Notifications:** the bell polls `public/reports/manifest.json`; read/unread is per-account in `user.seenReports`.

---

## 6. Local-dev quick start

`.env.local`:
```
SECRET="<random hex>"
ADMIN_KEYS="AIQ-XXXX-YYYY"     # your admin code (optional locally — demo code works)
```

```bash
npm run dev            # runs sync-reports first (predev), then next dev
```
Sign in with your code, or the demo codes (non-production only): `AIQ-DEMO-2026` (pro/admin), `AIQ-FREE-0001` (free), `AIQ-EXP-0002` (expired), `AIQ-SUSP-0003` (suspended).

## 7. Deploy checklist

- [ ] `SECRET` set in Cloudflare (**required** — logins fail closed without it)
- [ ] `ADMIN_KEYS` set in Cloudflare (**required** — otherwise nobody is admin in prod)
- [ ] `KV` namespace bound (`wrangler.jsonc`)
- [ ] `npx tsc --noEmit` clean, `npm run build` green
- [ ] `npm run deploy` — **a git push alone does NOT update the live Worker**
