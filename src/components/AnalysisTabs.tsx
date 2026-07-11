"use client";

/**
 * Symbol-detail analysis tabs — MTF alignment, Price/Volume psychology, Price-Action patterns.
 * Pure rendering of the report's `analysis[symbol]` block (root CLAUDE.md #2 — the UI never computes).
 * The block is baked in by the Module 1 report builder (schema_version ≥ 2); on older runs it's absent
 * and this component renders nothing.
 */
import { useState } from "react";
import type { SymbolAnalysis } from "@/lib/report-types";
import { money, num } from "@/lib/format";

const DIR_COLOR: Record<string, string> = {
	bull: "text-bull",
	bear: "text-bear",
	bullish: "text-bull",
	bearish: "text-bear",
	long: "text-long",
	short: "text-short",
};

type TabKey = "mtf" | "price_volume" | "price_action";

export function AnalysisTabs({ analysis }: { analysis?: SymbolAnalysis }) {
	const has: Record<TabKey, boolean> = {
		mtf: !!analysis?.mtf?.alignment,
		price_volume: !!analysis?.price_volume?.available,
		price_action: !!(analysis?.price_action?.candlestick_patterns?.length || analysis?.price_action?.fibonacci),
	};
	const allTabs: { key: TabKey; label: string }[] = [
		{ key: "mtf", label: "MTF" },
		{ key: "price_volume", label: "Price / Volume" },
		{ key: "price_action", label: "Price Action" },
	];
	const tabs = allTabs.filter((t) => has[t.key]);

	const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? "mtf");
	if (!tabs.length) return null;
	const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

	return (
		<div className="mt-4 rounded-2xl border border-border bg-surface p-4">
			<div className="mb-3 flex items-center gap-1 border-b border-border pb-2">
				{tabs.map((t) => (
					<button
						key={t.key}
						onClick={() => setTab(t.key)}
						className={`rounded-md px-3 py-1 text-sm ${t.key === active ? "bg-brand text-white" : "text-muted hover:bg-surface-2"}`}
					>
						{t.label}
					</button>
				))}
			</div>
			{active === "mtf" ? <MTFView a={analysis!} /> : null}
			{active === "price_volume" ? <PriceVolumeView a={analysis!} /> : null}
			{active === "price_action" ? <PriceActionView a={analysis!} /> : null}
		</div>
	);
}

function MTFView({ a }: { a: SymbolAnalysis }) {
	const mtf = a.mtf!;
	const al = mtf.alignment;
	const rows = Object.entries(mtf.summary ?? {});
	return (
		<div>
			{al ? (
				<div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
					<span className={`font-semibold ${DIR_COLOR[al.verdict.includes("bull") ? "bull" : al.verdict.includes("bear") ? "bear" : ""] ?? "text-muted"}`}>
						{al.label}
					</span>
					<span className="text-muted">agreement <b className="mono text-foreground">{num(al.agreement, 0)}%</b></span>
					<span className="text-muted">{al.bull}▲ · {al.bear}▼ · {al.neutral}◦ of {al.available}</span>
				</div>
			) : null}
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-left text-xs uppercase tracking-wide text-muted">
							<th className="py-1 pr-2">TF</th>
							<th className="py-1 pr-2">Bias</th>
							<th className="py-1 pr-2 text-right">Score</th>
							<th className="py-1 pr-2 text-right">RSI</th>
							<th className="py-1 pr-2 text-right">MACD hist</th>
							<th className="py-1 pr-2">Trend</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(([tf, r]) => (
							<tr key={tf} className="border-t border-border">
								<td className="py-1 pr-2 font-medium">{tf}</td>
								<td className={`py-1 pr-2 ${DIR_COLOR[r.direction ?? ""] ?? "text-muted"}`}>
									{r.available ? (r.bias ?? r.direction ?? "—") : (r.reason ?? "n/a")}
								</td>
								<td className="py-1 pr-2 text-right mono">{r.score != null ? num(r.score, 0) : "—"}</td>
								<td className="py-1 pr-2 text-right mono">{r.rsi != null ? num(r.rsi, 0) : "—"}</td>
								<td className="py-1 pr-2 text-right mono">{r.macd_hist != null ? num(r.macd_hist, 3) : "—"}</td>
								<td className="py-1 pr-2 text-muted">{r.trend_alignment ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function PriceVolumeView({ a }: { a: SymbolAnalysis }) {
	const pv = a.price_volume!;
	return (
		<div className="space-y-3 text-sm">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Stat label="VWAP" value={pv.vwap != null ? `$${money(pv.vwap)}` : "—"} sub={pv.vwap_side ?? undefined} />
				<Stat label="RVOL" value={pv.rvol != null ? `${num(pv.rvol)}×` : "—"} />
				<Stat label="Vol trend" value={pv.volume_trend ?? "—"} />
				<Stat
					label="Climax"
					value={pv.climax?.detected ? `${pv.climax.type ?? "yes"}` : "none"}
					sub={pv.climax?.detected && pv.climax.mult != null ? `${num(pv.climax.mult)}× avg` : undefined}
				/>
			</div>

			{pv.key_candles?.length ? (
				<div>
					<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Key candles</div>
					<ul className="space-y-1">
						{pv.key_candles.map((c, i) => (
							<li key={i} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-surface-2 px-2 py-1">
								<span className="font-medium">{c.pattern}</span>
								<span className="text-xs text-muted">{c.location}</span>
								<span className="text-muted">{c.psychology}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{pv.effort_result?.length ? (
				<div>
					<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Effort vs result (recent)</div>
					<div className="flex flex-wrap gap-1">
						{pv.effort_result.map((e) => (
							<span
								key={e.i}
								title={`effort ${e.effort} · result ${e.result}`}
								className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted"
							>
								{e.flag}
							</span>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}

function PriceActionView({ a }: { a: SymbolAnalysis }) {
	const pa = a.price_action!;
	const pats = pa.candlestick_patterns ?? [];
	const fib = pa.fibonacci as Record<string, unknown> | null | undefined;
	const fibLevels = (fib?.levels ?? fib?.retracements) as Record<string, number> | undefined;
	return (
		<div className="space-y-3 text-sm">
			{pats.length ? (
				<div>
					<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Candlestick patterns</div>
					<ul className="space-y-1">
						{pats.map((p, i) => {
							const dir = String(p.direction ?? p.bias ?? "").toLowerCase();
							return (
								<li key={i} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-surface-2 px-2 py-1">
									<span className={`font-medium ${DIR_COLOR[dir] ?? ""}`}>{String(p.name ?? p.pattern ?? "pattern")}</span>
									{p.direction || p.bias ? <span className="text-xs text-muted">{String(p.direction ?? p.bias)}</span> : null}
									{p.reliability != null ? <span className="ml-auto text-xs text-muted">reliability {String(p.reliability)}</span> : null}
								</li>
							);
						})}
					</ul>
				</div>
			) : (
				<p className="text-muted">No recent candlestick patterns.</p>
			)}

			{fibLevels ? (
				<div>
					<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Fibonacci</div>
					<ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
						{Object.entries(fibLevels).map(([k, v]) => (
							<li key={k} className="flex items-center justify-between">
								<span className="text-muted">{k}</span>
								<span className="mono">${money(Number(v))}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<div className="rounded-lg bg-surface-2 p-2">
			<div className="text-xs text-muted">{label}</div>
			<div className="mono font-semibold">{value}</div>
			{sub ? <div className="text-xs text-muted">{sub}</div> : null}
		</div>
	);
}
