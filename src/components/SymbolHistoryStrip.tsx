"use client";

import Link from "next/link";
import type { DiffSymbol, JourneyNode } from "@/lib/report-types";
import { time } from "@/lib/format";

/**
 * P9-05: the symbol page's "vs previous run" strip + verdict journey. Reads the engine's per-symbol
 * diff slice and the reconstructed verdict path — it renders, never re-derives (CLAUDE.md §1-2).
 */

const VERDICT_TONE: Record<string, string> = {
	take: "bg-long/20 text-long border-long/40",
	take_small: "bg-long/10 text-long border-long/30",
	arm: "bg-brand/15 text-brand border-brand/40",
	watch: "bg-watch/15 text-watch border-watch/40",
	avoid: "bg-short/10 text-short border-short/30",
};
const label = (v?: string | null) => (v ? v.replace(/_/g, " ").toUpperCase() : "—");
const tone = (v?: string | null) => VERDICT_TONE[v ?? ""] ?? "bg-surface-2 text-muted border-border";

/** "31 → 54" with directional color. */
function Delta({ from, to, dp = 0, suffix = "" }: { from?: number | null; to?: number | null; dp?: number; suffix?: string }) {
	const up = from != null && to != null && to > from;
	const dn = from != null && to != null && to < from;
	const f = (n?: number | null) => (n == null ? "—" : n.toFixed(dp));
	return (
		<span className="mono">
			<span className="text-muted">{f(from)}</span>
			<span className="mx-0.5">→</span>
			<span className={up ? "text-long" : dn ? "text-short" : "text-foreground"}>{f(to)}{suffix}</span>
		</span>
	);
}

function VerdictPill({ v }: { v?: string | null }) {
	return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${tone(v)}`}>{label(v)}</span>;
}

/** The compact delta strip for THIS run vs the previous one. */
function VsPreviousRun({
	d,
	prevAt,
	gapHours,
}: {
	d?: DiffSymbol;
	prevAt?: string | null;
	gapHours?: number | null;
}) {
	// No diff at all (first-ever run, or diff not yet computed) → nothing to compare.
	if (!d) {
		return (
			<div className="text-xs text-muted">
				No previous run to compare — this is the first time this symbol appears in the history.
			</div>
		);
	}

	const gap = gapHours && gapHours >= 24 ? <span className="ml-1 rounded-full border border-watch/40 px-1.5 text-[10px] text-watch">⚠ {Math.round(gapHours)}h gap</span> : null;
	const since = prevAt ? <span className="text-muted">since {time(prevAt)}</span> : null;

	if (d.status === "new") {
		return (
			<div className="flex flex-wrap items-center gap-2 text-xs">
				<span className="rounded-full bg-brand/15 px-2 py-0.5 font-medium text-brand">🆕 New this run</span>
				{d.reason ? <span className="text-muted">{d.reason.replace(/_/g, " ")}</span> : null}
				{d.snapshot?.verdict ? <VerdictPill v={d.snapshot.verdict} /> : null}
				{gap}
			</div>
		);
	}
	if (d.status === "dropped") {
		return (
			<div className="flex flex-wrap items-center gap-2 text-xs">
				<span className="rounded-full bg-short/15 px-2 py-0.5 font-medium text-short">❌ Dropped this run</span>
				{d.reason ? <span className="text-muted">{d.reason.replace(/_/g, " ")}</span> : null}
				{d.last?.verdict ? <span className="text-muted">was <VerdictPill v={d.last.verdict} /></span> : null}
				{gap}
			</div>
		);
	}

	// changed / unchanged
	const bits: React.ReactNode[] = [];
	if (d.verdict?.from != null || d.verdict?.to != null) {
		const t = d.verdict.transition;
		bits.push(
			<span key="v" className="flex items-center gap-1">
				<VerdictPill v={d.verdict.from} /><span className="text-muted">→</span><VerdictPill v={d.verdict.to} />
				{t === "promotion" ? <span className="text-long">⬆</span> : t === "demotion" ? <span className="text-short">⬇</span> : null}
			</span>,
		);
	}
	if (d.conviction?.to != null) bits.push(<span key="c" className="text-muted">conv <Delta from={d.conviction.from} to={d.conviction.to} /></span>);
	if (d.confirmation?.score?.to != null) bits.push(<span key="cf" className="text-muted">confirm <Delta from={d.confirmation.score.from} to={d.confirmation.score.to} suffix="%" /></span>);
	if (d.confirmation?.resolved?.length) bits.push(<span key="rs" className="text-long">✅ {d.confirmation.resolved.join(", ")}</span>);
	if (d.quality?.trap_risk?.to != null && (d.quality.trap_risk.delta ?? 0) !== 0) bits.push(<span key="tr" className="text-short">trap <Delta from={d.quality.trap_risk.from} to={d.quality.trap_risk.to} /></span>);
	if (d.plan?.rr?.to != null) bits.push(<span key="rr" className="text-muted">R:R <Delta from={d.plan.rr.from} to={d.plan.rr.to} dp={2} /></span>);
	if (d.plan?.moved) bits.push(<span key="pm" className="text-watch">🔧 plan moved</span>);
	if (d.derived?.trigger_crossed) bits.push(<span key="tc" className="text-long">⚡ trigger crossed</span>);
	if (d.thesis_expired?.to) bits.push(<span key="te" className="text-short">thesis expired</span>);
	if (d.flags_added?.length) bits.push(<span key="fa" className="text-short">+{d.flags_added.join(", ")}</span>);

	if (bits.length === 0) {
		return (
			<div className="flex flex-wrap items-center gap-2 text-xs">
				<span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">No material change {since}</span>
				{gap}
			</div>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
			{bits}
			{since}
			{gap}
		</div>
	);
}

/** Horizontal verdict path across runs. Each node deep-links, pinned to that run. */
function VerdictJourney({
	journey,
	currentVersion,
	hrefFor,
}: {
	journey: JourneyNode[];
	currentVersion?: string;
	hrefFor: (version: string) => string;
}) {
	if (journey.length < 2) return null;
	// newest-first, cap the tail so the strip stays compact
	const nodes = [...journey].reverse().slice(0, 14).reverse();
	return (
		<div className="mt-3 border-t border-border pt-3">
			<div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Verdict journey</div>
			<div className="flex flex-wrap items-center gap-1">
				{nodes.map((n, i) => (
					<span key={n.version} className="flex items-center gap-1">
						{i > 0 ? <span className="text-muted">›</span> : null}
						<Link
							href={hrefFor(n.version)}
							title={`${time(n.generated_at)}${n.conviction != null ? ` · conv ${n.conviction}` : ""}${n.event === "new" ? " · new" : n.event === "dropped" ? " · dropped" : ""}`}
							className={`flex flex-col items-center rounded px-1 py-0.5 hover:bg-surface-2 ${n.version === currentVersion ? "ring-1 ring-brand" : ""}`}
						>
							{n.event === "dropped"
								? <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted line-through">gone</span>
								: <VerdictPill v={n.verdict} />}
							<span className={`mt-0.5 text-[9px] leading-none ${n.changed ? "text-foreground" : "text-muted/60"}`}>{time(n.generated_at).replace(/,.*/, "")}</span>
						</Link>
					</span>
				))}
			</div>
		</div>
	);
}

export function SymbolHistoryStrip({
	symbol,
	diffSym,
	prevAt,
	gapHours,
	journey,
	currentVersion,
	scheduleId,
	loading,
}: {
	symbol: string;
	diffSym?: DiffSymbol;
	prevAt?: string | null;
	gapHours?: number | null;
	journey: JourneyNode[];
	currentVersion?: string;
	scheduleId: string;
	loading?: boolean;
}) {
	// Nothing to show if there's no diff and no multi-run journey.
	if (!diffSym && journey.length < 2) return null;
	const hrefFor = (version: string) => `/app/${scheduleId}/${symbol}?v=${version}`;
	return (
		<div className={`rounded-xl border border-border bg-surface px-4 py-3 ${loading ? "opacity-60" : ""}`}>
			<div className="mb-2 flex items-center gap-2">
				<span className="text-sm font-medium">vs previous run</span>
				{loading ? <span className="text-xs text-muted">loading…</span> : null}
			</div>
			<VsPreviousRun d={diffSym} prevAt={prevAt} gapHours={gapHours} />
			<VerdictJourney journey={journey} currentVersion={currentVersion} hrefFor={hrefFor} />
		</div>
	);
}
