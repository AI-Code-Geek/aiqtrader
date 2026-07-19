import { notFound } from "next/navigation";
import { getReportDiff, getSymbolJourney, getWatchlistReport, listWatchlists, sliceReportForSymbol } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { SymbolDetailClient } from "@/components/SymbolDetailClient";

// Pre-render every watchlist × persona × symbol-with-a-decision at build.
export async function generateStaticParams() {
	const params: { watchlistId: string; persona: string; symbol: string }[] = [];
	for (const w of listWatchlists()) {
		for (const persona of w.personas) {
			try {
				const { report } = await getWatchlistReport(w.slug, "latest", persona);
				for (const symbol of Object.keys(report.decisions ?? {})) {
					params.push({ watchlistId: w.slug, persona, symbol });
				}
			} catch {
				// skip persona streams without a readable latest run
			}
		}
	}
	return params;
}
export const dynamicParams = false;

export default async function WatchlistSymbolPage({
	params,
}: {
	params: Promise<{ watchlistId: string; persona: string; symbol: string }>;
}) {
	const { watchlistId, persona, symbol } = await params;
	try {
		const { scheduleId, report, ai, index } = await getWatchlistReport(watchlistId, "latest", persona);
		if (!report.decisions?.[symbol]) notFound();
		// P9-05: the latest run's diff (for the "vs previous run" strip) + this symbol's full verdict path.
		const [initialDiff, journey] = await Promise.all([
			getReportDiff(scheduleId, report.report_version),
			getSymbolJourney(watchlistId, symbol, persona),
		]);
		return (
			<>
				<TopNav
					active="dashboard"
					watchlistId={watchlistId}
					persona={persona}
					subtitle={`${persona} · ${symbol}`}
				/>
				<SymbolDetailClient
					scheduleId={scheduleId}
					symbol={symbol}
					index={index}
					initialReport={sliceReportForSymbol(report, symbol)}
					initialAi={ai?.symbols?.[symbol]}
					initialDiff={initialDiff}
					journey={journey}
				/>
			</>
		);
	} catch {
		notFound();
	}
}
