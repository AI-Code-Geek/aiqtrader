import Link from "next/link";
import type { Candidate } from "@/lib/report-types";
import { money, pct, num, mult } from "@/lib/format";
import { VerdictBadge, QualityGrade, ConvictionMeter, DirectionLabel } from "./badges";

export function CandidateTable({
	candidates,
	scheduleId,
	version = "latest",
}: {
	candidates: Candidate[];
	scheduleId: string;
	/** The run the dashboard is currently showing — carried into the symbol page so it opens the SAME run. */
	version?: string;
}) {
	const q = version && version !== "latest" ? `?v=${version}` : "";
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
						<th className="p-3 text-right">Entry</th>
						<th className="p-3 text-right">Stop</th>
						<th className="p-3 text-right">Target</th>
						<th className="p-3 text-right">Hold</th>
						<th className="p-3">Grade</th>
						<th className="p-3 w-32">Conviction</th>
						<th className="p-3 text-right">Rank</th>
					</tr>
				</thead>
				<tbody>
					{candidates.map((c) => {
						// Display-only: % distance to the engine's own stop/target. The levels come from the engine.
						const entry = c.setup.entry;
						const riskPct = entry ? Math.abs(((entry - c.setup.stop) / entry) * 100).toFixed(1) : null;
						const rewardPct = entry ? Math.abs(((c.setup.target - entry) / entry) * 100).toFixed(1) : null;
						// Trade horizon straight from the engine (decision.entry_plan.duration).
						const dur = c.decision.entry_plan?.duration;
						const unit = (dur?.unit ?? "day").startsWith("h") ? "h" : "d";
						return (
						<tr key={c.symbol} className="border-b border-border last:border-0 hover:bg-surface-2">
							<td className="p-3">
								<Link href={`/app/${scheduleId}/${c.symbol}${q}`} className="font-semibold text-brand">
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
							<td className="p-3 text-right mono">${money(c.setup.entry)}</td>
							<td className="p-3 text-right mono text-short whitespace-nowrap">
								${money(c.setup.stop)}
								{riskPct ? <span className="ml-1 text-[10px] text-muted">−{riskPct}%</span> : null}
							</td>
							<td className="p-3 text-right mono text-long whitespace-nowrap">
								${money(c.setup.target)}
								{rewardPct ? <span className="ml-1 text-[10px] text-muted">+{rewardPct}%</span> : null}
							</td>
							<td className="p-3 text-right mono whitespace-nowrap" title={dur?.valid_until ?? undefined}>
								{dur?.expected_bars != null ? (
									<>
										~{dur.expected_bars}{unit}
										{dur.max_bars != null ? <span className="ml-1 text-[10px] text-muted">max {dur.max_bars}{unit}</span> : null}
									</>
								) : (
									<span className="text-muted">—</span>
								)}
							</td>
							<td className="p-3"><QualityGrade grade={c.quality.grade} /></td>
							<td className="p-3">
								<ConvictionMeter value={c.decision.conviction} />
								<span className="mono text-xs text-muted">{c.decision.conviction}</span>
							</td>
							<td className="p-3 text-right mono">{num(c.rank_score, 1)}</td>
						</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
