import { notFound } from "next/navigation";
import { getWatchlist, getWatchlistReport } from "@/lib/reports-source";
import { TopNav } from "./TopNav";
import { PersonaTabs } from "./PersonaTabs";
import { DashboardClient } from "./DashboardClient";

/**
 * Shared server render for a watchlist's persona dashboard. Used by both the default
 * `/app/w/[watchlistId]` route (default persona) and the explicit `/app/w/[watchlistId]/[persona]`.
 */
export async function WatchlistDashboard({
	watchlistId,
	persona,
}: {
	watchlistId: string;
	persona?: string;
}) {
	const w = getWatchlist(watchlistId);
	if (!w) notFound();
	const active = persona ?? w.latest?.persona ?? w.personas[0];
	if (!active) notFound();
	try {
		const { scheduleId, report, index } = await getWatchlistReport(watchlistId, "latest", active);
		return (
			<>
				<TopNav
					active="dashboard"
					watchlistId={watchlistId}
					persona={active}
					subtitle={`${report.universe.name} · ${active}`}
				/>
				<PersonaTabs watchlistId={watchlistId} personas={w.personas} active={active} />
				<DashboardClient scheduleId={scheduleId} index={index} initialReport={report} />
			</>
		);
	} catch {
		notFound();
	}
}
