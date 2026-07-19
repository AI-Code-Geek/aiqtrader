"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportDiff, DiffSymbol, ReportOutcome, OutcomeSymbol } from "@/lib/report-types";
import { time } from "@/lib/format";
import { loadSeen, mergeSeen, persistSeen, type SeenMap } from "@/lib/notifications";
import { mergeSince, type MergedSince } from "@/lib/history-merge";

const KIND_ICON: Record<string, string> = {
	new_take: "🎯", lost_take: "📉", promotion: "⬆️", demotion: "⬇️",
	trigger_crossed: "⚡", risk: "⚠️", confirmation: "✅", new: "🆕", dropped: "❌",
	plan: "🔧", drift: "·", market: "🌐", changed: "·",
};

/** A tiny "A → B" cell for a numeric/categorical change. */
function Chg({ from, to, suffix = "" }: { from?: unknown; to?: unknown; suffix?: string }) {
	return (
		<span className="mono text-xs">
			<span className="text-muted">{String(from ?? "—")}</span>
			<span className="mx-1">→</span>
			<span className="text-foreground">{String(to ?? "—")}{suffix}</span>
		</span>
	);
}

/** How ONE call resolved — a compact chip appended to a symbol row when the run's card knows its fate. */
const OUTCOME_CHIP: Record<string, { icon: string; tone: string; label: string }> = {
	target:   { icon: "🎯", tone: "text-long",  label: "target" },
	stop:     { icon: "🛑", tone: "text-short", label: "stop" },
	time_exit:{ icon: "⏱", tone: "text-muted", label: "timed out" },
	open:     { icon: "•",  tone: "text-muted", label: "open" },
	no_fill:  { icon: "∅",  tone: "text-muted", label: "no fill" },
};

function OutcomeChip({ oc }: { oc: OutcomeSymbol }) {
	const meta = OUTCOME_CHIP[oc.outcome ?? "open"];
	if (!meta) return null;
	const r = oc.outcome === "open" ? oc.r_unrealized : oc.r_realized;
	return (
		<span className={`text-xs ${meta.tone}`}>
			{meta.icon} {meta.label}
			{oc.milestone ? <span className="text-muted"> ({oc.milestone.toUpperCase()})</span> : null}
			{r != null ? <span className="mono"> {r > 0 ? "+" : ""}{r}R{oc.outcome === "open" ? " so far" : ""}</span> : null}
		</span>
	);
}

/** The run's "report card" — how its actionable calls resolved against the latest bars (P11-05). */
function OutcomeStrip({ o }: { o: ReportOutcome }) {
	const s = o.scoreboard;
	if (!o.matured) {
		return (
			<div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted">
				<span>📊 report card</span>
				<span>outcomes pending — {s.open} setup{s.open === 1 ? "" : "s"} still open</span>
			</div>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-xs">
			<span className="font-semibold text-foreground">📊 report card</span>
			{s.target ? <span className="text-long">{s.target} 🎯 target</span> : null}
			{s.stop ? <span className="text-short">{s.stop} 🛑 stop</span> : null}
			{s.time_exit ? <span className="text-muted">{s.time_exit} ⏱ timed out</span> : null}
			{s.open ? <span className="text-muted">{s.open} open</span> : null}
			{s.hit_rate != null ? <span className="font-medium">{Math.round(s.hit_rate * 100)}% hit</span> : null}
			{s.expectancy_r != null ? (
				<span className={s.expectancy_r >= 0 ? "text-long" : "text-short"}>
					{s.expectancy_r >= 0 ? "+" : ""}{s.expectancy_r}R avg
				</span>
			) : null}
			{s.total_r ? (
				<span className={`mono ${s.total_r >= 0 ? "text-long" : "text-short"}`}>{s.total_r >= 0 ? "+" : ""}{s.total_r}R</span>
			) : null}
			{o.resolved_through ? <span className="ml-auto text-muted">as of {o.resolved_through.slice(0, 10)}</span> : null}
		</div>
	);
}

function SymbolRow({ sym, d, href, oc }: { sym: string; d: DiffSymbol; href: string; oc?: OutcomeSymbol }) {
	const verdict = d.verdict;
	const tone =
		verdict?.transition === "promotion" ? "text-long"
		: verdict?.transition === "demotion" ? "text-short"
		: d.status === "new" ? "text-brand"
		: d.status === "dropped" ? "text-short" : "text-muted";
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-1.5 text-sm last:border-0">
			<Link href={href} className={`font-semibold ${tone} min-w-[3.5rem]`}>{sym}</Link>
			{d.status === "new" && <span className="text-xs text-muted">new · {d.reason?.replace(/_/g, " ")} · {d.snapshot?.verdict}</span>}
			{d.status === "dropped" && <span className="text-xs text-short">dropped · {d.reason?.replace(/_/g, " ")}</span>}
			{verdict && <span className="text-xs">verdict <Chg from={verdict.from?.toString().toUpperCase()} to={verdict.to?.toString().toUpperCase()} /></span>}
			{d.confirmation?.score && <span className="text-xs text-muted">conf <Chg from={d.confirmation.score.from} to={d.confirmation.score.to} /></span>}
			{d.confirmation?.resolved?.length ? <span className="text-xs text-long">✅ {d.confirmation.resolved[0]}</span> : null}
			{d.conviction && <span className="text-xs text-muted">conv <Chg from={d.conviction.from} to={d.conviction.to} /></span>}
			{d.plan?.rr && <span className="text-xs text-muted">R:R <Chg from={d.plan.rr.from} to={d.plan.rr.to} /></span>}
			{d.quality?.trap_risk && (d.quality.trap_risk.delta ?? 0) > 0 ? <span className="text-xs text-short">trap <Chg from={d.quality.trap_risk.from} to={d.quality.trap_risk.to} /></span> : null}
			{d.derived?.trigger_crossed && <span className="text-xs text-long">⚡ trigger crossed</span>}
			{d.thesis_expired && <span className="text-xs text-short">thesis expired</span>}
			{oc ? <span className="ml-auto"><OutcomeChip oc={oc} /></span> : null}
		</div>
	);
}

/**
 * P9-08 · "Since you last looked" — the merged net view over every run published since this account
 * last acknowledged this watchlist. Renders `mergeSince()` (viewer-side composition of the engine's
 * per-run diffs); "Mark as read" advances the boundary so the next new run is what stands out.
 */
function SinceBanner({ merged, onMarkRead }: { merged: MergedSince; onMarkRead: () => void }) {
	const [open, setOpen] = useState(false);
	const m = merged;
	return (
		<div className="rounded-xl border border-brand/40 bg-brand/5 px-4 py-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-sm font-semibold text-brand">Since you last looked</span>
				<span className="text-xs text-muted">
					{m.runs} run{m.runs > 1 ? "s" : ""} · {time(m.fromAt)} → {time(m.toAt)}
				</span>
				<button onClick={onMarkRead} className="ml-auto rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface-2">
					Mark as read
				</button>
			</div>

			{!m.material ? (
				<p className="mt-1 text-sm text-muted">No material change across those runs — you&rsquo;re effectively up to date.</p>
			) : (
				<>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						{m.newTakes.length ? <span className="rounded-full bg-long/15 px-2 py-0.5 text-xs text-long">+{m.newTakes.length} TAKE</span> : null}
						{m.lostTakes.length ? <span className="rounded-full bg-short/15 px-2 py-0.5 text-xs text-short">−{m.lostTakes.length} TAKE</span> : null}
						{m.promotions.length ? <span className="text-xs text-long">↑{m.promotions.length}</span> : null}
						{m.demotions.length ? <span className="text-xs text-short">↓{m.demotions.length}</span> : null}
						{m.newSymbols.length ? <span className="text-xs text-brand">+{m.newSymbols.length} new</span> : null}
						{m.droppedSymbols.length ? <span className="text-xs text-muted">−{m.droppedSymbols.length} dropped</span> : null}
					</div>
					<ul className="mt-2 space-y-0.5">
						{m.highlights.slice(0, open ? 15 : 4).map((h, i) => (
							<li key={i} className="text-sm">
								<span className="mr-1">{KIND_ICON[h.kind] ?? "·"}</span>{h.text}
							</li>
						))}
					</ul>
					{m.highlights.length > 4 ? (
						<button onClick={() => setOpen((o) => !o)} className="mt-1 text-xs text-brand">
							{open ? "show less" : `show all ${m.highlights.length}`}
						</button>
					) : null}
					<p className="mt-1.5 text-[11px] text-muted">Net change per symbol across the window — intermediate wiggles are collapsed.</p>
				</>
			)}
		</div>
	);
}

function RunCard({ d, hrefFor, unseen, outcome }: { d: ReportDiff; hrefFor: (sym: string, version: string) => string; unseen?: boolean; outcome?: ReportOutcome | null }) {
	const [open, setOpen] = useState(false);
	const s = d.summary;
	const gap = d.gap_hours ?? 0;
	const bigGap = gap >= 24;

	// per-symbol resolution for the expanded rows (P11-05): symbol → how its call turned out
	const ocBySym = useMemo(() => {
		const m: Record<string, OutcomeSymbol> = {};
		for (const row of outcome?.symbols ?? []) m[row.symbol] = row;
		return m;
	}, [outcome]);

	// symbols worth showing when expanded: everything except "unchanged", most-important first
	const rows = useMemo(() => {
		const order = (x: DiffSymbol) =>
			x.status === "new" && x.verdict?.to ? 3
			: x.verdict?.transition === "promotion" ? 0
			: x.verdict?.transition === "demotion" ? 1
			: x.status === "dropped" ? 4 : x.status === "new" ? 3 : 2;
		return Object.entries(d.symbols)
			.filter(([, v]) => v.status !== "unchanged")
			.sort((a, b) => order(a[1]) - order(b[1]));
	}, [d.symbols]);

	return (
		<div className={`rounded-xl border bg-surface ${unseen ? "border-brand/50 ring-1 ring-brand/20" : s.material ? "border-border" : "border-border/50"}`}>
			<button
				onClick={() => s.material && setOpen((o) => !o)}
				className={`flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left ${s.material ? "" : "opacity-60"}`}
			>
				<span className={`text-lg leading-none ${s.material ? "text-brand" : "text-muted"}`}>{s.material ? "●" : "○"}</span>
				<span className="font-medium">{time(d.generated_at)}</span>
				{unseen ? <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">new</span> : null}

				{d.baseline ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">first run</span> : null}
				{bigGap ? <span className="rounded-full border border-watch/40 px-2 py-0.5 text-xs text-watch">⚠ {Math.round(gap)}h gap</span> : null}
				{d.universe?.changed ? <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">watchlist edited</span> : null}

				{!s.material ? (
					<span className="text-sm text-muted">no material change</span>
				) : (
					<span className="flex flex-wrap items-center gap-1.5">
						{s.new_takes.length ? <span className="rounded-full bg-long/15 px-2 py-0.5 text-xs text-long">+{s.new_takes.length} TAKE</span> : null}
						{s.lost_takes.length ? <span className="rounded-full bg-short/15 px-2 py-0.5 text-xs text-short">−{s.lost_takes.length} TAKE</span> : null}
						{s.promotions ? <span className="text-xs text-long">↑{s.promotions}</span> : null}
						{s.demotions ? <span className="text-xs text-short">↓{s.demotions}</span> : null}
						{s.new ? <span className="text-xs text-brand">+{s.new} new</span> : null}
						{s.dropped ? <span className="text-xs text-muted">−{s.dropped} dropped</span> : null}
					</span>
				)}
				{s.material ? <span className="ml-auto text-xs text-muted">{open ? "▲" : "▼"}</span> : null}
			</button>

			{s.material ? (
				<div className="px-4 pb-2">
					{/* top highlights — the trader's log */}
					<ul className="mb-2 space-y-0.5">
						{d.highlights.slice(0, open ? 15 : 3).map((h, i) => (
							<li key={i} className="text-sm">
								<span className="mr-1">{KIND_ICON[h.kind] ?? "·"}</span>{h.text}
							</li>
						))}
					</ul>
					{open ? (
						<div className="mt-2 border-t border-border pt-2">
							{rows.map(([sym, v]) => (
								<SymbolRow key={sym} sym={sym} d={v} href={hrefFor(sym, d.report_version)} oc={ocBySym[sym]} />
							))}
						</div>
					) : null}
				</div>
			) : null}
			{/* P11-05 - the run's report card: how its calls resolved */}
			{outcome ? <OutcomeStrip o={outcome} /> : null}
		</div>
	);
}

export function HistoryClient({
	watchlistName,
	persona,
	scheduleId,
	slug,
	diffs,
	outcomes,
}: {
	watchlistName: string;
	persona: string;
	scheduleId: string;
	/** The watchlist slug — the key into `user.seenReports`, shared with the notification bell (P9-08). */
	slug: string;
	diffs: ReportDiff[];
	/** P11-05 — per-run report card, keyed by report_version (how that run's calls resolved). */
	outcomes: Record<string, ReportOutcome>;
}) {
	const hrefFor = (sym: string, version: string) => `/app/${scheduleId}/${sym}?v=${version}`;
	const materialCount = diffs.filter((d) => d.summary.material).length;
	const latestAt = diffs[0]?.generated_at ?? null; // diffs are newest-first

	// P9-08: the "since you last looked" boundary — the run this account last acknowledged for this
	// watchlist. `null` while loading. A first-ever visit (no boundary) seeds to `latest` so we show a
	// baseline, never "everything since forever".
	const [since, setSince] = useState<string | null>(null);
	const seenRef = useRef<SeenMap>({});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { seen, isNew } = await loadSeen();
			if (cancelled) return;
			seenRef.current = seen;
			const boundary = seen[slug];
			if (isNew || !boundary) {
				// No prior acknowledgement for this watchlist → treat this visit as the baseline.
				setSince(latestAt);
				if (latestAt) {
					const next = mergeSeen(seen, { [slug]: latestAt });
					seenRef.current = next;
					void persistSeen(next); // best-effort; no-ops / 401s harmlessly when signed out
				}
			} else {
				setSince(boundary);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [slug, latestAt]);

	const merged = useMemo(() => mergeSince(diffs, since), [diffs, since]);

	const markRead = () => {
		if (!latestAt) return;
		const next = mergeSeen(seenRef.current, { [slug]: latestAt });
		seenRef.current = next;
		setSince(latestAt); // collapses the banner + clears the "new" row markers
		void persistSeen(next);
	};

	return (
		<div className="mx-auto max-w-4xl px-4 py-6">
			<h1 className="text-xl font-semibold">History — {watchlistName}</h1>
			<p className="mb-4 text-sm capitalize text-muted">
				{persona} · {diffs.length} runs · {materialCount} with changes · newest first
			</p>
			{diffs.length === 0 ? (
				<p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
					No history yet — diffs appear once at least two runs exist.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{merged ? <SinceBanner merged={merged} onMarkRead={markRead} /> : null}
					{diffs.map((d) => (
						<RunCard
							key={d.report_version}
							d={d}
							hrefFor={hrefFor}
							unseen={since != null && d.generated_at > since}
							outcome={outcomes[d.report_version]}
						/>
					))}
				</div>
			)}
		</div>
	);
}
