import { listWatchlists } from "@/lib/reports-source";
import { WatchlistDashboard } from "@/components/WatchlistDashboard";

// Default watchlist view = its default persona's latest run (explicit personas live at ./[persona]).
export async function generateStaticParams() {
	return listWatchlists().map((w) => ({ watchlistId: w.slug }));
}
export const dynamicParams = false;

export default async function WatchlistPage({ params }: { params: Promise<{ watchlistId: string }> }) {
	const { watchlistId } = await params;
	return <WatchlistDashboard watchlistId={watchlistId} />;
}
