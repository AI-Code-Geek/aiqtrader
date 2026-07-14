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
	const plan = d.decision.entry_plan?.entry_now;
	const pull = d.decision.entry_plan?.entry_pullback;
	return (
		<Card title="Setup — the executable plan" extra={<DirectionLabel direction={s.direction} />}>
			{/* Entry option 1 — immediate */}
			<div className="text-xs font-semibold uppercase tracking-wide text-muted">
				{plan?.label ?? "Now"} · {plan?.type ?? "market"}
			</div>
			<div className="mt-1 grid grid-cols-4 gap-2 text-center text-sm">
				<Stat label="Entry" value={`$${money(plan?.price ?? s.entry)}`} />
				<Stat label="Stop" value={`$${money(plan?.stop ?? s.stop)}`} tone="short" />
				<Stat label="Target" value={`$${money(plan?.target ?? s.target)}`} tone="long" />
				<Stat label="R:R" value={num(plan?.rr ?? s.rr)} />
			</div>
			{plan?.chase_risk ? (
				<p className="mt-2 text-xs text-muted">Chase risk: <b>{plan.chase_risk.label}</b> ({num(plan.chase_risk.atr_from_value)} ATR from value)</p>
			) : null}
			<Ladder ladder={plan?.ladder} />

			{/* Entry option 2 — staged trigger (breakout / pullback confirm) */}
			{pull ? (
				<div className="mt-4 rounded-xl border border-border bg-surface-2/50 p-3">
					<div className="mb-1 flex items-center justify-between">
						<div className="text-xs font-semibold uppercase tracking-wide text-brand">{pull.label} · {pull.type}</div>
						{pull.fill_odds ? <span className="text-xs text-muted">fill odds <b className="text-foreground">{pull.fill_odds.label}</b></span> : null}
					</div>
					<div className="grid grid-cols-4 gap-2 text-center text-sm">
						<Stat label="Trigger" value={`$${money(pull.trigger)}`} />
						<Stat label="Stop" value={`$${money(pull.stop)}`} tone="short" />
						<Stat label="Target" value={`$${money(pull.target)}`} tone="long" />
						<Stat label="R:R" value={num(pull.rr)} />
					</div>
					{pull.zone ? (
						<p className="mt-2 text-xs text-muted">Trigger zone <span className="mono text-foreground">${money(pull.zone.low)}–${money(pull.zone.high)}</span></p>
					) : null}
					{pull.note ? <p className="mt-1 text-xs text-muted">{pull.note}</p> : null}
					<Ladder ladder={pull.ladder} />
				</div>
			) : null}

			{/* The clock: how long the thesis stays valid + the time-stop. Applies to the whole plan. */}
			<DurationBlock d={d} />
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
			<RegimeChip label={d.regime} />
			<span className="text-sm text-muted">{d.best.label}</span>
			<span className="ml-auto text-sm text-muted">as of {new Date(d.computed_at).toLocaleString()}</span>
		</div>
	);
}
