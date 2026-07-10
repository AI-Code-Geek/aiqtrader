import type { Report } from "@/lib/report-types";
import { RegimeChip } from "./badges";

/** Market/tape context, read from any decision's market block (it's global to the run). */
export function MarketTapeBanner({ report }: { report: Report }) {
	const first = Object.values(report.decisions ?? {})[0];
	const m = first?.decision?.market;
	return (
		<div className="rounded-2xl border border-border bg-surface p-3">
			<div className="mb-1 flex flex-wrap items-center gap-2">
				<RegimeChip label={`tape · ${m?.state ?? "—"}`} />
				<RegimeChip label={`sector ${m?.sector ?? ""} ${m?.sector_state ?? ""}`} />
				<RegimeChip label={`${report.persona} persona`} />
			</div>
			<div className="text-sm text-muted">{m?.note ?? "Market context unavailable."}</div>
		</div>
	);
}
