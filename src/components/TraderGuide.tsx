/**
 * Trader Guide — how to read the report and, crucially, WHICH value to respect first.
 * Static explanatory content (no data). Grounded in the engine's decision model (root CLAUDE.md §2):
 * regime-gate first; Confluence = direction+size vs Strategy = the executable plan; the AI Brain is an
 * additive human-context layer that reconciles with the engine and never overrides its numbers.
 */

const LADDER: {
	n: number;
	title: string;
	answers: string;
	where: string;
	act: string;
	tone: string;
}[] = [
	{
		n: 1,
		title: "Regime & market tape",
		answers: "Is the environment even tradeable right now?",
		where: "Market page (health · posture · breadth) + each symbol's regime chip and Market-context card.",
		act: "Risk-off, gated, or high volatility → trade smaller or stand aside. A great setup in a hostile tape is still a bad trade. Gate first, signal second.",
		tone: "brand",
	},
	{
		n: 2,
		title: "Verdict — the go / no-go",
		answers: "Has the engine green-lit this, or not?",
		where: "Decision card headline: take · watch · arm · avoid.",
		act: "take = act now. watch = wait for the trigger to confirm. arm = set an alert, not yet. avoid = skip. Nothing below matters until the verdict earns your attention.",
		tone: "take",
	},
	{
		n: 3,
		title: "Confluence — direction & size",
		answers: "Which way is the weight of evidence, and how strongly?",
		where: "Confluence card: lean (bull/bear), strength (strong/moderate/weak), 5 dimensions.",
		act: "This governs DIRECTION and POSITION SIZE — not your entry price. Cleaner, stronger confluence → larger size (within your risk %). It is the 'how much', never the 'where'.",
		tone: "long",
	},
	{
		n: 4,
		title: "Strategy / Setup — the plan",
		answers: "Where exactly do I enter, stop, and target — and for how much reward per unit of risk?",
		where: "Setup card: entry · stop · target · R:R, plus the Breakout-confirm (staged) entry and the T1/T2 ladder.",
		act: "This governs the TRIGGER and the levels, and must agree with confluence on direction. Confluence = which way and how big; the setup = where and when. Reconcile them — never trade one as if it were the other.",
		tone: "long",
	},
	{
		n: 5,
		title: "Quality & confirmation",
		answers: "Is this setup likely real, or a trap? Has the turn actually happened?",
		where: "Signal-quality card (grade A–D, trap risk) and Turn-confirmation card (evidence vs missing).",
		act: "Grade D / high trap → demand more or skip. A REVERSAL is valid only WITH turn confirmation (rejection/reclaim candle, divergence, climax). A CONTINUATION fighting the tape is premature — discount hard.",
		tone: "watch",
	},
	{
		n: 6,
		title: "Supporting analysis",
		answers: "Do the other lenses agree, and is there room to the target?",
		where: "Tabs: MTF (higher-timeframe agreement), Vol/Candle (effort vs result), Price-Action (patterns/levels), HTF Structure.",
		act: "These corroborate or warn — they don't originate the trade. Higher-timeframe agreement turns a counter-trend entry from a knife-catch into a pullback. Check the stop sits beyond a real level and the target has room.",
		tone: "muted",
	},
	{
		n: 7,
		title: "AI Brain — human context",
		answers: "What can the historical math NOT see — events, catalysts, crowding?",
		where: "AI Brain panel: stance, narrative, catalysts, edge-cases, reconciliation, 8 dimensions.",
		act: "Additive context, NOT a price authority — it never changes entry/stop/target. But respect a high-severity edge-case (in-window earnings, 'likely trap', knife-catch) as a size-down or veto, even on a technical 'take'.",
		tone: "brand",
	},
];

const CONFLICTS: { when: string; rule: string }[] = [
	{
		when: "Confluence and the strategy disagree on direction",
		rule: "A CONTINUATION (with-trend) setup fighting the tape is premature or failing → discount hard / AVOID. A REVERSAL (deliberately counter-trend) fighting the tape is expected — but valid only WITH turn confirmation (divergence, climax, or rejection at a real level). No confirmation = a knife-catch.",
	},
	{
		when: "The AI Brain disagrees with the engine",
		rule: "The AI is context, not a price oracle. It never rewrites the plan's numbers. If it flags a high-severity risk (earnings inside your hold window, a 'likely trap', a counter-trend short into a strong buyer), respect the caution: reduce size or wait — even if the technical verdict is 'take'.",
	},
	{
		when: "Conviction / scores look high",
		rule: "Conviction ≠ probability. Conviction, confluence score and AI score are completeness / confidence gauges, not win-rates. Never size on them alone — they are one input to size, gated by regime and your account risk.",
	},
	{
		when: "Deciding position size",
		rule: "Size flows down: confluence strength → the engine's size_factor → the market size multiplier → your account risk %. Direction comes from confluence; risk-per-trade comes from your stop distance, not from conviction.",
	},
];

const GLOSSARY: { term: string; def: string }[] = [
	{ term: "Verdict", def: "The fused go/no-go: take (act) · watch (wait for trigger) · arm (alert only) · avoid (skip)." },
	{ term: "Conviction", def: "How complete the setup's conditions are (0–100). A completeness gauge, not a probability." },
	{ term: "Alignment", def: "Whether the strategy agrees with the confluence/tape. 'conflict' is a flag to read, not always a veto." },
	{ term: "Class / context", def: "Continuation = with-trend; Reversal = counter-trend (needs turn confirmation)." },
	{ term: "Confluence lean / strength", def: "Direction of the weight of evidence and how strong — drives direction + size." },
	{ term: "Quality grade / trap risk", def: "A–D grade and a trap-likelihood score. D / high trap → skip or demand more." },
	{ term: "R:R", def: "Reward-to-risk from entry, stop and target. The engine also gives a T1/T2 exit ladder." },
	{ term: "Entry now vs Breakout-confirm", def: "Immediate (market) entry vs a staged trigger that fires only on confirmation through a level." },
	{ term: "Size factor", def: "The engine's size multiplier from context; multiply into your own account-risk sizing." },
	{ term: "MTF alignment", def: "Do the higher timeframes agree? Agreement turns a counter-trend entry into a pullback." },
	{ term: "RVOL / climax", def: "Relative volume and exhaustion candles — the effort-vs-result behind a move." },
	{ term: "Level strength", def: "How well-tested a support/resistance price is (higher = more significant)." },
	{ term: "AI stance / size_hint", def: "supportive / cautionary / conflicting, plus add / hold / trim — a nudge, never authoritative on price." },
	{ term: "Market posture / breadth", def: "Risk-on/off and how many names participate — the tradeability of the whole tape." },
];

const TONE_BG: Record<string, string> = {
	brand: "bg-brand text-white",
	take: "bg-take text-white",
	long: "bg-long text-white",
	watch: "bg-watch text-white",
	muted: "bg-surface-2 text-foreground",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
	return <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{children}</div>;
}

export function TraderGuide() {
	return (
		<div className="mx-auto max-w-3xl px-5 py-10">
			{/* Hero */}
			<header className="mb-10">
				<div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">Trader guide</div>
				<h1 className="text-3xl font-bold tracking-tight">How to read a decision</h1>
				<p className="mt-3 text-[15px] leading-relaxed text-muted">
					There&rsquo;s a lot of data on each symbol. The trick is to read it <b className="text-foreground">in
					order</b> — each layer only matters once the one above it earns your attention. Respect them
					top-to-bottom, and when two disagree, use the reconciliation rules.
				</p>
			</header>

			{/* The one-minute version — highlighted callout */}
			<section className="mb-12 rounded-2xl border border-brand/25 bg-brand/[0.06] p-5">
				<SectionLabel>The one-minute version</SectionLabel>
				<p className="text-[15px] leading-relaxed">
					<b>Gate first</b> — is the tape tradeable? → <b>Verdict</b> — did the engine green-light it? →{" "}
					<b>Confluence</b> tells you <i>which way and how big</i> → the <b>Setup</b> tells you{" "}
					<i>where to enter, stop and target</i> → <b>Quality &amp; confirmation</b> check it isn&rsquo;t a trap →{" "}
					<b>MTF / Volume / Structure</b> corroborate → the <b>AI Brain</b> adds the events the math can&rsquo;t see.
				</p>
			</section>

			{/* Priority ladder — stepper */}
			<section className="mb-12">
				<SectionLabel>Respect them in this order</SectionLabel>
				<ol className="relative">
					{LADDER.map((r, i) => (
						<li key={r.n} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-6 last:pb-0">
							{/* connecting line */}
							{i < LADDER.length - 1 ? (
								<span className="absolute left-5 top-11 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden />
							) : null}
							{/* badge */}
							<span
								className={`z-10 flex h-10 w-10 items-center justify-center rounded-full text-base font-bold shadow-sm ${TONE_BG[r.tone]}`}
							>
								{r.n}
							</span>
							{/* card */}
							<div className="rounded-2xl border border-border bg-surface p-5">
								<h3 className="text-base font-semibold">{r.title}</h3>
								<p className="mt-1 text-sm italic text-muted">{r.answers}</p>
								<p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{r.act}</p>
								<p className="mt-3 text-xs leading-relaxed text-muted">
									<span className="font-semibold uppercase tracking-wide">Where</span> · {r.where}
								</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			{/* Reconciliation */}
			<section className="mb-12">
				<SectionLabel>When two layers disagree</SectionLabel>
				<div className="grid gap-4 sm:grid-cols-2">
					{CONFLICTS.map((c, i) => (
						<div key={i} className="rounded-2xl border border-border bg-surface p-5">
							<div className="text-sm font-semibold text-brand">{c.when}</div>
							<p className="mt-2 text-sm leading-relaxed text-muted">{c.rule}</p>
						</div>
					))}
				</div>
			</section>

			{/* Worked example */}
			<section className="mb-12">
				<SectionLabel>A worked example</SectionLabel>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-2xl border border-long/30 bg-long/[0.06] p-5">
						<div className="mb-2 text-sm font-semibold text-long">NVDA — every layer lines up</div>
						<p className="text-sm leading-relaxed">
							Tape neutral but XLK-led (gate ok) → <b className="text-take">TAKE</b> → confluence{" "}
							<b className="text-long">bullish · strong</b> → S/R Breakout{" "}
							<span className="mono">entry 210.99 · stop 204.57 · target 226.36</span> (R:R 2.4) → grade B, trap 31,
							MTF fully aligned bull → AI <b className="text-long">supportive</b>, earnings <i>outside</i> the window.
							A clean, standard-size long.
						</p>
					</div>
					<div className="rounded-2xl border border-short/30 bg-short/[0.06] p-5">
						<div className="mb-2 text-sm font-semibold text-short">GEV — stand aside</div>
						<p className="text-sm leading-relaxed">
							A counter-trend <b>short</b> the engine only <b>ARM</b>ed (not take), and the AI flags a{" "}
							<b className="text-short">knife-catch</b> — shorting a Strong-Buy name into an earnings beat. The rules
							say wait for a hard rejection at the level. Same data, opposite decision — because you respected the
							order.
						</p>
					</div>
				</div>
			</section>

			{/* Glossary */}
			<section className="mb-8">
				<SectionLabel>Glossary</SectionLabel>
				<dl className="grid gap-3 sm:grid-cols-2">
					{GLOSSARY.map((g) => (
						<div key={g.term} className="rounded-xl border border-border bg-surface p-4">
							<dt className="text-sm font-semibold">{g.term}</dt>
							<dd className="mt-1 text-sm leading-relaxed text-muted">{g.def}</dd>
						</div>
					))}
				</dl>
			</section>

			<p className="border-t border-border pt-5 text-xs leading-relaxed text-muted">
				Educational analysis, not financial advice. All values are computed by the engine and shown as-is; this app
				renders, it never re-computes.
			</p>
		</div>
	);
}
