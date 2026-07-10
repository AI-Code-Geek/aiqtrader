import { notFound } from "next/navigation";
import { getIndex, getReport, listScheduleIds } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { SymbolDetailClient } from "@/components/SymbolDetailClient";

// Pre-render every schedule × symbol-with-a-decision at build (fs reads happen here, not on the Worker).
export async function generateStaticParams() {
	const ids = await listScheduleIds();
	const params: { scheduleId: string; symbol: string }[] = [];
	for (const scheduleId of ids) {
		try {
			const report = await getReport(scheduleId, "latest");
			for (const symbol of Object.keys(report.decisions ?? {})) {
				params.push({ scheduleId, symbol });
			}
		} catch {
			// skip schedules without a readable latest run
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
		if (!report.decisions?.[symbol]) notFound();
		return (
			<>
				<TopNav active="dashboard" subtitle={`${report.persona} · ${symbol}`} />
				<SymbolDetailClient scheduleId={scheduleId} symbol={symbol} index={index} initialReport={report} />
			</>
		);
	} catch {
		notFound();
	}
}
