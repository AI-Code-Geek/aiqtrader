import type { ReactNode } from "react";
import type { Validation, ValidationSlice } from "@/lib/report-types";
import { num } from "@/lib/format";

/**
 * P10-05 — "Historically" backtest-edge strip. Renders the engine's compact validation snapshot
 * (win-rate / avg R / sample size / period) right next to the live decision, so a trader sees whether
 * this setup has actually worked. Renders verbatim, never derives (CLAUDE.md §1-2). Honesty first:
 * always shows n + the period; thin/stale snapshots are visibly de-emphasized, never authoritative.
 */

const VERDICT_TONE: Record<string, string> = {
	take: "bg-long/20 text-long border-long/40",
	take_small: "bg-long/10 text-long border-long/30",
	arm: "bg-brand/15 text-brand border-brand/40",
	watch: "bg-watch/15 text-watch border-watch/40",
	avoid: "bg-short/10 text-short border-short/30",
};
const vLabel = (v?: string | null) => (v ? v.replace(/_/g, " ").toUpperCase() : "—");
const vTone = (v?: string | null) => VERDICT_TONE[v ?? ""] ?? "bg-surface-2 text-muted border-border";

/** avg R (expectancy), signed + colored by whether the edge is positive. */
function ExpR({ r }: { r: number | null | undefined }) {
	if (r == null) return <span className="text-muted">—</span>;
	return <span className={`mono ${r >= 0 ? "text-long" : "text-short"}`}>{r >= 0 ? "+" : ""}{num(r, 2)}R</span>;
}

/** One win-rate / avg-R / n row for a slice (verdict or strategy). */
function SliceRow({ label, s }: { label: ReactNode; s: ValidationSlice }) {
	return (
		<div className="flex items-center justify-between py-0.5 text-xs">
			<span className="text-muted">{label}</span>
			<span className="flex items-center gap-2">
				<span className="mono text-foreground">{num(s.win_rate, 0)}%</span>
				<span className="text-[10px] text-muted">({s.wins ?? "—"}/{s.n})</span>
				<ExpR r={s.expectancy} />
			</span>
		</div>
	);
}

export function ValidationCard({ v, strategyLabel }: { v: Validation; strategyLabel?: string }) {
	const dim = v.thin || v.stale;                 // de-emphasize weak evidence
	const asOf = v.as_of ? v.as_of.slice(0, 10) : "—";
	const verdicts = (v.by_verdict ?? []).filter((r) => (r.n ?? 0) > 0);

	return (
		<div className={`rounded-2xl border border-border bg-surface p-3 ${dim ? "opacity-70" : ""}`}>
			<div className="mb-2 flex items-center gap-2">
				<span className="text-sm font-semibold">Historically</span>
				<span className="text-[11px] text-muted">
					{num(v.period?.years, 1)}y · {v.n_trades} trades · as of {asOf}
				</span>
				<span className="ml-auto flex items-center gap-1">
					{v.thin && (
						<span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-muted" title="Small sample — treat as a weak hint">
							THIN
						</span>
					)}
					{v.stale && (
						<span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-muted" title="Snapshot is past the freshness window">
							STALE
						</span>
					)}
				</span>
			</div>

			{/* headline — overall win-rate + avg R over the whole sample */}
			<div className="flex items-baseline gap-4">
				<div>
					<div className="text-[10px] uppercase tracking-wide text-muted">Win rate</div>
					<div className="mono text-xl font-bold">{num(v.overall?.win_rate, 1)}%</div>
				</div>
				<div>
					<div className="text-[10px] uppercase tracking-wide text-muted">Avg R</div>
					<div className="text-xl font-bold"><ExpR r={v.overall?.expectancy} /></div>
				</div>
				<div className="ml-auto text-right text-[10px] text-muted">
					over {v.overall?.n ?? v.n_trades} setups
				</div>
			</div>

			{/* the candidate's OWN strategy row, when that strategy fired in the backtest */}
			{v.strategy && (
				<div className="mt-2 border-t border-border pt-2">
					<SliceRow
						label={<>This setup — <span className="text-foreground">{strategyLabel ?? v.strategy.strategy}</span></>}
						s={v.strategy}
					/>
				</div>
			)}

			{/* by verdict — does THIS symbol's TAKE / ARM / … actually win? */}
			{verdicts.length > 0 && (
				<div className="mt-2 border-t border-border pt-2">
					<div className="mb-1 text-[10px] uppercase tracking-wide text-muted">By verdict</div>
					{verdicts.map((r) => (
						<SliceRow
							key={r.verdict}
							label={<span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${vTone(r.verdict)}`}>{vLabel(r.verdict)}</span>}
							s={r}
						/>
					))}
				</div>
			)}

			<div className="mt-2 text-[9px] text-muted">
				Backtest evidence · engine {v.engine_version ?? "—"}. Not a forecast — pair with R:R.
			</div>
		</div>
	);
}
