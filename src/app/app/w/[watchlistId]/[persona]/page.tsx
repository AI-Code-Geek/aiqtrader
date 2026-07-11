import { listWatchlists } from "@/lib/reports-source";
import { WatchlistDashboard } from "@/components/WatchlistDashboard";

// One dashboard per (watchlist × persona) — each persona is its own report stream.
export async function generateStaticParams() {
	const params: { watchlistId: string; persona: string }[] = [];
	for (const w of listWatchlists()) {
		for (const persona of w.personas) params.push({ watchlistId: w.slug, persona });
	}
	return params;
}
export const dynamicParams = false;

export default async function WatchlistPersonaPage({
	params,
}: {
	params: Promise<{ watchlistId: string; persona: string }>;
}) {
	const { watchlistId, persona } = await params;
	return <WatchlistDashboard watchlistId={watchlistId} persona={persona} />;
}
