import Link from "next/link";
import type { Candidate, Report } from "@/lib/report-types";
import { money, pct, num, mult } from "@/lib/format";
import { VerdictBadge, QualityGrade, ConvictionMeter, DirectionLabel, RegimeChip, ConfluenceMini } from "./badges";

export function CandidateCard({ candidate: c, report, scheduleId }: { candidate: Candidate; report: Report; scheduleId: string }) {
	const d = c.decision;
	const confluence = report.decisions[c.symbol]?.confluence;

	// Display-only arithmetic on the engine's own numbers (distance to stop/target as a %). The scale-out
	// ladder comes straight from the engine's entry_plan — the UI never derives levels itself.
	const entry = c.setup.entry;
	const riskPct = entry ? Math.abs(((entry - c.setup.stop) / entry) * 100).toFixed(1) : null;
	const rewardPct = entry ? Math.abs(((c.setup.target - entry) / entry) * 100).toFixed(1) : null;
	const ladder = d.entry_plan?.entry_now?.ladder?.targets ?? [];
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

			{/* The plan: entry / stop / target (+ the scale-out ladder when the engine gives one). */}
			<div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5">
				<div>
					<div className="text-[10px] uppercase tracking-wide text-muted">Entry</div>
					<div className="mono text-sm">${money(c.setup.entry)}</div>
				</div>
				<div>
					<div className="text-[10px] uppercase tracking-wide text-muted">Stop</div>
					<div className="mono text-sm text-short">
						${money(c.setup.stop)}
						{riskPct != null ? <span className="ml-1 text-[10px] text-muted">−{riskPct}%</span> : null}
					</div>
				</div>
				<div>
					<div className="text-[10px] uppercase tracking-wide text-muted">Target</div>
					<div className="mono text-sm text-long">
						${money(c.setup.target)}
						{rewardPct != null ? <span className="ml-1 text-[10px] text-muted">+{rewardPct}%</span> : null}
					</div>
				</div>
			</div>

			{ladder.length > 0 ? (
				<div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
					<span className="uppercase tracking-wide">Exits</span>
					{ladder.map((t) => (
						<span key={t.milestone ?? t.level} className="mono">
							{t.milestone ?? "T"} ${money(t.level)}
							{t.pct ? <span className="text-muted"> ({t.pct}%)</span> : null}
						</span>
					))}
				</div>
			) : null}
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
