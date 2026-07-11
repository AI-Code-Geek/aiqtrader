import { notFound } from "next/navigation";
import { getIndex, getReport, listScheduleIds } from "@/lib/reports-source";
import { TopNav } from "@/components/TopNav";
import { DashboardClient } from "@/components/DashboardClient";

// Pre-render every schedule at build (fs reads happen here, not at runtime on the Worker).
export async function generateStaticParams() {
	const ids = await listScheduleIds();
	return ids.map((scheduleId) => ({ scheduleId }));
}
export const dynamicParams = false;

export default async function DashboardPage({ params }: { params: Promise<{ scheduleId: string }> }) {
	const { scheduleId } = await params;
	try {
		const [index, report] = await Promise.all([getIndex(scheduleId), getReport(scheduleId, "latest")]);
		return (
			<>
				<TopNav active="dashboard" scheduleId={scheduleId} subtitle={`${report.persona} · ${report.schedule.name}`} />
				<DashboardClient scheduleId={scheduleId} index={index} initialReport={report} />
			</>
		);
	} catch {
		notFound();
	}
}
