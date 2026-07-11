import { notFound } from "next/navigation";
import { getWatchlist, getWatchlistReport, listWatchlists } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { PersonaTabs } from "@/components/PersonaTabs";
import { MarketOverview } from "@/components/MarketOverview";
import { AiMarketSection } from "@/components/AiMarketSection";

export async function generateStaticParams() {
	const params: { watchlistId: string; persona: string }[] = [];
	for (const w of listWatchlists()) {
		for (const persona of w.personas) params.push({ watchlistId: w.slug, persona });
	}
	return params;
}
export const dynamicParams = false;

export default async function WatchlistMarketPage({
	params,
}: {
	params: Promise<{ watchlistId: string; persona: string }>;
}) {
	const { watchlistId, persona } = await params;
	const w = getWatchlist(watchlistId);
	try {
		const { report, ai } = await getWatchlistReport(watchlistId, "latest", persona);
		return (
			<>
				<TopNav active="market" watchlistId={watchlistId} persona={persona} subtitle={`${persona} · market`} />
				{w ? <PersonaTabs watchlistId={watchlistId} personas={w.personas} active={persona} view="market" /> : null}
				<MarketOverview
					market={report.market}
					persona={report.persona}
					timeframe={report.schedule?.timeframe ?? report.timeframes?.[0] ?? "1Day"}
					generatedAt={report.generated_at}
				/>
				{ai?.market_overview ? (
					<div className="mx-auto max-w-6xl px-4 pb-6">
						<AiMarketSection market={ai.market_overview} model={ai.model} />
					</div>
				) : null}
			</>
		);
	} catch {
		notFound();
	}
}
