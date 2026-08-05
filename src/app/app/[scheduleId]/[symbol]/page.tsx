import { notFound } from "next/navigation";
import { getAiReport, getIndex, getReport, listScheduleIds, sliceReportForSymbol, symbolsAcrossRuns } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { SymbolDetailClient } from "@/components/SymbolDetailClient";

// Pre-render every schedule × symbol-with-a-decision-in-ANY-retained-run (fs reads happen here, not on
// the Worker). Deriving these from latest.json alone was a 404 factory: the dashboard's Run picker can
// show an archived run whose candidates link to symbols the newest run dropped, and `dynamicParams =
// false` turns each of those into a 404. See reports-source.symbolsAcrossRuns.
export async function generateStaticParams() {
	const ids = await listScheduleIds();
	const params: { scheduleId: string; symbol: string }[] = [];
	for (const scheduleId of ids) {
		for (const symbol of await symbolsAcrossRuns(scheduleId)) {
			params.push({ scheduleId, symbol });
		}
	}
	return params;
}
export const dynamicParams = false;

export default async function SymbolPage({
	params,
}: {
	params: Promise<{ scheduleId: string; symbol: string }>;
}) {
	const { scheduleId, symbol } = await params;
	try {
		const [index, report] = await Promise.all([getIndex(scheduleId), getReport(scheduleId, "latest")]);
		// NOT a 404 when the symbol is absent from the latest run — this page is also reachable with
		// `?v=<archived run>`, which the client resolves after mount. Serving the shell lets that load;
		// without a `?v=` the client shows "no decision in this run" plus the run picker.
		const ai = await getAiReport(scheduleId, report.report_version);
		return (
			<>
				<TopNav active="dashboard" scheduleId={scheduleId} subtitle={`${report.persona} · ${symbol}`} />
				<SymbolDetailClient
					scheduleId={scheduleId}
					symbol={symbol}
					index={index}
					initialReport={sliceReportForSymbol(report, symbol)}
					initialAi={ai?.symbols?.[symbol]}
				/>
			</>
		);
	} catch {
		notFound();
	}
}
