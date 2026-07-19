"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AiReport, AiSymbol, DiffSymbol, JourneyNode, Report, ReportDiff, ReportIndex, Timeframe } from "@/lib/report-types";
import { time } from "@/lib/format";
import { PriceChart, type PriceLine } from "./PriceChart";
import { IndicatorPanels } from "./IndicatorPanels";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import {
	ConditionsChecklist,
	ConfirmationCard,
	ConfluencePanel,
	DecisionCard,
	MarketContextCard,
	QualityCard,
	SetupCard,
	StructureCard,
	SymbolHero,
} from "./DecisionCards";
import { AnalysisTabs } from "./AnalysisTabs";
import { AiPanel } from "./AiPanel";
import { SymbolHistoryStrip } from "./SymbolHistoryStrip";
import { ValidationCard } from "./ValidationCard";

const INTRADAY: Record<string, boolean> = { "1Hour": true, "1Day": false, "1Week": false };

export function SymbolDetailClient({
	scheduleId,
	symbol,
	index,
	initialReport,
	initialAi,
	initialDiff,
	journey = [],
}: {
	scheduleId: string;
	symbol: string;
	index: ReportIndex;
	initialReport: Report;
	initialAi?: AiSymbol;
	/** This symbol's slice of the initially-shown run's diff (P9-05 "vs previous run"). */
	initialDiff?: ReportDiff | null;
	/** This symbol's verdict path across all runs (P9-05). */
	journey?: JourneyNode[];
}) {
	const [report, setReport] = useState(initialReport);
	const [version, setVersion] = useState("latest");
	const [aiSym, setAiSym] = useState<AiSymbol | undefined>(initialAi);
	const [diff, setDiff] = useState<ReportDiff | null>(initialDiff ?? null);
	// Default to the persona's entry timeframe (1Day for swing), NOT timeframes[0] (1Hour). Switchable.
	const defaultTf =
		initialReport.schedule?.timeframe ??
		initialReport.decisions?.[symbol]?.timeframe ??
		initialReport.timeframes?.[0] ??
		"1Day";
	const [tf, setTf] = useState<Timeframe>(defaultTf);
	const [loading, setLoading] = useState(false);

	// Open on the SAME run the dashboard was showing: it passes the selected run as `?v=<version>`.
	// Read it from the URL on mount (rather than useSearchParams, which would force a Suspense boundary
	// on these statically-rendered pages). The run-switch effect below then loads that version.
	useEffect(() => {
		const v = new URLSearchParams(window.location.search).get("v");
		if (v && index.versions.some((x) => x.version === v)) setVersion(v);
	}, [index]);

	// Run-switching: fetch the chosen version as a static asset (DEVPLAN §3, mirrors the dashboard).
	useEffect(() => {
		let cancelled = false;
		if (version === "latest") {
			setReport(initialReport);
			setAiSym(initialAi);
			setDiff(initialDiff ?? null);
			return;
		}
		setLoading(true);
		// Fetch the chosen run's report, its AI sibling, and its diff sibling as static assets. All three
		// are optional siblings — absent runs simply clear the corresponding panel.
		Promise.all([
			fetch(`/reports/${scheduleId}/${version}.json`).then((r) => r.json() as Promise<Report>),
			fetch(`/reports/${scheduleId}/${version}.ai.json`)
				.then((r) => (r.ok ? (r.json() as Promise<AiReport>) : null))
				.catch(() => null),
			fetch(`/reports/${scheduleId}/${version}.diff.json`)
				.then((r) => (r.ok ? (r.json() as Promise<ReportDiff>) : null))
				.catch(() => null),
		])
			.then(([rep, ai, df]) => {
				if (cancelled) return;
				setReport(rep);
				setAiSym(ai?.symbols?.[symbol]);
				setDiff(df);
			})
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
	}, [version, scheduleId, initialReport, initialAi, initialDiff, symbol]);

	const diffSym: DiffSymbol | undefined = diff?.symbols?.[symbol];

	const decision = report.decisions?.[symbol];
	// P10-05 — the durable backtest evidence lives on the candidate; attach it next to the live decision.
	const validation = report.candidates?.find((c) => c.symbol === symbol)?.validation;
	const bars = report.charts?.[symbol]?.[tf] ?? [];
	const intraday = INTRADAY[tf] ?? false;
	const timeframes = report.timeframes ?? Object.keys(report.charts?.[symbol] ?? {});

	// Plan + HTF levels → chart price lines. Read straight from the report; nothing computed here.
	const lines = useMemo<PriceLine[]>(() => {
		if (!decision) return [];
		const out: PriceLine[] = [];
		const plan = decision.decision.entry_plan?.entry_now;
		const setup = decision.best.setup;
		const entry = plan?.price ?? setup?.entry;
		const stop = plan?.stop ?? setup?.stop;
		const target = plan?.target ?? setup?.target;
		if (entry != null) out.push({ price: entry, color: "var(--brand)", title: "Entry" });
		if (stop != null) out.push({ price: stop, color: "var(--short)", title: "Stop", dashed: true });
		if (target != null) out.push({ price: target, color: "var(--long)", title: "Target", dashed: true });
		// Staged (breakout/pullback) entry: trigger line + zone bounds.
		const pull = decision.decision.entry_plan?.entry_pullback;
		if (pull?.trigger != null) out.push({ price: pull.trigger, color: "var(--watch)", title: "Trigger", dashed: true });
		if (pull?.zone) {
			out.push({ price: pull.zone.low, color: "var(--watch)", title: "Zone", dashed: true });
			out.push({ price: pull.zone.high, color: "var(--watch)", title: "Zone", dashed: true });
		}
		const htf = decision.structure?.htf;
		(htf?.support_levels ?? []).forEach((p) => out.push({ price: p, color: "var(--long)", title: "S", dashed: true }));
		(htf?.resistance_levels ?? []).forEach((p) => out.push({ price: p, color: "var(--short)", title: "R", dashed: true }));
		return out;
	}, [decision]);

	if (!decision) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<Link href={`/app/${scheduleId}`} className="text-sm text-brand">← Back to dashboard</Link>
				<p className="mt-4 text-muted">No decision detail for {symbol} in this run.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<Link href={`/app/${scheduleId}`} className="text-sm text-brand">← Dashboard</Link>
				<div className="flex items-center gap-2">
					<label className="text-sm text-muted">Run</label>
					<select
						value={version}
						onChange={(e) => setVersion(e.target.value)}
						className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
					>
						{index.versions.map((v, i) => (
							<option key={v.version} value={i === 0 ? "latest" : v.version}>
								{i === 0 ? "Latest · " : ""}{time(v.generated_at)}
							</option>
						))}
					</select>
				</div>
			</div>

			<SymbolHero d={decision} />

			<div className="mt-4">
				<SymbolHistoryStrip
					symbol={symbol}
					diffSym={diffSym}
					prevAt={diff?.previous_generated_at}
					gapHours={diff?.gap_hours}
					journey={journey}
					currentVersion={report.report_version}
					scheduleId={scheduleId}
					loading={loading}
				/>
			</div>

			<div className="mt-4 grid gap-4 lg:grid-cols-12">
				{/* Chart column */}
				<div className="lg:col-span-8">
					<div className="rounded-2xl border border-border bg-surface p-3">
						<div className="mb-2 flex items-center gap-1">
							{timeframes.map((t) => (
								<button
									key={t}
									onClick={() => setTf(t)}
									className={`rounded-md px-3 py-1 text-sm ${t === tf ? "bg-brand text-white" : "text-muted hover:bg-surface-2"}`}
								>
									{t}
								</button>
							))}
							{loading ? <span className="ml-2 text-xs text-muted">loading…</span> : null}
							<span className="ml-auto text-xs text-muted">{bars.length} bars</span>
						</div>
						{bars.length ? (
							<ChartErrorBoundary label="Price chart">
								<PriceChart bars={bars} lines={lines} intraday={intraday} />
							</ChartErrorBoundary>
						) : (
							<p className="py-16 text-center text-sm text-muted">No chart bars for {tf}.</p>
						)}
					</div>
					{bars.length ? (
						<div className="mt-3">
							<ChartErrorBoundary label="Indicator panels">
								<IndicatorPanels bars={bars} intraday={intraday} />
							</ChartErrorBoundary>
						</div>
					) : null}
				</div>

				{/* Decision column */}
				<div className="space-y-4 lg:col-span-4">
					<DecisionCard d={decision} />
					{validation ? <ValidationCard v={validation} strategyLabel={decision.best?.label} /> : null}
					<SetupCard d={decision} />
				</div>
			</div>

			{/* AI Brain view (report's <version>.ai.json; empty state when the run has no AI extension) */}
			<AiPanel ai={aiSym} symbol={symbol} />

			{/* Analysis tabs: MTF / Price-Volume / Price-Action (report.analysis; hidden on older runs) */}
			<AnalysisTabs analysis={report.analysis?.[symbol]} />

			{/* Lower detail grid */}
			<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<ConfluencePanel d={decision} />
				<QualityCard d={decision} />
				<MarketContextCard d={decision} />
				<ConditionsChecklist d={decision} />
				<ConfirmationCard d={decision} />
				<StructureCard d={decision} />
			</div>
		</div>
	);
}
