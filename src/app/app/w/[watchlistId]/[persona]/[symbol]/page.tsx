import { notFound } from "next/navigation";
import { getReportDiff, getSymbolJourney, getWatchlistReport, listWatchlists, resolveSchedule, sliceReportForSymbol, symbolsAcrossRuns } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { SymbolDetailClient } from "@/components/SymbolDetailClient";

// Pre-render every watchlist × persona × symbol-with-a-decision-in-ANY-retained-run. Mirrors
// app/[scheduleId]/[symbol]; see reports-source.symbolsAcrossRuns for why latest.json alone is not
// enough (archived runs link to symbols the newest run dropped → 404 under dynamicParams = false).
export async function generateStaticParams() {
	const params: { watchlistId: string; persona: string; symbol: string }[] = [];
	for (const w of listWatchlists()) {
		for (const persona of w.personas) {
			const sched = resolveSchedule(w.slug, persona);
			if (!sched) continue;
			for (const symbol of await symbolsAcrossRuns(sched.id)) {
				params.push({ watchlistId: w.slug, persona, symbol });
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
		// NOT a 404 when the symbol is absent from the latest run — the page is also reachable with
		// `?v=<archived run>`, which SymbolDetailClient resolves after mount.
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
