import Link from "next/link";
import type { Candidate } from "@/lib/report-types";
import { money, pct, num, mult } from "@/lib/format";
import { VerdictBadge, QualityGrade, ConvictionMeter, DirectionLabel } from "./badges";

export function CandidateTable({ candidates, scheduleId }: { candidates: Candidate[]; scheduleId: string }) {
	return (
		<div className="overflow-x-auto rounded-2xl border border-border bg-surface">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-border text-left text-xs text-muted">
						<th className="p-3">Symbol</th>
						<th className="p-3">Verdict</th>
						<th className="p-3">Dir</th>
						<th className="p-3">Strategy</th>
						<th className="p-3 text-right">Price</th>
						<th className="p-3 text-right">Chg</th>
						<th className="p-3 text-right">RVOL</th>
						<th className="p-3 text-right">RR</th>
						<th className="p-3">Grade</th>
						<th className="p-3 w-32">Conviction</th>
						<th className="p-3 text-right">Rank</th>
					</tr>
				</thead>
				<tbody>
					{candidates.map((c) => (
						<tr key={c.symbol} className="border-b border-border last:border-0 hover:bg-surface-2">
							<td className="p-3">
								<Link href={`/app/${scheduleId}/${c.symbol}`} className="font-semibold text-brand">
									{c.symbol}
								</Link>
							</td>
							<td className="p-3"><VerdictBadge verdict={c.decision.verdict} alignment={c.decision.alignment} /></td>
							<td className="p-3"><DirectionLabel direction={c.direction} /></td>
							<td className="p-3 text-muted">{c.label}</td>
							<td className="p-3 text-right mono">${money(c.price)}</td>
							<td className={`p-3 text-right ${c.change_pct >= 0 ? "text-long" : "text-short"}`}>{pct(c.change_pct)}</td>
							<td className="p-3 text-right mono">{mult(c.rvol)}</td>
							<td className="p-3 text-right mono">{num(c.setup.rr)}</td>
							<td className="p-3"><QualityGrade grade={c.quality.grade} /></td>
							<td className="p-3">
								<ConvictionMeter value={c.decision.conviction} />
								<span className="mono text-xs text-muted">{c.decision.conviction}</span>
							</td>
							<td className="p-3 text-right mono">{num(c.rank_score, 1)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
