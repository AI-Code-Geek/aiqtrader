import { notFound } from "next/navigation";
import { getWatchlist, getWatchlistDiffs, getWatchlistOutcomes, listWatchlists } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { PersonaTabs } from "@/components/PersonaTabs";
import { HistoryClient } from "@/components/HistoryClient";

// One History page per (watchlist × persona) — the run-to-run diff timeline (Phase 9).
export async function generateStaticParams() {
	const params: { watchlistId: string; persona: string }[] = [];
	for (const w of listWatchlists()) {
		for (const persona of w.personas) params.push({ watchlistId: w.slug, persona });
	}
	return params;
}
export const dynamicParams = false;

export default async function HistoryPage({
	params,
}: {
	params: Promise<{ watchlistId: string; persona: string }>;
}) {
	const { watchlistId, persona } = await params;
	const w = getWatchlist(watchlistId);
	if (!w) notFound();
	const [{ scheduleId, diffs }, outcomes] = await Promise.all([
		getWatchlistDiffs(watchlistId, persona),
		getWatchlistOutcomes(watchlistId, persona),
	]);
	return (
		<>
			<TopNav active="history" watchlistId={watchlistId} persona={persona} subtitle={`${persona} · history`} />
			<PersonaTabs watchlistId={watchlistId} personas={w.personas} active={persona} view="history" />
			<HistoryClient watchlistName={w.name} persona={persona} scheduleId={scheduleId} slug={watchlistId} diffs={diffs} outcomes={outcomes} />
		</>
	);
}
