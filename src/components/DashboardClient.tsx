"use client";

import { useEffect, useMemo, useState } from "react";
import type { Report, ReportIndex } from "@/lib/report-types";
import { time } from "@/lib/format";
import { getMyList } from "@/lib/client-user";
import { DataHealthStrip } from "./DataHealthStrip";
import { MarketTapeBanner } from "./MarketTapeBanner";
import { CandidateCard } from "./CandidateCard";
import { CandidateTable } from "./CandidateTable";

export function DashboardClient({
	scheduleId,
	index,
	initialReport,
}: {
	scheduleId: string;
	index: ReportIndex;
	initialReport: Report;
}) {
	const [report, setReport] = useState(initialReport);
	const [version, setVersion] = useState<string>("latest");
	const [mineOnly, setMineOnly] = useState(false);
	const [mine, setMine] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => setMine(getMyList()), []);

	// Run switching: fetch the selected version as a static asset (DEVPLAN §3 client island).
	useEffect(() => {
		let cancelled = false;
		if (version === "latest") {
			setReport(initialReport);
			return;
		}
		setLoading(true);
		fetch(`/reports/${scheduleId}/${version}.json`)
			.then((r) => r.json() as Promise<Report>)
			.then((data) => !cancelled && setReport(data))
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
	}, [version, scheduleId, initialReport]);

	const candidates = useMemo(() => {
		let list = [...(report.candidates ?? [])].sort((a, b) => b.rank_score - a.rank_score);
		if (mineOnly) list = list.filter((c) => mine.includes(c.symbol));
		return list;
	}, [report, mineOnly, mine]);

	return (
		<div className="mx-auto max-w-7xl px-4 py-4">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-xl font-semibold">{report.universe.name} — {report.schedule.name}</h1>
					<span className="text-sm text-muted">
						{report.universe.symbol_count} symbols · every {report.schedule.cadence.interval_minutes}m · generated {time(report.generated_at)}
					</span>
				</div>
				<div className="flex items-center gap-3">
					<label className="flex items-center gap-1 text-sm text-muted">
						<input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
						My List only
					</label>
					<label className="text-sm text-muted">Run</label>
					<select
						value={version}
						onChange={(e) => setVersion(e.target.value)}
						className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
					>
						{index.versions.map((v, i) => (
							<option key={v.version} value={i === 0 ? "latest" : v.version}>
								{i === 0 ? "Latest · " : ""}{time(v.generated_at)} ({v.candidate_count})
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="mb-3 grid gap-3 lg:grid-cols-12">
				<div className="lg:col-span-5"><DataHealthStrip health={report.data_health} /></div>
				<div className="lg:col-span-7"><MarketTapeBanner report={report} /></div>
			</div>

			<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
				Ranked candidates {loading ? "· loading…" : ""}
			</h2>
			{candidates.length === 0 ? (
				<p className="text-sm text-muted">No candidates in your list for this run.</p>
			) : (
				<>
					<div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{candidates.map((c) => (
							<CandidateCard key={c.symbol} candidate={c} report={report} scheduleId={scheduleId} version={version} />
						))}
					</div>
					<CandidateTable candidates={candidates} scheduleId={scheduleId} version={version} />
				</>
			)}
		</div>
	);
}
