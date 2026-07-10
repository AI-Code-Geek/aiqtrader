import { listScheduleIds, getReport } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { MyListClient, type UniverseSymbol } from "@/components/MyListClient";
import type { Verdict } from "@/lib/report-types";

// Universe comes from the default schedule's latest run (read at build; no runtime fs on the Worker).
export default async function MyListPage() {
	const ids = await listScheduleIds();
	const scheduleId = ids[0];
	if (!scheduleId) {
		return (
			<>
				<TopNav active="mylist" />
				<p className="p-8 text-muted">No report schedules found.</p>
			</>
		);
	}
	const report = await getReport(scheduleId, "latest");
	const bySymbol = new Map(report.candidates.map((c) => [c.symbol, c]));
	const universe: UniverseSymbol[] = (report.universe.symbols ?? []).map((symbol) => {
		const c = bySymbol.get(symbol);
		return {
			symbol,
			verdict: (c?.decision.verdict as Verdict) ?? null,
			label: c?.label ?? null,
		};
	});
	return (
		<>
			<TopNav active="mylist" subtitle={report.universe.name} />
			<MyListClient scheduleId={scheduleId} universe={universe} />
		</>
	);
}
