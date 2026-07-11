/**
 * AI Brain view for one symbol — renders the `<version>.ai.json` `symbols[SYM]` block (Phase 7).
 * Pure rendering of the AI plugin's output (root CLAUDE.md #2 — the UI never computes). The AI track
 * is a SEPARATE opinion layer that reconciles with the engine's technical decision; it never overrides
 * it. Shown only when the run has an AI extension and this symbol was enriched.
 */
import type { AiSymbol, AiLean } from "@/lib/report-types";
import { money, num } from "@/lib/format";

const LEAN_TONE: Record<string, string> = {
	bullish: "text-long",
	mildly_bullish: "text-long",
	neutral: "text-muted",
	mildly_bearish: "text-short",
	bearish: "text-short",
};
const STANCE_TONE: Record<string, string> = {
	supportive: "text-long",
	cautionary: "text-watch",
	conflicting: "text-short",
};
const SEV_TONE: Record<string, string> = { high: "text-short", medium: "text-watch", low: "text-muted" };
const DIM_LABELS: Record<string, string> = {
	news_flow: "News flow",
	analyst: "Analyst",
	earnings: "Earnings",
	macro_rates: "Macro / rates",
	policy_regulatory: "Policy / reg",
	sector_peers: "Sector peers",
	social_retail: "Social / retail",
	institutional: "Institutional",
};

function leanTone(l: AiLean | undefined): string {
	return LEAN_TONE[l ?? ""] ?? "text-muted";
}

export function AiPanel({ ai, symbol }: { ai?: AiSymbol; symbol: string }) {
	if (!ai) {
		return (
			<Section>
				<p className="text-sm text-muted">
					No AI analysis for {symbol} in this run — the AI Brain enriches non-avoid candidates only, or this
					run predates the AI layer.
				</p>
			</Section>
		);
	}
	const scoreTone = ai.score >= 60 ? "text-long" : ai.score >= 40 ? "text-watch" : "text-short";
	return (
		<Section>
			{/* Header */}
			<div className="mb-3 flex flex-wrap items-center gap-3">
				<span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand">
					AI Brain
				</span>
				<span className={`text-lg font-bold capitalize ${STANCE_TONE[ai.stance] ?? ""}`}>{ai.stance}</span>
				<span className="text-sm text-muted">
					score <b className={`mono ${scoreTone}`}>{ai.score}</b> · {ai.confidence} confidence
				</span>
				<span className="text-sm text-muted">size: <b className="capitalize text-foreground">{ai.size_hint}</b></span>
				<span className={`ml-auto text-sm ${ai.alignment === "conflict" ? "text-short" : "text-long"}`}>
					{ai.alignment === "conflict" ? "conflicts with engine" : "agrees with engine"}
				</span>
			</div>

			{/* Sentiment */}
			<div className="mb-3 rounded-xl bg-surface-2 p-3">
				<div className="mb-1 flex items-center gap-2 text-sm">
					<span className={`font-semibold capitalize ${leanTone(ai.sentiment.label)}`}>{ai.sentiment.label.replace("_", " ")}</span>
					<span className="text-muted">sentiment {num(ai.sentiment.score, 2)}</span>
				</div>
				<ul className="space-y-0.5 text-sm text-muted">
					{ai.sentiment.drivers?.map((d, i) => (
						<li key={i}>• {d}</li>
					))}
				</ul>
			</div>

			{/* Narrative + reconciliation */}
			{ai.narrative ? <p className="mb-2 text-sm">{ai.narrative}</p> : null}
			{ai.reconciliation ? (
				<div className="mb-3 rounded-lg border border-border bg-surface p-2 text-sm">
					<span className="text-xs font-semibold uppercase tracking-wide text-muted">Reconciliation · </span>
					<span className="text-muted">{ai.reconciliation}</span>
				</div>
			) : null}

			<div className="grid gap-3 md:grid-cols-2">
				{/* Dimensions */}
				<Card title="Dimensions">
					<ul className="space-y-1.5">
						{Object.entries(ai.dimensions ?? {}).map(([k, d]) => (
							<li key={k} className="flex items-start gap-2 text-sm">
								<span className="w-24 shrink-0 text-muted">{DIM_LABELS[k] ?? k}</span>
								<span className={`w-24 shrink-0 font-medium capitalize ${leanTone(d.lean)}`}>{String(d.lean).replace("_", " ")}</span>
								<span className="text-muted">{d.note}</span>
							</li>
						))}
					</ul>
				</Card>

				{/* Catalysts */}
				<Card title="Catalysts">
					<ul className="space-y-1.5">
						{ai.catalysts?.map((c, i) => (
							<li key={i} className="text-sm">
								<span className="font-medium capitalize">{c.type}</span>
								{c.date ? <span className="text-muted"> · {c.date}</span> : null}
								<span className={`ml-1 rounded px-1 text-xs ${c.impact === "high" ? "bg-short/10 text-short" : "bg-surface-2 text-muted"}`}>
									{c.impact}{c.in_window ? " · in-window" : ""}
								</span>
								<p className="text-muted">{c.note}</p>
							</li>
						))}
					</ul>
				</Card>

				{/* Edge cases / risks */}
				{ai.edge_cases?.length ? (
					<Card title="Edge cases">
						<ul className="space-y-1.5">
							{ai.edge_cases.map((e, i) => (
								<li key={i} className="text-sm">
									<span className={`font-medium ${SEV_TONE[e.severity] ?? ""}`}>{e.risk.replace(/_/g, " ")}</span>
									<span className="ml-1 text-xs text-muted">({e.severity})</span>
									<p className="text-muted">{e.note}</p>
								</li>
							))}
						</ul>
					</Card>
				) : null}

				{/* Market read + verification */}
				<Card title="Market read & verification">
					{ai.market_read ? (
						<p className="mb-2 text-sm">
							<span className={ai.market_read.agrees_with_engine ? "text-long" : "text-short"}>
								{ai.market_read.agrees_with_engine ? "✓ agrees with engine tape" : "✗ differs from engine tape"}
							</span>
							<span className="text-muted"> — {ai.market_read.note}</span>
						</p>
					) : null}
					{ai.verification ? (
						<div className="text-sm">
							<span className={`font-semibold ${ai.verification.verdict === "pass" ? "text-long" : "text-watch"}`}>
								verification: {ai.verification.verdict}
							</span>
							{ai.verification.cited ? (
								<span className="ml-2 text-xs text-muted">
									cited entry ${money(ai.verification.cited.entry)} · stop ${money(ai.verification.cited.stop)} · target ${money(ai.verification.cited.target)}
								</span>
							) : null}
							{ai.verification.sources_checked?.length ? (
								<ul className="mt-1 space-y-0.5">
									{ai.verification.sources_checked.map((s, i) => (
										<li key={i} className="truncate text-xs">
											<a href={s.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
												{hostOf(s.url)}
											</a>
											{s.published ? <span className="text-muted"> · {s.published}</span> : null}
										</li>
									))}
								</ul>
							) : null}
						</div>
					) : null}
				</Card>
			</div>

			{/* Provenance / disclaimer */}
			<p className="mt-3 text-xs text-muted">
				{ai.provenance?.model ? `${ai.provenance.model} · ` : ""}
				{ai.provenance?.generated_at ? `${new Date(ai.provenance.generated_at).toLocaleString()} · ` : ""}
				{ai.provenance?.disclaimer ?? "Educational analysis, not financial advice."}
			</p>
		</Section>
	);
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function Section({ children }: { children: React.ReactNode }) {
	return <div className="mt-4 rounded-2xl border border-border bg-surface p-4">{children}</div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-border p-3">
			<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
			{children}
		</div>
	);
}
