import { listWatchlists } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { WatchlistBrowser } from "@/components/WatchlistBrowser";

/** /app -> the watchlists index. Pick a persona, then a watchlist; the scheduler is just provenance. */
export default async function AppIndex() {
	const watchlists = listWatchlists();
	const available = Array.from(new Set(watchlists.flatMap((w) => w.personas)));
	return (
		<>
			<TopNav active="dashboard" />
			{watchlists.length === 0 ? (
				<p className="p-8 text-muted">No watchlists found in data/reports.</p>
			) : (
				<WatchlistBrowser watchlists={watchlists} available={available} />
			)}
		</>
	);
}
