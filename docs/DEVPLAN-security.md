# AIQTrader Viewer — Security Review & Hardening Plan

**App:** `aiqtrader-next-js` (Next.js 16 on Cloudflare Workers via OpenNext)
**Reviewed:** 2026-07-12 · **Status:** REVIEW + PLAN
**Data stores:** Cloudflare **KV** (user records + access requests + feedback) and **static JSON report
files**. **No SQL database.** Secrets via Cloudflare env / `.dev.vars` / `.env.local`.

This reviews the app against the concerns you listed and records what is already in place vs. what to
add. Legend: ✅ done · ⚠️ partial / needs work · ❌ missing.

---

## 1. Scorecard (your checklist)

| # | Concern | Status | Evidence / Gap |
|---|---------|:---:|----------------|
| 1 | **Unauthorized API access** (owner-auth middleware) | ✅ | Every `/api/admin/*` route calls `readAdmin()` (session + admin allowlist, `src/lib/admin.ts`). `/api/me`, `/api/my-list`, `/api/feedback` require `readSession()`. Page routes `/app/**` guarded by Edge `middleware.ts`. Public by design: `/api/auth/redeem`, `/api/access-requests`. |
| 2 | **API keys / secrets exposure** | ✅ | No `NEXT_PUBLIC_*` anywhere → nothing secret is bundled to the client. `SECRET`, `ADMIN_KEYS`, `GMAIL_*`, `KV` are all server-side. `.env*` / `.dev.vars*` are gitignored. No secrets in `console.*`. **Fixed 2026-07-13:** removed the insecure `SECRET` fallback — `resolveSecret()` now returns `""` if unset and the app fails closed (no forgeable default key). |
| 3 | **API abuse / rate limiting per IP** | ❌ | No rate limiting anywhere. `/api/auth/redeem` (code brute-force), `/api/access-requests` and `/api/feedback` (spam) are unthrottled. |
| 4 | **SQL injection** | ✅ n/a | No SQL. KV is key/value; keys are derived from trimmed/upper-cased codes and session-derived userids (`codeIndexKey`). No query-injection surface. |
| 5 | **XSS** | ✅ (1 ⚠️) | React auto-escapes all rendered values (AI narratives, names, notes, codes are text). The only `dangerouslySetInnerHTML` is the **static** theme script in `layout.tsx` (no user input). **⚠️** No `Content-Security-Policy` (defense-in-depth). Email HTML in `send-code` interpolates name/code (admin-only + currently disabled) — sanitize if re-enabled. |
| 6 | **CSRF + CSP** | ⚠️ | Session cookie is `sameSite: "lax"` → blocks cookies on cross-site `fetch`/form POSTs = the main CSRF defense, present. **❌ No** explicit CSRF token / Origin check, **❌ no CSP** and no other security headers. |
| 7 | **Weak session security** | ✅ (2 ⚠️) | Cookie is `httpOnly` + `secure` (prod) + `sameSite=lax` + `maxAge`; token is HMAC-SHA256 signed, constant-time verified, `exp` enforced (`src/lib/session.ts`). Token is **not** in localStorage. **⚠️** No **idle/inactivity** expiry (absolute 14-day only). **⚠️** Stateless cookie → no server-side revocation: a suspended user stays valid on cookie-only paths (middleware) until expiry; only KV-reading routes (`/api/me`) re-check. |
| 8 | **Unlimited PIN attempts / lockout** | ⚠️ | There is no numeric "owner PIN" — admin is gated by a subscription **code** in `ADMIN_KEYS`. The equivalent risk is **unlimited `/api/auth/redeem` attempts** (guessing `AIQ-XXXX-XXXX`). No throttle/lockout today. |

**Extra findings**
- `publicUser()` returns the full record **including the subscription `code`** to the owner's client (`/api/me`, `/api/auth/redeem`). Own-code only (acceptable), but it is also mirrored into `localStorage` → an XSS bug could read it. Prefer not mirroring `code`.
- Redeem errors distinguish `invalid_code` vs `inactive/expired/suspended` → minor account/code **enumeration** (reveals a code exists but is inactive). Low risk.
- No dependency/supply-chain gate (`npm audit`) in CI.

---

## 2. What's already solid (keep it)
- **Stateless signed sessions** (HMAC-SHA256, Web Crypto, constant-time verify, expiry) — no per-request DB read, edge-safe.
- **Server-only secrets**, no `NEXT_PUBLIC_` leakage, secrets gitignored.
- **Consistent authZ**: admin routes gate on `readAdmin()`; user routes on `readSession()`; pages on middleware. Admin is **never trusted from the client** (server re-checks via `/api/admin/whoami`).
- **No SQL** → no injection class. **React escaping** → no default XSS.
- **httpOnly + secure + sameSite** cookie.

---

## 3. Remediation backlog (prioritized)

### P0 — do before the next production deploy
- [x] **No secret fallback — fail closed. (DONE 2026-07-13)** Removed the hardcoded default from
      `resolveSecret()` (`src/lib/session.ts`); it now returns `""` when `SECRET` is unset. `signSession()`
      **throws** and `verifySession()` **returns null** on an empty secret, and `/api/auth/redeem` returns
      `500 server_misconfigured` rather than issuing a session. So a session is **never** signed or
      accepted with a public/known key. `SECRET` must be set in every environment (`.env.local`/`.dev.vars`
      locally; encrypted env in Cloudflare).
- [x] **Rate-limit `/api/auth/redeem`. (DONE 2026-07-13)** KV-backed per-IP counter (`src/lib/rate-limit.ts`,
      keyed by `CF-Connecting-IP`): **10 failed** code attempts per **10-min** window → `429 too_many_attempts`
      for the rest of the window; the counter resets on a successful login and auto-expires via KV TTL.
      Fails open if KV is unavailable. Verified: 10×401 then 429, and a different IP with a valid code still
      gets 200. Also protects admin (admin logs in via the same redeem). *Still recommended:* add a
      **Cloudflare WAF Rate-Limiting Rule** on the path as a hard edge cap, and show a friendly
      "too many attempts, try later" message in `LandingForm` for the 429.
- [ ] **Confirm prod env is set**: `SECRET` (strong random), `ADMIN_KEYS`. Rotate the demo/dev codes; ensure `DEV_USERS` never seed in production (already gated by `isProd()` — verify).

### P1 — hardening
- [x] **Security headers + CSP. (DONE 2026-07-13)** `next.config.ts headers()` on `/:path*`: **CSP**
      (`default-src 'self'`; `script-src 'self' 'unsafe-inline'` [+`'unsafe-eval'` dev only]; `object-src
      'none'`; `base-uri`/`form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` prod),
      `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
      strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo off), `Strict-Transport-Security`
      (prod). SSG-compatible (no nonce → no forced dynamic rendering); blocks external script/frame injection.
      Verified present on responses. *Follow-up:* confirm nothing breaks in the prod build (no `eval` at
      runtime); upgrade to nonce-CSP only if the app moves off SSG.
- [x] **CSRF Origin-check. (DONE 2026-07-13)** Centralized in `middleware.ts` (matcher now covers
      `/api/:path*`): any mutating (`POST/PUT/PATCH/DELETE`) `/api/**` request carrying an `Origin` that
      doesn't match `Host` gets `403 csrf_origin_mismatch`; no-Origin (server-to-server) is allowed and
      `sameSite=lax` remains the cookie baseline. Verified: cross-origin POST → 403, same-origin → 200.
- [x] **Rate-limit public intake** — `/api/access-requests` now capped at **5/IP per 10-min** (`429`)
      via the same `rate-limit.ts` helper. (DONE 2026-07-13.) TODO: apply the same to `/api/feedback`;
      optionally add a per-email cap. (Both already cap field sizes ✅.)
- [ ] **Idle session expiry**: issue a shorter idle window and slide it on activity (re-sign on `/api/me`), or shorten `SESSION_MAX_SECONDS`; keep the absolute cap.

### P2 — nice-to-have
- [ ] Stop mirroring the subscription **`code`** into `localStorage` (keep name/tier only); the httpOnly cookie is the real auth.
- [ ] **Session revocation** for suspend/expire: keep a KV `rev:<userid>` / token-version so a suspended user is rejected immediately even on cookie-only paths (middleware does a cheap check), rather than waiting for expiry.
- [ ] Make redeem errors **uniform** ("invalid or inactive code") to remove code enumeration.
- [ ] **Dependency audit** in the deploy pipeline (`npm audit --production`, Dependabot) — since AI-generated changes land often, gate on it.
- [ ] **Security regression checklist** (this file) run before each deploy — re-grep for `NEXT_PUBLIC_`, new `dangerouslySetInnerHTML`, un-gated new `/api/**` routes.

---

## 4. Cloudflare-specific notes
- **Rate limiting**: easiest is a **WAF Rate-Limiting Rule** in the Cloudflare dashboard on `/api/auth/redeem` and `/api/access-requests`; for per-code lockout, a **KV** counter or **Durable Object** in the route. Use `request.headers.get("CF-Connecting-IP")` for the client IP (don't trust `X-Forwarded-For`).
- **Headers/CSP**: OpenNext serves the Worker; set headers in `next.config.ts headers()` (applies to SSR/routes) and/or the Edge `middleware.ts` response. Verify they survive the OpenNext build.
- **Secrets**: set `SECRET`, `ADMIN_KEYS`, (optional) `GMAIL_*` as **encrypted** Pages/Workers env vars — never in the repo. Redeploy after changes (Pages env changes need a rebuild).

## 5. Done-when
- [ ] Prod refuses to run auth with the default SECRET (P0).
- [ ] `redeem` + public intake are rate-limited/locked out (P0/P1).
- [ ] CSP + security headers present and verified in prod response.
- [ ] Origin check on state-changing POSTs.
- [ ] Idle-expiry (or shortened session) + optional KV revocation.
- [ ] `npm audit` clean; this checklist re-run green before deploy.

> Note: much of the baseline (authZ on every route, signed httpOnly sessions, no client secrets, no SQL,
> React escaping) is already in good shape. The **highest-impact** items are the two P0s — the SECRET
> fail-closed and redeem rate-limiting — because they’re the difference between "hardened" and
> "someone forges an admin session / brute-forces a code."
