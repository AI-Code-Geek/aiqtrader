/**
 * Market Overview — persona-scoped macro context for one report run. Pure rendering of the report's
 * top-level `market` block (root CLAUDE.md #2 — the UI never computes). The block is produced by the
 * Module 1 builder at the persona's entry timeframe (schema_version ≥ 3). Absent on older runs.
 */
import type { MarketOverview as MarketOverviewData, Persona } from "@/lib/report-types";
import { num, pct } from "@/lib/format";

const HEALTH_TONE: Record<string, string> = {
	good: "text-long",
	poor: "text-short",
	mixed: "text-watch",
};
const REGIME_TONE: Record<string, string> = {
	trending_up: "text-long",
	trending_down: "text-short",
	ranging: "text-muted",
	volatile: "text-watch",
};
const BAND_TONE: Record<string, string> = {
	calm: "text-long",
	normal: "text-long",
	elevated: "text-watch",
	high: "text-short",
};

function toneNum(n: number | null | undefined, tone = true): string {
	if (n == null) return "text-muted";
	if (!tone) return "";
	return n > 0 ? "text-long" : n < 0 ? "text-short" : "text-muted";
}

export function MarketOverview({
	market,
	persona,
	timeframe,
	generatedAt,
}: {
	market?: MarketOverviewData;
	persona: Persona;
	timeframe: string;
	generatedAt: string;
}) {
	if (!market || (!market.health && !market.breadth)) {
		return (
			<div className="mx-auto max-w-6xl px-4 py-8">
				<p className="text-muted">No market overview in this report run.</p>
			</div>
		);
	}
	const h = market.health;
	const b = market.breadth;
	const v = h?.verdict;

	return (
		<div className="mx-auto max-w-6xl px-4 py-4">
			<div className="mb-4 flex flex-wrap items-baseline gap-3">
				<h1 className="text-2xl font-bold">Market Overview</h1>
				<span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs capitalize text-muted">
					{persona} · {market.timeframe || timeframe}
				</span>
				<span className="ml-auto text-sm text-muted">as of {new Date(generatedAt).toLocaleString()}</span>
			</div>

			{/* Verdict headline */}
			{v ? (
				<div className="rounded-2xl border border-border bg-surface p-4">
					<div className="flex flex-wrap items-center gap-3">
						<span className={`text-lg font-bold capitalize ${HEALTH_TONE[v.health] ?? ""}`}>{v.health}</span>
						<span className="rounded-full bg-surface-2 px-2 py-0.5 text-sm capitalize">{v.posture}</span>
						<span className="text-sm text-muted">{v.indexes_up} up · {v.indexes_down} down</span>
						<span className="text-sm text-muted">{v.offensive_leading ? "offensive leading" : "defensive leading"}</span>
					</div>
					<p className="mt-2 text-sm text-muted">{v.outlook}</p>
					{h?.scores ? (
						<div className="mt-3 grid grid-cols-3 gap-2">
							<ScoreTile label="Trend" value={h.scores.trend} />
							<ScoreTile label="Volatility" value={h.scores.volatility} />
							<ScoreTile label="Sectors" value={h.scores.sectors} />
						</div>
					) : null}
				</div>
			) : null}

			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				{/* Indexes */}
				{h?.indexes?.length ? (
					<Card title="Indexes">
						<table className="w-full text-sm">
							<tbody>
								{h.indexes.map((i) => (
									<tr key={i.symbol} className="border-t border-border first:border-0">
										<td className="py-1.5 font-medium">{i.symbol}</td>
										<td className="py-1.5 text-muted">{i.name}</td>
										<td className={`py-1.5 capitalize ${REGIME_TONE[i.regime] ?? "text-muted"}`}>{i.regime?.replace("_", " ")}</td>
										<td className={`py-1.5 text-right mono ${toneNum(i.change_pct)}`}>{pct(i.change_pct)}</td>
										<td className="py-1.5 text-right text-xs text-muted">ADX {i.adx != null ? num(i.adx, 0) : "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				) : null}

				{/* Volatility + Breadth */}
				<Card title="Volatility & breadth">
					{h?.volatility ? (
						<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							<span>
								Band <b className={`capitalize ${BAND_TONE[h.volatility.band ?? ""] ?? ""}`}>{h.volatility.band ?? "—"}</b>
							</span>
							<span className="text-muted">ATR {h.volatility.atr_pct != null ? `${num(h.volatility.atr_pct)}%` : "—"}</span>
							<span className="text-muted">VIXY {h.volatility.vix_level ?? "—"} <span className={toneNum(h.volatility.vix_change_pct)}>{h.volatility.vix_change_pct != null ? pct(h.volatility.vix_change_pct) : ""}</span></span>
							<span className="text-muted capitalize">{h.volatility.trend ?? ""}</span>
						</div>
					) : null}
					{b?.available ? (
						<div className="space-y-2">
							<Gauge label="% above 50-MA" value={b.pct_above_50ma} />
							<Gauge label="% above 200-MA" value={b.pct_above_200ma} />
							<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
								<span><b className="text-long">{b.advancers ?? 0}</b> adv · <b className="text-short">{b.decliners ?? 0}</b> dec</span>
								<span><b className="text-long">{b.new_high_20d ?? 0}</b> new highs · <b className="text-short">{b.new_low_20d ?? 0}</b> new lows</span>
								<span>score <b className="text-foreground">{b.breadth_score ?? "—"}</b> · {b.analyzed} names</span>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted">Breadth unavailable for this run.</p>
					)}
				</Card>
			</div>

			{/* Sector rotation */}
			{h?.sectors?.length ? (
				<div className="mt-4">
					<Card title="Sector rotation — relative strength">
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{h.sectors.map((s) => (
								<div key={s.symbol} className="rounded-lg bg-surface-2 p-2">
									<div className="flex items-center justify-between">
										<span className="font-medium">{s.symbol}</span>
										<span className={`text-xs uppercase ${s.group === "offensive" ? "text-long" : s.group === "defensive" ? "text-watch" : "text-muted"}`}>{s.group}</span>
									</div>
									<div className="mt-1 flex items-center gap-2">
										<span className="h-1.5 flex-1 rounded-full bg-background">
											<span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, s.rs_rank ?? 0))}%` }} />
										</span>
										<span className={`mono text-xs ${toneNum(s.return_pct)}`}>{pct(s.return_pct)}</span>
									</div>
									<div className="mt-0.5 text-xs text-muted">{s.name} · RS {s.rs_rank ?? "—"}</div>
								</div>
							))}
						</div>
					</Card>
				</div>
			) : null}
		</div>
	);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-2xl border border-border bg-surface p-4">
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
			{children}
		</div>
	);
}

function ScoreTile({ label, value }: { label: string; value: number | null | undefined }) {
	const tone = value == null ? "text-muted" : value >= 66 ? "text-long" : value >= 40 ? "text-watch" : "text-short";
	return (
		<div className="rounded-lg bg-surface-2 p-2 text-center">
			<div className="text-xs text-muted">{label}</div>
			<div className={`mono text-lg font-semibold ${tone}`}>{value ?? "—"}</div>
		</div>
	);
}

function Gauge({ label, value }: { label: string; value: number | null | undefined }) {
	const v = value ?? 0;
	const tone = v >= 60 ? "bg-long" : v >= 40 ? "bg-watch" : "bg-short";
	return (
		<div>
			<div className="mb-0.5 flex items-center justify-between text-sm">
				<span className="text-muted">{label}</span>
				<span className="mono">{value != null ? `${num(value, 0)}%` : "—"}</span>
			</div>
			<span className="block h-2 rounded-full bg-surface-2">
				<span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
			</span>
		</div>
	);
}
