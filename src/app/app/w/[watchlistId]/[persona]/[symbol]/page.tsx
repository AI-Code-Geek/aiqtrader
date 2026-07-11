import { notFound } from "next/navigation";
import { getWatchlistReport, listWatchlists } from "@/lib/reports-source";
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
					initialReport={report}
					initialAi={ai?.symbols?.[symbol]}
				/>
			</>
		);
	} catch {
		notFound();
	}
}
