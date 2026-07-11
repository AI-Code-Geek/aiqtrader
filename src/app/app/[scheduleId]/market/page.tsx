import { notFound } from "next/navigation";
import { getAiReport, getIndex, getReport, listScheduleIds } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { MarketClient } from "@/components/MarketClient";

// Pre-render one market page per schedule at build (fs reads happen here, not on the Worker).
export async function generateStaticParams() {
	const ids = await listScheduleIds();
	return ids.map((scheduleId) => ({ scheduleId }));
}
export const dynamicParams = false;

export default async function MarketPage({ params }: { params: Promise<{ scheduleId: string }> }) {
	const { scheduleId } = await params;
	try {
		const [index, report] = await Promise.all([getIndex(scheduleId), getReport(scheduleId, "latest")]);
		const ai = await getAiReport(scheduleId, report.report_version);
		return (
			<>
				<TopNav active="market" scheduleId={scheduleId} subtitle={`${report.persona} · market`} />
				<MarketClient scheduleId={scheduleId} index={index} initialReport={report} initialAi={ai} />
			</>
		);
	} catch {
		notFound();
	}
}
