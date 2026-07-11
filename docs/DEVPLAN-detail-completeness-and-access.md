# AIQTrader — Detail Completeness, Analysis Tabs & Access Requests · Dev Plan

**Status:** PLAN → IN PROGRESS
**App:** `aiqtrader-next-js` (viewer) + Module 1 `market-data-server` (report builder, P6-01)
**Author date:** 2026-07-10

This plan closes three gaps the user reported on the report viewer, plus adds an access-request page:

1. **The symbol detail page is missing important data** — and some of it is missing from the report
   JSON itself, not just the UI.
2. **Swing charts should default to the Daily timeframe** (switchable to Hourly), not Hourly.
3. **A public "request access / subscription code" page** where a visitor submits a form; we mint
   **offline** subscription codes for them (admin-minted, not self-serve).

> Project rule (root CLAUDE.md #2): **the UI renders; it never computes.** Everything new the viewer
> shows must already be computed by Module 2 and **baked into the report JSON** by the Module 1 builder.
> This plan therefore has an **engine/builder half** (produce the data) and a **viewer half** (render it).

---

## 0. What's actually missing — findings

Audited `data/reports/001-watchlist-1/latest.json` against the builder (`market-data-server/app/reports/builder.py`)
and the engine decision endpoint (`/api/v2/strategies/{symbol}/decision`):

| Data | In report today? | Rendered today? | Action |
|------|:---:|:---:|--------|
| `decision.entry_plan.entry_now` (market entry + ladder) | ✅ | ✅ | keep |
| `decision.entry_plan.entry_pullback` (**"Breakout confirm"** — zone/trigger/fill-odds/ladder) | ✅ | ❌ | **render** |
| `decision.reason`, `phase`, `trend_state`, `htf_agree` | ✅ | partial | **render** |
| `decision.event_block`, `cost_block`, `market_block`, `take_small_block` | ✅ | ❌ | **render** |
| `decision.market` (tape/sector context) | ✅ | ❌ (dashboard only) | **render** |
| `entry_now.ladder.scale_out / rr_blended / t1_sub_1r` | ✅ | ❌ | **render** |
| `structure.level_strength` (scored S/R map) | ✅ | ❌ | **render** |
| **MTF alignment** (`/indicators/{sym}/mtf`) | ❌ | ❌ | **add to builder + render** |
| **Price/Volume** psychology (`/analysis/{sym}/price-volume`) | ❌ | ❌ | **add to builder + render** |
| **Price-Action** patterns/fib/pivots (`/analysis/{sym}/price-action`) | ❌ | ❌ | **add to builder + render** |

**Chart default bug:** `SymbolDetailClient` sets `tf = timeframes[0]`. For swing, `timeframes =
["1Hour","1Day","1Week"]` so it opens on **1Hour**. The persona **entry TF is `1Day`** (see
`market-data-server/app/reports/personas.py`), which the report exposes as `schedule.timeframe`. The
chart should default to that and stay switchable.

---

## 1. Engine / builder half (Module 1, P6-01)

**File:** `market-data-server/app/reports/builder.py`

Add a per-symbol **`analysis`** block alongside `decisions` and `charts`, populated for the same
`detail_limit` top symbols. Three extra engine calls per symbol (best-effort; a failure embeds
`{available:false}` and never breaks the run):

```
analysis[SYM] = {
  "mtf":          { summary{}, alignment{} },          # /indicators/{sym}/mtf  (persona timeframes, drop heavy per-tf snapshots)
  "price_volume": { available, price, vwap, vwap_side, rvol, volume_trend, climax, effort_result[], key_candles[] },
  "price_action": { candlestick_patterns[], fibonacci{}, pivots{} },
}
```

- **MTF** uses the persona `timeframes` joined by comma and `preset=<persona>`; we keep only
  `summary` + `alignment` (the full `timeframes{}` snapshots are large and already implied by charts).
- **price_volume / price_action** use the persona **entry TF** (`schedule.timeframe`).
- Bump `SCHEMA_VERSION` 1 → 2. The viewer treats `analysis` as optional (older reports simply omit
  the new tabs), so this is backward compatible.
- Report size: MTF summary + PV + PA add ~2–4 KB/symbol → a few tens of KB per run. Acceptable for the
  static-asset model.

**Done when:** a freshly generated run has `analysis[SYM].mtf.alignment.label`,
`analysis[SYM].price_volume.key_candles`, and `analysis[SYM].price_action.candlestick_patterns`.

---

## 2. Viewer half — types

**File:** `src/lib/report-types.ts`

- Extend `EntryPlan` with `entry_pullback` (`label,type,zone{low,high},trigger,stop,target,rr,
  fill_odds{score,label,atr_away},note,ladder`). Add `scale_out,rr_blended,rr1,rr2,t1_sub_1r,capped`
  to the ladder type.
- Add typed fields to `Decision`: `reason,phase,trend_state,htf_agree,event_block,cost_block,
  market_block,take_small_block` (loose shapes — faithful to JSON, no invention).
- Add `MTF`, `PriceVolume`, `PriceAction`, and `SymbolAnalysis` interfaces; add optional
  `analysis?: Record<string, SymbolAnalysis>` to `Report`. Bump the `schema_version` comment.

---

## 3. Viewer half — render the already-present decision data

**Files:** `src/components/DecisionCards.tsx`, `src/components/SymbolDetailClient.tsx`

- **`SetupCard`** → surface **both** entries: keep `entry_now`, add a **Breakout-confirm** block from
  `entry_pullback` (zone `low–high`, trigger, fill-odds label, its own ladder). Two clearly-labelled
  entry options, per root CLAUDE.md #5–6 (confluence = size/direction; strategy = the plan).
- **`DecisionCard`** → add `phase`, `trend_state`, `htf_agree`; render `event_block` / `cost_block` /
  `take_small_block` as small caveat chips when present.
- New **`MarketContextCard`** (from `decision.market`) — tape state/label/bias, sector + sector_state,
  size multiplier, gated flag, note.
- **`StructureCard`** → add the top few `level_strength` entries (price → strength%).
- Chart price lines already read `entry_now`; also draw the `entry_pullback.zone` band + trigger line.

---

## 4. Viewer half — MTF / Price-Volume / Price-Action tabs

**New file:** `src/components/AnalysisTabs.tsx` (client). A tabbed panel under the decision grid,
rendering `report.analysis[symbol]` (render-only, no math):

- **MTF** — `alignment.label` headline + per-timeframe table (tf · bias/direction · score · RSI ·
  MACD hist · trend alignment), colored by direction. Mirrors the full trading-ui `MTFPanel`.
- **Price/Volume** — VWAP side, RVOL, volume trend, climax badge, effort-vs-result list, key candles
  (pattern + psychology + location).
- **Price-Action** — candlestick patterns (name/bias/reliability), Fibonacci levels, pivots.

Hidden gracefully when `analysis` is absent (older runs).

---

## 5. Swing default chart timeframe

**File:** `src/components/SymbolDetailClient.tsx`

Default `tf` to `report.schedule?.timeframe ?? decision.timeframe ?? timeframes[0]` (i.e. the persona
entry TF — `1Day` for swing), keeping every timeframe button switchable. `INTRADAY` map already marks
`1Day`/`1Week` as non-intraday for axis formatting.

---

## 6. Access-request page + offline code minting

**Decision:** store the request, **admin mints the code offline** (no self-serve access).

- **Public page** `/request-access` (`src/app/request-access/page.tsx` + `RequestAccessForm.tsx`):
  name, email, desired plan (`pro`/`free`), optional note. Posts to `/api/access-requests`.
- **Route** `POST /api/access-requests` (`src/app/api/access-requests/route.ts`): validates, writes a
  pending request to KV:
  - `req:<id>` → `{ id, name, email, plan, note, status:"pending", createdAt }`
  - append `id` to the `idx:reqs` list (JSON array) for admin listing.
  Rate-limit-lite: reject obviously bad email; dedupe same email while a request is still `pending`.
- **No auto-access.** Response is a friendly "we'll email your code" — the visitor gets **no** session.
- **Admin script** `scripts/mint-code.mjs` (Node, uses `wrangler kv`):
  - `list` → print pending `idx:reqs` requests.
  - `mint --req <id>` (or `--name --email --tier`) → generate `AIQ-XXXX-XXXX` + `userid`, build a
    `UserRecord`, print the two `wrangler kv key put` commands (user + `idx:code:`), and mark the
    request `fulfilled`. Codes are minted **offline** and handed to the user; they then redeem on `/`.
  - Mirror generated real subscribers into `scripts/users.seed.json` so prod re-seeds deterministically.
- **Landing link:** add "Need a code? **Request access**" under the redeem form on `/`.
- **Middleware/guard:** `/request-access` and `/api/access-requests` are public (like `/`).

---

## 7. Verify (root CLAUDE.md #15)

- `npx tsc --noEmit` in `aiqtrader-next-js` — clean.
- `python -m py_compile market-data-server/app/reports/builder.py`.
- Regenerate one run (`POST /api/v1/reports/schedules/{id}/run` or the CLI) and confirm the new
  `analysis` block is present + the viewer paints MTF/PV/PA tabs, both entries, and Day-default chart.
- Spot-check: no indicator/scoring math added to the viewer (rule #2) — all new panels are pure reads.

## 8. Done-when checklist

- [ ] Builder emits `analysis[SYM]{mtf,price_volume,price_action}`; `SCHEMA_VERSION=2`.
- [ ] Viewer types cover `entry_pullback`, decision blocks, and `analysis`.
- [ ] Breakout + pullback entries, market-context, level-strength, decision blocks all render.
- [ ] MTF / Price-Volume / Price-Action tabs render from the report (hidden on old runs).
- [ ] Swing detail opens on the **Daily** chart, switchable to Hourly/Weekly.
- [ ] `/request-access` posts a pending KV request; `scripts/mint-code.mjs` lists + mints offline codes.
- [ ] `tsc` + `py_compile` clean; a regenerated run verified end-to-end.

---

## 9. Market Overview (added) — persona-scoped macro context

**Decision:** dedicated page only; `schema_version` → **3** (market block is additive/optional).

**Engine/builder (Module 1):** `builder.py` embeds a top-level **`market: { timeframe, health, breadth }`**
once per run at the persona entry TF. Before computing it, the builder **syncs the index/sector ETFs**
(`SPY,QQQ,IWM,DIA,VIXY,XL*`) at that TF so the macro view is as fresh as the persona's data — directly
satisfying "keep it up to date per persona settings." Sources (already computed server-side, UI never
recomputes):
- `/market/health` → `indexes[]` (regime/adx/change), `volatility{band,atr_pct,vix_level,trend}`,
  `sectors[]` (RS rank, offensive/defensive), `scores{trend,volatility,sectors}`, `verdict{health,
  posture,outlook,indexes_up/down,offensive_leading}`.
- `/market/breadth` → `%>50/200MA`, advancers/decliners, new highs/lows, `breadth_score` (S&P universe).

**Viewer:** `MarketOverview.tsx` (pure render) + route `src/app/app/[scheduleId]/market/page.tsx`
(SSG per schedule). Verdict headline + pillar scores, indexes table, volatility+breadth gauges, sector
rotation bars. A **Market** link in `TopNav` (scoped to the schedule id). Middleware exempts the
`market` segment from the pro-only symbol-detail gate (macro context is available to all tiers).

**Persona flexibility & reporting structure:** the page reads `report.persona` + `report.schedule.timeframe`
and labels accordingly, so it renders unchanged for future **day**/**intraday** schedules — each persona
is its own schedule folder under `data/reports/<NNN-slug>/`, already switchable via `SCHEDULE_IDS`.

**Done when:** the market page renders health/breadth/sectors for a schema-3 run; hidden gracefully on
older runs. ✔ (verified with `20260711T023605Z`: verdict good/risk-on, XLF leading, breadth 62 over 514 names.)