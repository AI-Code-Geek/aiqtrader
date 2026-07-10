# AIQTrader — Watchlist Reports Viewer · End-to-End Dev Plan

**Status:** PLAN
**App:** `aiqtrader-next-js` (Next.js 16 on Cloudflare Workers via OpenNext)
**Role in the system:** This is a **read-only viewer (Module 3/4, UI tier)** for the periodical
reports produced by the trading engine. Per the project rules, **the UI renders; it never computes.**
Everything shown here (decision verdict, conviction, confluence, entry ladder, quality grade) is
already computed server-side and baked into each report JSON. This app only *reads, selects,
formats, and charts.*

---

## 1. What we're building

A subscription-gated dashboard where a trader:

1. Enters a **subscription code** (or logs in) to unlock access.
2. Lands on a **Watchlist Dashboard** showing the **latest run** of a schedule's report:
   ranked candidates with decision + conviction, data-health, market/tape context.
3. Clicks a **symbol** to open a **detail view**: multi-timeframe candlestick chart +
   decision cards (verdict, confluence dimensions, setup/entry ladder, quality, HTF structure).
4. Can pick a **historical run** from the periodical archive; if none picked, **latest is default**.
5. Has a **personal page ("My List")** where they select a **subset** of the universe; the
   dashboard can then be filtered to just their picks.

### Non-goals
- No order placement, no live streaming, no server-side TA recomputation.
- No re-implementation of indicator/scoring/ranking math (rule #2 in project CLAUDE.md).

---

## 2. Data contract (from the reports on disk)

Reports live under `reports/<NNN-schedule-slug>/` (e.g. `001-watchlist-1/`):

| File | Purpose |
|------|---------|
| `index.json` | Manifest: `schedule_id`, `name`, `persona`, `updated_at`, `versions[]` (each `{version, file, generated_at, candidate_count, status}`) — **the periodical archive list**. |
| `latest.json` | Full copy of the newest run (same shape as a version file). |
| `<version>.json` | One periodical run, e.g. `20260710T003351Z.json`. |

### A run file (`report`) shape

```
schema_version, report_version, generated_at
schedule { id, name, persona, timeframe, cadence{kind, interval_minutes}, include_decisions, include_charts, detail_limit }
persona                      // "swing" | "day" | "scalp"
timeframes []                // ["1Hour","1Day","1Week"]
data_health { checked_at, timeframes[], summary{total_symbols, ok, partial, missing, errors, by_timeframe}, synced{}, ok }
universe { watchlist_id, name, symbol_count, symbols[] }   // full universe (24 symbols)
candidates []                // ranked, actionable — the dashboard's primary list
decisions {}                 // keyed by symbol — full detail for the symbol page
charts {}                    // keyed by symbol -> { "1Hour":[bar], "1Day":[bar], "1Week":[bar] }
```

**candidate[i]:** `symbol, regime, price, change_pct, rvol, strategy, label, direction,
status(active|watch), conviction, setup{entry,stop,target,rr,...}, quality{grade,trap_risk,
confirmations[],warnings[],verdict}, decision{...}, screening{tradeable,blocks[],warnings[],
dollar_volume,atr_pct,vol_band}, rank_score, age_bars, thesis_expired`

**decisions[SYM]:** `symbol, timeframe, regime, price,
best{strategy,label,direction,status,regime_ok,conviction,conditions[],setup,quality},
confluence{regime,dimensions{trend,momentum,volatility,volume,structure}(each {read,detail,weight}),
agreement,score,lean,strength,price},
decision{verdict(take|watch|arm|avoid), conviction, raw_conviction, alignment(agree|conflict),
klass(continuation|reversal), context, context_label, htf_lean, size_factor, confirmation{score,state,
evidence[],missing[]}, market{state,label,bias,sector,sector_state,note}, rank_score, entry_plan{entry_now,
ladder{targets[]}}, position_gate, reason},
structure{htf{htf_tf,support_levels[],resistance_levels[],supports[],resistances[]}, level_strength}}`

**chart bar:** `{ ts, o, h, l, c, v }` (ISO ts, floats). 1Hour/1Day = up to 200 bars, 1Week ~57.

> **Alignment rule (CLAUDE.md #9):** the candlestick is lightweight-charts; any RSI/MACD/Volume
> sub-panel is recharts plotted **by array index** and must be built from the **same bar set/order/count**.
> Keep warm-up gaps as `null`, never filter.

---

## 3. Architecture — **free tier, no storage, reports bundled in the repo**

> **Decision (locked):** No R2 / KV / D1 / database. The report JSON is **committed to the repository**
> in a `data/` (→ `public/reports/`) folder and served as **static assets** on the Cloudflare free tier.
> Everything below is designed to run with zero paid bindings.

```
   Repo (committed):  data/reports/<NNN-slug>/{index.json, latest.json, <version>.json}
        │  build step copies →  public/reports/<NNN-slug>/**        (static assets)
        ▼
   ┌───────────────────────────────────────────────────────────┐
   │  Next.js 16 (App Router) on Cloudflare (OpenNext, free)    │
   │                                                            │
   │  Static JSON served directly:                              │
   │    /reports/001-watchlist-1/index.json                     │
   │    /reports/001-watchlist-1/latest.json                    │
   │    /reports/001-watchlist-1/<version>.json                 │
   │                                                            │
   │  Thin read layer src/lib/reports-source.ts:                │
   │    listSchedules()  → reads data/reports/*/index.json       │
   │    getIndex(id)     → that schedule's manifest             │
   │    getReport(id,v)  → <version>.json  (v='latest' default) │
   │  (server components read from disk at build/SSR; client    │
   │   islands fetch the same files by URL for run-switching)   │
   │                                                            │
   │  Stateless auth (no DB): middleware verifies a signed      │
   │  code cookie via HMAC(env SECRET). No lookup table.        │
   └───────────────────────────────────────────────────────────┘
                                 │
                         Browser (trader)
              cookie session (signed code) + localStorage "My List"
```

**How the free tier stays free**
- **Report data = static files.** Committed under `data/reports/**`; a build step (or symlink/copy
  script) mirrors them to `public/reports/**`. Cloudflare serves static assets for free with strong
  edge caching. Version files are immutable → `Cache-Control: public, max-age=31536000, immutable`;
  `index.json`/`latest.json` get a short max-age so a new run shows up.
- **No bundling the JSON into the Worker.** A run file is ~950 KB; serving from `public/` as an asset
  keeps it out of the Worker size budget. Only tiny `index.json` files are read server-side for routing.
- **Prefer SSG/ISR.** Pre-render dashboard/detail per committed run at build (`generateStaticParams`
  over `index.versions[]`), so most requests are cached HTML + a static JSON fetch — no compute.

### Adding new periodical runs (the publish loop)
The engine writes a new `<version>.json` + updates `index.json`/`latest.json` into `data/reports/...`.
Commit + push → CI (`opennextjs-cloudflare deploy`, or Pages Git integration) rebuilds and re-deploys.
No runtime storage; the git history *is* the archive. (A GitHub Action can automate the commit+deploy.)

### KV is available (free tier) — use it for *user records + small state only*
A Workers KV namespace is provisioned (binding `KV`, id `5b81fa9d10704592b90455817f4a9fd0`). KV is on
the free tier with generous limits, so we use it for user identity/subscription state, while
**reports stay as bundled static files** (KV is wrong for ~950 KB run blobs — value-size and read-cost
unfriendly; the git-committed static files are better and free).

**KV key layout**
- **`<userid>`** *(primary user record — key is the userid itself)* → a JSON user object, extensible:
  ```jsonc
  {
    "userid":   "u_8f21",          // = the KV key
    "name":     "Meera",
    "email":    "meera@example.com",
    "code":     "AIQ-PRO-7788",    // subscription code
    "status":   "active",          // active | suspended | expired
    "validity": "2026-12-31T00:00:00Z", // subscription end (ISO); null = perpetual
    "tier":     "pro",             // free | pro
    "schedules":[1],               // schedule ids this user may view
    "myList":   ["AAPL","NVDA"],   // personal subset (lives INSIDE the record)
    "createdAt":"2026-07-09T...", "lastLoginAt":"..."
    // …not limited to these; add fields freely
  }
  ```
- **`idx:code:<CODE>`** *(secondary index)* → `"<userid>"`. Lets redeem look a user up **by code**
  without scanning. Written whenever a user's `code` is (re)issued. (Namespaced with `idx:` so it never
  collides with a bare-userid key.)

**Why My List is a field, not a separate key:** one record = one `KV.get`/`KV.put`, atomic, and it
travels with the user. Writes rewrite the small object — fine at this size.

`wrangler.jsonc` binding:
```jsonc
"kv_namespaces": [
  { "binding": "KV", "id": "5b81fa9d10704592b90455817f4a9fd0",
    "preview_id": "<preview-namespace-id-for-wrangler-dev>" }
]
```
Access in a route handler via `getCloudflareContext().env.KV` (OpenNext). Seed a user + code index:
```bash
wrangler kv key put --binding KV u_8f21 '{"userid":"u_8f21","name":"Meera","email":"meera@example.com","code":"AIQ-PRO-7788","status":"active","validity":null,"tier":"pro","schedules":[1],"myList":[]}'
wrangler kv key put --binding KV idx:code:AIQ-PRO-7788 u_8f21
```

### Deferred (only if you outgrow free tier)
- **R2** for the report archive (only if repo size / run count gets large — not needed now).
- **D1** if you need relational queries (billing, audit) beyond KV key/value.
- **Proxying Module 2** for on-demand fresh reports.

---

## 4. Auth / access model — **KV user records, signed-cookie session**

The user enters their **subscription code**; we resolve it to the user record and gate on
`status` + `validity`.

1. **Redeem** `POST /api/auth/redeem` `{ code }`:
   - `userid = KV.get("idx:code:"+code)` → miss ⇒ 401 (invalid code).
   - `user = JSON.parse(KV.get(userid))`.
   - Reject if `user.status !== "active"` (suspended/expired) or `user.validity` is past. Else OK.
   - Set a **signed httpOnly cookie** `HMAC(SECRET, "<userid>|<tier>|<exp>")`, where
     `exp = min(sessionMax, user.validity)`. (Optionally accept `{ code, email }` and cross-check the
     email for a second factor.)
2. **Guard:** middleware verifies the cookie signature on `/app/**` — no KV read per request
   (cookie is self-verifying). `userid`/`tier` come from the cookie; `exp` enforces validity end.
3. **Profile / server truth:** routes that need live user data (My List, current status) do one
   `KV.get(userid)`. If `status` flipped to suspended mid-session, the next such read rejects.
4. **Admin ops** are just KV writes — issue a code (`put user`, `put idx:code:*`), extend validity,
   suspend (`status:"suspended"`), all via `wrangler kv key put` or an admin route. No redeploy.

**Login (optional later):** same signed-cookie session; email+code, magic link, or password can all
resolve to the same `userid` record.

**Tiers** ride in the cookie and mirror `user.tier` (`free` = latest run + top-N, no charts; `pro` =
full archive + charts + My List). Enforced in middleware / route handlers, never trusted from client.

**My List** lives as the `myList` array **inside the user record**. `PATCH /api/my-list` does
`get userid → mutate myList → put userid`; a **`localStorage` mirror** gives instant paint and offline,
reconciled from the record on load. Syncs across devices. The `AIQ.myList()` seam in the mockups models
the client half (swap localStorage-only for fetch+mirror in the real app).

---

## 5. Routes / pages

| Route | Type | Purpose |
|-------|------|---------|
| `/` | public | Marketing / redeem-code entry (login). |
| `/app` | guarded | Redirect to default schedule dashboard. |
| `/app/[scheduleId]` | guarded, RSC | **Watchlist Dashboard** — latest run by default; `?v=<version>` for a historical run. Ranked candidate cards/table, data-health strip, market/tape banner, run selector, "My List only" toggle. |
| `/app/[scheduleId]/[symbol]` | guarded, RSC | **Symbol detail** — multi-TF chart + decision cards. Honors `?v=`. |
| `/app/my-list` | guarded | Manage the user's subset of the universe (add/remove, reorder). |
| `/app/settings` | guarded | Persona note, default schedule, theme. |
| `/api/*` | route handlers | BFF above. |

Query params: `?v=<report_version|latest>` (default `latest`), `?tf=1Hour|1Day|1Week`,
`?mine=1` (filter to My List).

---

## 6. Component inventory (UI renders only)

**Dashboard**
- `RunSelector` — dropdown of `index.versions[]` (label = `generated_at` + `candidate_count`), "Latest" pinned.
- `DataHealthStrip` — `summary.ok/partial/missing`, per-timeframe sync freshness.
- `MarketTapeBanner` — from any decision's `market.note` (tape state, leaders, sector).
- `CandidateCard` / `CandidateTable` — symbol, price, `change_pct`, `rvol`, `label`, `direction`,
  `VerdictBadge(decision.verdict)`, `ConvictionMeter(conviction)`, `QualityGrade(quality.grade)`,
  `RR(setup.rr)`, `rank_score`. Sort by `rank_score` desc.
- `VerdictBadge` — take=green, watch=amber, arm=blue, avoid=grey/red. `alignment=conflict` → warning ring.
- `ConfluenceMini` — 5 dimension chips (trend/momentum/volatility/volume/structure) colored by `read`.
- `MyListToggle`, `PersonaChip`, `RegimeChip`.

**Symbol detail**
- `PriceChart` (client, lightweight-charts) — candles for selected `tf`; overlay entry/stop/target and
  HTF support/resistance as price lines from `structure.htf` + `setup`.
- `IndicatorPanels` (client, recharts, **by array index**, same bar set) — Volume, RSI, MACD.
- `DecisionCard` — `verdict`, `conviction` vs `raw_conviction`, `alignment`, `klass`, `context_label`,
  `htf_lean`, `size_factor`, `reason`.
- `ConfluencePanel` — 5 dimensions with `read/detail/weight`, `score`, `lean`, `strength`, `agreement`.
- `SetupCard` + `EntryLadder` — `entry/stop/target/rr`, `entry_plan.ladder.targets[]` (level/rr/pct/milestone),
  chase-risk.
- `QualityCard` — `grade`, `trap_risk`, `confirmations[]`, `warnings[]`, `verdict`.
- `ConditionsChecklist` — `best.conditions[]` (met booleans).
- `StructureCard` — HTF supports/resistances with ATR distances.
- `TimeframeTabs` — 1Hour / 1Day / 1Week.

> **Reconciliation (CLAUDE.md §2, #5–6):** the headline must present Confluence (direction + size) and
> Strategy (the executable plan) as **two distinct axes** and reconcile them — never show one as the other.
> When `alignment=conflict`, surface it: continuation-vs-tape → discount/avoid; reversal-vs-tape → needs
> turn confirmation (show `confirmation.missing[]`).

---

## 7. Milestones / phases (Done-When checklists)

### Phase 0 — Foundation
- [ ] Commit reports into the repo under `data/reports/<NNN-slug>/**`; add a build/prebuild script that
      copies (or symlinks) `data/reports/**` → `public/reports/**`.
- [ ] Add Bootstrap 5 **or** keep Tailwind (see §9); pick charting libs (lightweight-charts + recharts).
- [ ] TypeScript types for the report contract in `src/lib/report-types.ts` (mirror §2).
- [ ] Read layer `src/lib/reports-source.ts` with `listSchedules/getIndex/getReport` — reads committed
      `data/reports/**` (static-file impl; no bindings).

### Phase 1 — Read path + dashboard (latest only)
- [ ] `generateStaticParams` over each schedule → SSG the dashboard; run JSON fetched as a static asset.
- [ ] `/app/[scheduleId]` renders latest run: candidate table/cards, data-health, tape banner.
- [ ] VerdictBadge / ConvictionMeter / QualityGrade / ConfluenceMini.
- **Done when:** dashboard shows the 9 ranked candidates from `latest.json` sorted by `rank_score`.

### Phase 2 — Symbol detail + charts  ✅ IMPLEMENTED
- [x] `/app/[scheduleId]/[symbol]` with TimeframeTabs (RSC page + `SymbolDetailClient`; SSG per symbol-with-a-decision).
- [x] PriceChart (candles + entry/stop/target + HTF support/resistance level lines) — lightweight-charts v5.
- [x] IndicatorPanels aligned by index (Volume real; RSI/MACD derived client-side in `src/lib/indicators.ts`
      **display only, never a decision input**; warm-up bars kept as `null` to preserve index alignment).
- [x] All decision cards wired (`DecisionCards.tsx`: Decision, Confluence, Setup+EntryLadder, Quality,
      Conditions, Confirmation, Structure).
- **Done when:** clicking META shows the chart with plan overlay and every decision card populated. ✔

### Phase 3 — Periodical archive (historical runs)
- [ ] RunSelector from `index.versions[]`; `?v=` drives both dashboard and detail; default = latest.
- [ ] "immutable" caching on version files.
- **Done when:** switching to `20260710T003350Z` re-renders the whole view from that run; back to Latest works.

### Phase 4 — Auth + subscription (KV user records)  ✅ IMPLEMENTED
- [x] Bind `KV` in `wrangler.jsonc` (id `5b81fa9d…`); demo `<userid>` records + `idx:code:<CODE>` pointers
      auto-seeded into an empty KV in non-production (`src/lib/user-store.ts`). Prod seeds via `wrangler kv key put`.
- [x] `User` type + `Session` + `isActive()` in `src/lib/user-types.ts`.
- [x] `/` redeem form → `POST /api/auth/redeem` (code→`idx:code`→userid→record, gate on status/validity) →
      HMAC-signed httpOnly cookie (`src/lib/session.ts`, Web Crypto) → **proxy** guard on `/app/**`
      (`src/proxy.ts`; Next 16 renamed middleware→proxy). Cookie is self-verifying → no KV read per request.
      Plus `POST /api/auth/logout`, `GET /api/me` (server truth), `PATCH /api/my-list`.
- [x] Tier gating in the proxy: `free` blocked from the symbol-detail view (charts are pro-only) →
      redirected to the dashboard with `?upgrade=1`. Tier comes from the signed payload, never the client.
- **Done when:** a valid active code unlocks `/app`; invalid / suspended / past-validity is rejected;
      logout clears session. ✔ (demo codes: `AIQ-DEMO-2026` pro, `AIQ-FREE-0001` free, `AIQ-EXP-0002` expired,
      `AIQ-SUSP-0003` suspended.)

### Phase 5 — My List (field in user record, KV-synced)  ✅ IMPLEMENTED
- [x] `/app/my-list` add/remove from `universe.symbols` (`MyListClient` + RSC universe loader); localStorage
      mirror via `client-user.ts` for instant paint, then `PATCH /api/my-list` (get→mutate `myList`→put on the
      KV record) + reconcile from `GET /api/me` on load.
- [x] `?mine=1` filters the dashboard to the user's subset (dashboard "My List only" toggle;
      non-candidate picks shown as "watching · no setup" on the My List page).
- **Done when:** a user's picks persist across reload (localStorage ✔) **and across devices** (KV record ✔).

### Phase 6 — Polish & deploy
- [ ] Empty/partial `data_health` states; `thesis_expired`/`age_bars` staleness badges.
- [ ] Dark/light theme via CSS vars (Swift light default — CLAUDE.md #12); design-handoff fidelity.
- [ ] `npx tsc --noEmit` clean; Lighthouse; `opennextjs-cloudflare deploy`.

---

## 8. Verify before "done" (per CLAUDE.md #15)
- `npx tsc --noEmit` in `aiqtrader-next-js`.
- `npm run build` (Next) and `npm run preview` (OpenNext local Worker) green.
- Spot-check that no indicator/scoring math was reimplemented in the UI (rule #2).

---

## 9. Bootstrap vs Tailwind — recommendation

The user asked for "Bootstrap HTML5 **or** Next.js-supported UI." The starter already ships **Tailwind v4**.

- **Static mockups (this deliverable):** **Bootstrap 5 via CDN** — zero build, opens in a browser,
  fastest to review the UX. Delivered in `/mockups` (see §10).
- **Production Next.js app:** **keep Tailwind** (already wired, smaller Worker bundle, matches the
  TradeAIQ handoff via CSS variables). Port the Bootstrap mockups' structure to Tailwind components.
- If the team prefers Bootstrap in prod too, add `bootstrap` + `react-bootstrap`; the mockups map 1:1.

---

## 10. Static HTML mockups (delivered in `/mockups`)

Self-contained Bootstrap 5 pages that load **real trimmed report data** (`assets/sample-data.js`,
generated from `001-watchlist-1/latest.json`, charts capped to last 80 bars). Open `mockups/index.html`
in a browser — no server needed.

| File | Screen |
|------|--------|
| `index.html` | Subscription-code / login gate. |
| `dashboard.html` | Watchlist dashboard: run selector, data-health, tape banner, ranked candidate cards + table, My-List toggle. |
| `symbol.html` | Symbol detail: lightweight-charts candles + plan/level overlay, timeframe tabs, decision/confluence/setup/quality/structure cards. |
| `my-list.html` | Personal page: pick a subset of the universe (persisted to localStorage). |
| `assets/app.css` | Theme (CSS vars, light default + dark), verdict/badge styles. |
| `assets/app.js` | Shared nav, data access, formatters, badge/meter render helpers. |
| `assets/sample-data.js` | Real trimmed report + index manifest. |

These are **UX truth**, not production code: same data contract, same card taxonomy, same
verdict/confluence language — so Phase 1–5 components port directly.
