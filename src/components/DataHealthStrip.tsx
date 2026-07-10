import type { DataHealth } from "@/lib/report-types";
import { time } from "@/lib/format";

export function DataHealthStrip({ health }: { health: DataHealth }) {
	const s = health.summary;
	const dot = s.missing || s.errors ? "bg-short" : s.partial ? "bg-watch" : "bg-take";
	return (
		<div className="rounded-2xl border border-border bg-surface p-3">
			<div className="mb-1 flex items-center gap-2">
				<span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
				<b className="text-sm">Data health</b>
				<span className="text-xs text-muted">checked {time(health.checked_at)}</span>
			</div>
			<div className="flex flex-wrap gap-x-4 text-sm">
				<span>{s.ok}/{s.total_symbols} ok</span>
				<span className="text-muted">partial {s.partial}</span>
				<span className="text-muted">missing {s.missing}</span>
				{Object.entries(s.by_timeframe ?? {}).map(([tf, o]) => (
					<span key={tf} className="text-xs">
						<b>{tf}</b> <span className="text-muted">{o.ok} ok{o.stale ? `, ${o.stale} stale` : ""}</span>
					</span>
				))}
			</div>
		</div>
	);
}
