import { redirect } from "next/navigation";
import { listScheduleIds } from "@/lib/reports-source";

/** /app -> the first (default) schedule's dashboard. */
export default async function AppIndex() {
	const ids = await listScheduleIds();
	if (ids.length === 0) {
		return <p className="p-8 text-muted">No report schedules found in data/reports.</p>;
	}
	redirect(`/app/${ids[0]}`);
}
