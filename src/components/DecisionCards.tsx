/**
 * Symbol-detail decision cards. Pure rendering of server-computed fields (CLAUDE.md #2).
 *
 * Reconciliation (CLAUDE.md §2 #5–6, DEVPLAN §6): Confluence = direction + size (weight of evidence);
 * Strategy/Setup = the executable plan. They are shown as two distinct axes. When alignment=conflict
 * we surface it: continuation-vs-tape → discount/avoid; reversal-vs-tape → needs turn confirmation
 * (we show confirmation.missing[]).
 */
import type { SymbolDecision } from "@/lib/report-types";
import { money, num } from "@/lib/format";
import { VerdictBadge, QualityGrade, ConvictionMeter, DirectionLabel, RegimeChip } from "./badges";

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
	return (
		<div className="rounded-2xl border border-border bg-surface p-4">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
				{extra}
			</div>
			{children}
		</div>
	);
}

const READ_COLOR: Record<string, string> = {
	bull: "text-bull",
	bear: "text-bear",
	bullish: "text-bull",
	bearish: "text-bear",
};

export function DecisionCard({ d }: { d: SymbolDecision }) {
	const dec = d.decision;
	const conflict = dec.alignment === "conflict";
	return (
		<Card
			title="Decision"
			extra={<VerdictBadge verdict={dec.verdict} alignment={dec.alignment} />}
		>
			<div className="mb-2 flex items-center justify-between text-sm">
				<span className="text-muted">Conviction</span>
				<span className="mono">
					{dec.conviction}
					{dec.raw_conviction !== dec.conviction ? <span className="text-muted"> (raw {dec.raw_conviction})</span> : null}
				</span>
			</div>
			<ConvictionMeter value={dec.conviction} />
			<dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
				<Row k="Alignment" v={<span className={conflict ? "font-semibold text-short" : "text-long"}>{dec.alignment}</span>} />
				<Row k="Class" v={dec.klass} />
				<Row k="Context" v={dec.context_label || dec.context} />
				<Row k="HTF lean" v={<span className={READ_COLOR[dec.htf_lean] ?? ""}>{dec.htf_lean}</span>} />
				<Row k="Size factor" v={`${num(dec.size_factor)}×`} />
				<Row k="Rank" v={num(dec.rank_score, 1)} />
				{dec.phase ? <Row k="Phase" v={dec.phase} /> : null}
				{dec.trend_state ? <Row k="Trend state" v={dec.trend_state} /> : null}
				{dec.htf_agree != null ? <Row k="HTF agree" v={String(dec.htf_agree)} /> : null}
			</dl>
			<CaveatBlocks dec={dec} />
			{dec.reason ? <p className="mt-3 rounded-lg bg-surface-2 p-2 text-sm text-muted">{dec.reason}</p> : null}
			{conflict ? (
				<p className="mt-2 rounded-lg border border-short/30 bg-short/10 p-2 text-xs text-short">
					Strategy fights the tape ({dec.klass}). {dec.klass === "reversal" ? "Reversal — valid only with turn confirmation (see missing evidence below)." : "Continuation vs. tape — premature; discount / avoid."}
				</p>
			) : null}
		</Card>
	);
}

/** Small amber caveat chips from the decision's gate/adjustment blocks (only shown when present). */
function CaveatBlocks({ dec }: { dec: SymbolDecision["decision"] }) {
	const blocks: { key: string; text: string }[] = [];
	const push = (key: string, b: unknown) => {
		if (!b || typeof b !== "object") return;
		const o = b as Record<string, unknown>;
		if (o.active === false) return;
		const text = (o.note ?? o.detail ?? o.label ?? o.reason) as string | undefined;
		if (text) blocks.push({ key, text });
	};
	push("event", dec.event_block);
	push("cost", dec.cost_block);
	push("market", dec.market_block);
	push("take_small", dec.take_small_block);
	if (!blocks.length) return null;
	return (
		<ul className="mt-3 space-y-1">
			{blocks.map((b) => (
				<li key={b.key} className="rounded-lg border border-watch/30 bg-watch/10 p-2 text-xs text-watch">
					<span className="font-semibold uppercase tracking-wide">{b.key.replace("_", " ")}</span> · {b.text}
				</li>
			))}
		</ul>
	);
}

export function ConfluencePanel({ d }: { d: SymbolDecision }) {
	const c = d.confluence;
	const dims = ["trend", "momentum", "volatility", "volume", "structure"];
	return (
		<Card
			title="Confluence — direction & size"
			extra={<span className={`text-sm font-semibold ${READ_COLOR[c.lean] ?? "text-muted"}`}>{c.lean} · {c.strength}</span>}
		>
			<div className="mb-2 flex items-center gap-2 text-sm text-muted">
				<span>score <b className="mono text-foreground">{num(c.score, 2)}</b></span>
				<span>· regime {c.regime}</span>
			</div>
			<ul className="space-y-1.5">
				{dims.filter((k) => c.dimensions[k]).map((k) => {
					const dim = c.dimensions[k];
					return (
						<li key={k} className="flex items-start gap-2 text-sm">
							<span className={`w-24 shrink-0 font-medium ${READ_COLOR[dim.read] ?? "text-muted"}`}>
								{k} · {dim.read}
							</span>
							<span className="text-muted">{dim.detail}</span>
							<span className="ml-auto mono text-xs text-muted">w{num(dim.weight, 1)}</span>
						</li>
					);
				})}
			</ul>
		</Card>
	);
}

function Ladder({ ladder }: { ladder?: import("@/lib/report-types").Ladder }) {
	const targets = ladder?.targets ?? [];
	if (!targets.length) return null;
	return (
		<div className="mt-2">
			<div className="mb-1 flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wide text-muted">Targets</span>
				{ladder?.rr_blended != null ? (
					<span className="text-xs text-muted">blended <b className="mono text-foreground">{num(ladder.rr_blended)}R</b></span>
				) : null}
			</div>
			<ul className="space-y-1">
				{targets.map((t, i) => (
					<li key={i} className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1 text-sm">
						<span className="font-medium">{t.milestone}</span>
						<span className="mono">${money(t.level)}</span>
						<span className="text-muted">{num(t.rr)}R</span>
						<span className="text-xs text-muted">{t.basis?.replace(/_/g, " ")}</span>
						<span className="text-muted">{t.pct}%</span>
					</li>
				))}
			</ul>
			{ladder?.scale_out ? <p className="mt-1 text-xs text-muted">{ladder.scale_out}</p> : null}
		</div>
	);
}

/**
 * The trade's clock: how long the thesis is good for, and what to do when it expires.
 * Straight from `decision.entry_plan.duration` (engine-computed) — the UI only formats it.
 */
function DurationBlock({ d }: { d: SymbolDecision }) {
	const dur = d.decision.entry_plan?.duration;
	if (!dur) return null;
	const ts = dur.time_stop;
	return (
		<div className="mt-3 rounded-xl border border-border bg-surface-2/60 p-3">
			<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">How long it&rsquo;s valid</div>
			{dur.valid_until ? (
				<p className="text-sm">{dur.valid_until}</p>
			) : (
				<p className="text-sm">
					expected ~{dur.expected_bars} {dur.unit ?? "bar"}s, valid up to ~{dur.max_bars} {dur.unit ?? "bar"}s
				</p>
			)}
			{ts ? (
				<p className="mt-1 text-xs text-watch">
					<b className="uppercase tracking-wide">Time-stop</b> · {ts.action?.replace(/_/g, " ") ?? "exit"}
					{ts.note ? ` — ${ts.note}` : null}
				</p>
			) : null}
			{dur.flat_by_close ? (
				<p className="mt-1 text-xs text-short">Flat by the close — do not hold overnight.</p>
			) : null}
		</div>
	);
}

export function SetupCard({ d }: { d: SymbolDecision }) {
	const s = d.best.setup;
	const ep = d.decision.entry_plan;
	// A strategy can fire without producing executable geometry — the engine then emits
	// `best.setup: null` AND `entry_plan: null` rather than a half-built plan. There is no plan to
	// render, and dereferencing either one crashed the static build (011-industrials/WM, 2026-08-01).
	if (!s && !ep) {
		return (
			<Card title="Setup — the executable plan">
				<p className="text-sm text-muted">
					No executable plan right now — {d.best.label ?? d.best.strategy} fired, but it did not
					produce a valid entry/stop/target. Treat this as context, not a trade.
				</p>
			</Card>
		);
	}
	const now = ep?.entry_now;
	const pull = ep?.entry_pullback;
	// P15-05 — render the engine's normalized `entries[]` led by `primary_kind` (the same model the
	// trading-ui app uses). Fall back to synthesizing from entry_now/entry_pullback for older payloads.
	// `s` may still be null here when a plan exists without a setup — every use of it below is a
	// FALLBACK for a value the entry leg didn't carry, so optional-chain them all.
	const dir = ep?.direction ?? s?.direction ?? null;
	const move = dir === "long" ? "breakup" : "breakdown";
	const entries = ep?.entries?.length
		? ep.entries
		: [
				now && { kind: "now" as const, label: `${now.label ?? "Now"} · market`, order: now.type, trigger: now.price, zone: null, stop: now.stop, target: now.target, rr: now.rr, odds: now.chase_risk?.label ?? null, odds_kind: "chase" as const, primary: !pull },
				pull && { kind: (pull.type === "stop" ? "breakout" : "pullback") as "breakout" | "pullback", label: pull.type === "stop" ? `Breakout · ${move}` : "Pullback · better price", order: pull.type, trigger: pull.trigger, zone: pull.zone ?? null, stop: pull.stop, target: pull.target, rr: pull.rr, odds: pull.fill_odds?.label ?? null, odds_kind: "fill" as const, primary: true },
		  ].filter(Boolean) as NonNullable<typeof ep>["entries"];
	const primaryKind = ep?.primary_kind ?? entries?.find((e) => e.primary)?.kind ?? "now";
	const governingRr = ep?.governing_rr ?? entries?.find((e) => e.kind === primaryKind)?.rr ?? s?.rr;
	// ladder rides on the raw entry objects, keyed by tactic (now → entry_now, else → entry_pullback)
	const ladderFor = (kind: string) => (kind === "now" ? now?.ladder : pull?.ladder);

	return (
		<Card
			title="Setup — the executable plan"
			extra={
				<span className="flex items-center gap-2">
					<span className="text-xs text-muted" title="R:R of the recommended entry tactic">R:R <b className="mono text-foreground">{num(governingRr)}</b></span>
					{dir ? <DirectionLabel direction={dir} /> : null}
				</span>
			}
		>
			{(entries ?? []).map((e) => {
				const recommended = e.kind === primaryKind;
				return (
					<div key={e.kind} className={`mb-3 rounded-xl border p-3 ${recommended ? "border-brand/50 bg-brand/5" : "border-border bg-surface-2/40"}`}>
						<div className="mb-1 flex items-center justify-between">
							<div className="text-xs font-semibold uppercase tracking-wide text-brand">
								{recommended ? "★ " : ""}{e.label}
							</div>
							{e.odds ? (
								<span className="text-xs text-muted">{e.odds_kind === "chase" ? "chase" : "fill"} <b className="text-foreground">{e.odds}</b></span>
							) : null}
						</div>
						<div className="grid grid-cols-4 gap-2 text-center text-sm">
							<Stat label={e.order === "market" ? "Entry" : "Trigger"} value={`$${money(e.trigger ?? s?.entry)}`} />
							<Stat label="Stop" value={`$${money(e.stop ?? s?.stop)}`} tone="short" />
							<Stat label="Target" value={`$${money(e.target ?? s?.target)}`} tone="long" />
							<Stat label="R:R" value={num(e.rr ?? s?.rr)} />
						</div>
						{e.zone ? (
							<p className="mt-2 text-xs text-muted">Trigger zone <span className="mono text-foreground">${money(e.zone.low)}–${money(e.zone.high)}</span></p>
						) : null}
						{/* P15-08 — plain one-liner: what this tactic means for the trader */}
						{e.plain ? <p className="mt-1 text-xs text-muted">{e.plain}</p> : null}
						<Ladder ladder={ladderFor(e.kind)} />
					</div>
				);
			})}

			{/* The clock: how long the thesis stays valid + the time-stop. Applies to the whole plan. */}
			<DurationBlock d={d} />
		</Card>
	);
}

/** P12 — advisory market-timing (VIX-adaptive volatility + day-of-week institutional cycle). Display-only. */
export function MarketTimingCard({ d }: { d: SymbolDecision }) {
	const mt = d.decision.market_timing;
	if (!mt || (!mt.vol && !mt.cycle)) return null;
	const vol = mt.vol, cyc = mt.cycle;
	const volTone = vol?.regime === "high" || vol?.regime === "elevated" ? "text-short" : vol?.regime === "calm" ? "text-long" : "text-muted";
	return (
		<Card title="Market timing — volatility & cycle">
			{vol ? (
				<div className="mb-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted">Volatility ({vol.proxy ?? "VIX"})</span>
						<span className={`font-semibold capitalize ${volTone}`}>{vol.regime}</span>
					</div>
					<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
						{vol.percentile != null ? <span>pct <b className="mono text-foreground">{num(vol.percentile, 0)}</b></span> : null}
						{vol.stop_multiplier != null ? <span>stop ×<b className="mono text-foreground">{num(vol.stop_multiplier)}</b></span> : null}
						{vol.size_scale != null ? <span>size ×<b className="mono text-foreground">{num(vol.size_scale)}</b></span> : null}
					</div>
					{vol.note ? <p className="mt-1 text-xs text-muted">{vol.note}</p> : null}
				</div>
			) : null}
			{cyc ? (
				<div className="border-t border-border pt-2 text-sm">
					<div className="flex items-center justify-between">
						<span className="text-muted">Cycle {cyc.day ? `· ${cyc.day}` : ""}</span>
						<span className="font-medium">{cyc.phase}</span>
					</div>
					{cyc.note ? <p className="mt-1 text-xs text-muted">{cyc.note}</p> : null}
				</div>
			) : null}
		</Card>
	);
}

/** P3.1 / P10-08 — the calibrated Math Score win-probability + the symbol-aware reads. Conviction ≠ this. */
export function MathScoreCard({ d }: { d: SymbolDecision }) {
	const m = d.decision.math;
	if (!m) return null;
	const pop = m.population?.score ?? m.score;
	const emp = m.symbol_empirical;
	const aware = m.symbol_aware;
	if (pop == null && !emp && !aware) return null;
	const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
	return (
		<Card
			title="Win-probability (Math Score)"
			extra={<span className="text-xs text-muted" title="A calibrated win-rate — unlike conviction, which is completeness">calibrated edge</span>}
		>
			<dl className="grid grid-cols-2 gap-y-1.5 text-sm">
				<Row k="Population" v={<span className="mono">{pct(pop as number | null)}</span>} />
				{emp ? <Row k={`This symbol (n=${emp.n})`} v={<span className="mono">{pct(emp.win_rate > 1 ? emp.win_rate / 100 : emp.win_rate)}</span>} /> : null}
				{aware ? <Row k={`Symbol-aware (n=${aware.n})`} v={<span className="mono">{pct(aware.score)}</span>} /> : null}
			</dl>
			<p className="mt-2 text-xs text-muted">This is the only calibrated win-rate. Conviction is a completeness gauge, not a probability.</p>
		</Card>
	);
}

export function MarketContextCard({ d }: { d: SymbolDecision }) {
	const m = d.decision.market;
	if (!m) return null;
	return (
		<Card title="Market context — tape & sector" extra={<span className="text-sm text-muted">{m.label}</span>}>
			<dl className="grid grid-cols-2 gap-y-1.5 text-sm">
				<Row k="Tape state" v={m.state} />
				<Row k="Bias" v={<span className={READ_COLOR[m.bias] ?? ""}>{m.bias}</span>} />
				{m.posture ? <Row k="Posture" v={m.posture} /> : null}
				<Row k="Sector" v={`${m.sector} · ${m.sector_state}`} />
				{m.size_mult != null ? <Row k="Size ×" v={`${num(m.size_mult)}×`} /> : null}
				{m.gated ? <Row k="Gated" v={<span className="text-short">yes</span>} /> : null}
			</dl>
			{m.note ? <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs text-muted">{m.note}</p> : null}
		</Card>
	);
}

export function QualityCard({ d }: { d: SymbolDecision }) {
	const q = d.best.quality;
	// Quality is scored FROM the setup, so it is null exactly when the setup is (see BestStrategy).
	if (!q) {
		return (
			<Card title="Signal quality">
				<p className="text-sm text-muted">Not scored — no executable setup was produced for this symbol.</p>
			</Card>
		);
	}
	return (
		<Card title="Signal quality" extra={<QualityGrade grade={q.grade} />}>
			<div className="mb-2 flex items-center gap-3 text-sm text-muted">
				<span>trap risk <b className="mono text-foreground">{num(q.trap_risk, 2)}</b></span>
				{q.verdict ? <span>· {q.verdict}</span> : null}
			</div>
			{q.confirmations?.length ? (
				<ul className="mb-2 space-y-1 text-sm">
					{q.confirmations.map((f, i) => (
						<li key={i} className="text-long">✓ <span className="text-foreground">{f.factor}</span> <span className="text-muted">{f.detail}</span></li>
					))}
				</ul>
			) : null}
			{q.warnings?.length ? (
				<ul className="space-y-1 text-sm">
					{q.warnings.map((f, i) => (
						<li key={i} className="text-short">! <span className="text-foreground">{f.factor}</span> <span className="text-muted">{f.detail}</span></li>
					))}
				</ul>
			) : null}
		</Card>
	);
}

export function ConfirmationCard({ d }: { d: SymbolDecision }) {
	const cf = d.decision.confirmation;
	if (!cf) return null;
	return (
		<Card title="Turn confirmation" extra={<span className="mono text-sm text-muted">{cf.score} · {cf.state}</span>}>
			{cf.evidence?.length ? (
				<ul className="mb-2 space-y-1 text-sm">
					{cf.evidence.map((e, i) => (
						<li key={i} className="text-long">✓ <span className="text-muted">{e.axis}:</span> {e.detail}</li>
					))}
				</ul>
			) : null}
			{cf.missing?.length ? (
				<ul className="space-y-1 text-sm">
					{cf.missing.map((e, i) => (
						<li key={i} className="text-muted">○ <span>{e.axis}:</span> {e.detail}</li>
					))}
				</ul>
			) : null}
		</Card>
	);
}

export function ConditionsChecklist({ d }: { d: SymbolDecision }) {
	const conds = d.best.conditions ?? [];
	if (!conds.length) return null;
	const met = conds.filter((c) => c.met).length;
	return (
		<Card title="Strategy conditions" extra={<span className="mono text-sm text-muted">{met}/{conds.length}</span>}>
			<ul className="space-y-1 text-sm">
				{conds.map((c, i) => (
					<li key={i} className={c.met ? "text-foreground" : "text-muted"}>
						<span className={c.met ? "text-long" : "text-muted"}>{c.met ? "✓" : "○"}</span> {c.name}
					</li>
				))}
			</ul>
		</Card>
	);
}

export function StructureCard({ d }: { d: SymbolDecision }) {
	const htf = d.structure?.htf;
	if (!htf) return null;
	const rows = (arr: { price: number; dist_entry_atr: number }[] | undefined, label: string, tone: string) =>
		(arr ?? []).map((lvl, i) => (
			<li key={label + i} className="flex items-center justify-between text-sm">
				<span className={tone}>{label}</span>
				<span className="mono">${money(lvl.price)}</span>
				<span className="text-muted">{num(lvl.dist_entry_atr)} ATR</span>
			</li>
		));
	// level_strength: { "628.2": 86.6, ... } — top scored levels near price.
	const ls = d.structure?.level_strength as Record<string, number> | undefined;
	const strongest = ls
		? Object.entries(ls)
				.map(([price, strength]) => ({ price: Number(price), strength }))
				.sort((a, b) => b.strength - a.strength)
				.slice(0, 6)
				.sort((a, b) => b.price - a.price)
		: [];
	return (
		<Card title={`HTF structure · ${htf.htf_tf}`}>
			<ul className="space-y-1">
				{rows(htf.resistances, "Resistance", "text-short")}
				{rows(htf.supports, "Support", "text-long")}
			</ul>
			{strongest.length ? (
				<div className="mt-3">
					<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Level strength</div>
					<ul className="space-y-1">
						{strongest.map((l) => (
							<li key={l.price} className="flex items-center justify-between text-sm">
								<span className="mono">${money(l.price)}</span>
								<span className="ml-2 h-1.5 flex-1 rounded-full bg-surface-2">
									<span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, l.strength)}%` }} />
								</span>
								<span className="ml-2 mono text-xs text-muted">{num(l.strength, 0)}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</Card>
	);
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
	return (
		<>
			<dt className="text-muted">{k}</dt>
			<dd className="text-right font-medium">{v}</dd>
		</>
	);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "long" | "short" }) {
	return (
		<div className="rounded-lg bg-surface-2 p-2">
			<div className="text-xs text-muted">{label}</div>
			<div className={`mono font-semibold ${tone === "long" ? "text-long" : tone === "short" ? "text-short" : ""}`}>{value}</div>
		</div>
	);
}

/** Small header stat row for the detail page hero. */
export function SymbolHero({ d }: { d: SymbolDecision }) {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<h1 className="text-2xl font-bold">{d.symbol}</h1>
			<span className="mono text-lg">${money(d.price)}</span>
			<RegimeChip label={d.regime_plain ?? d.regime} />
			<span className="text-sm text-muted">{d.best.label}</span>
			<span className="ml-auto text-sm text-muted">as of {new Date(d.computed_at).toLocaleString()}</span>
		</div>
	);
}
