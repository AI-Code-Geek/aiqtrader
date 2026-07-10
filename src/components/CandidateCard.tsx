import Link from "next/link";
import type { Candidate, Report } from "@/lib/report-types";
import { money, pct, num, mult } from "@/lib/format";
import { VerdictBadge, QualityGrade, ConvictionMeter, DirectionLabel, RegimeChip, ConfluenceMini } from "./badges";

export function CandidateCard({ candidate: c, report, scheduleId }: { candidate: Candidate; report: Report; scheduleId: string }) {
	const d = c.decision;
	const confluence = report.decisions[c.symbol]?.confluence;
	return (
		<Link
			href={`/app/${scheduleId}/${c.symbol}`}
			className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
		>
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<span className="text-lg font-semibold">{c.symbol}</span>
					<VerdictBadge verdict={d.verdict} alignment={d.alignment} />
				</div>
				<div className="text-right">
					<div className="mono">${money(c.price)}</div>
					<div className={`text-sm ${c.change_pct >= 0 ? "text-long" : "text-short"}`}>{pct(c.change_pct)}</div>
				</div>
			</div>
			<div className="mt-1 flex items-center gap-2 text-sm text-muted">
				<span>{c.label}</span>·<DirectionLabel direction={c.direction} />·<RegimeChip label={c.regime} />
			</div>
			<div className="mt-2 flex items-center gap-2">
				<QualityGrade grade={c.quality.grade} />
				<span className="text-sm text-muted">RR {num(c.setup.rr)} · RVOL {mult(c.rvol)}</span>
			</div>
			<div className="mt-2 mb-1 flex justify-between text-sm text-muted">
				<span>Conviction</span>
				<span className="mono">
					{d.conviction}
					{d.raw_conviction !== d.conviction ? <span className="text-muted"> (raw {d.raw_conviction})</span> : null}
				</span>
			</div>
			<ConvictionMeter value={d.conviction} />
			{confluence ? <div className="mt-2"><ConfluenceMini confluence={confluence} /></div> : null}
		</Link>
	);
}
