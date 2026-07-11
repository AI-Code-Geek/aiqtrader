"use client";

/**
 * Market page shell with a run selector. Mirrors the symbol-detail run-switcher: on selecting an
 * archived run it fetches that run's `<version>.json` (market/breadth) and `<version>.ai.json` (AI
 * market read) as static assets, then re-renders. Render-only — no computation (root CLAUDE.md #2).
 */
import { useEffect, useState } from "react";
import type { AiReport, Report, ReportIndex } from "@/lib/report-types";
import { time } from "@/lib/format";
import { MarketOverview } from "./MarketOverview";
import { AiMarketSection } from "./AiMarketSection";

export function MarketClient({
	scheduleId,
	index,
	initialReport,
	initialAi,
}: {
	scheduleId: string;
	index: ReportIndex;
	initialReport: Report;
	initialAi: AiReport | null;
}) {
	const [version, setVersion] = useState("latest");
	const [report, setReport] = useState(initialReport);
	const [ai, setAi] = useState<AiReport | null>(initialAi);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		if (version === "latest") {
			setReport(initialReport);
			setAi(initialAi);
			return;
		}
		setLoading(true);
		Promise.all([
			fetch(`/reports/${scheduleId}/${version}.json`).then((r) => r.json() as Promise<Report>),
			fetch(`/reports/${scheduleId}/${version}.ai.json`)
				.then((r) => (r.ok ? (r.json() as Promise<AiReport>) : null))
				.catch(() => null),
		])
			.then(([rep, aiRep]) => {
				if (cancelled) return;
				setReport(rep);
				setAi(aiRep);
			})
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
	}, [version, scheduleId, initialReport, initialAi]);

	return (
		<div>
			<div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 pt-4">
				<label className="text-sm text-muted">Run</label>
				<select
					value={version}
					onChange={(e) => setVersion(e.target.value)}
					className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
				>
					{index.versions.map((v, i) => (
						<option key={v.version} value={i === 0 ? "latest" : v.version}>
							{i === 0 ? "Latest · " : ""}
							{time(v.generated_at)}
						</option>
					))}
				</select>
				{loading ? <span className="text-xs text-muted">loading…</span> : null}
			</div>

			<MarketOverview
				market={report.market}
				persona={report.persona}
				timeframe={report.schedule?.timeframe ?? report.timeframes?.[0] ?? "1Day"}
				generatedAt={report.generated_at}
			/>

			<div className="mx-auto max-w-6xl px-4 pb-6">
				{ai?.market_overview ? (
					<AiMarketSection market={ai.market_overview} model={ai.model} />
				) : (
					<div className="rounded-2xl border border-border bg-surface p-4">
						<div className="mb-1 flex items-center gap-2">
							<span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand">
								AI Brain
							</span>
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Market read</h3>
						</div>
						<p className="text-sm text-muted">No AI analysis for this run — pick a run that has an AI extension.</p>
					</div>
				)}
			</div>
		</div>
	);
}
