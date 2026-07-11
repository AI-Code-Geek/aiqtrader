/**
 * AI Brain market overview — renders the `<version>.ai.json` `market_overview` block (Phase 7).
 * Pure rendering; shown on the Market page above/beside the engine's technical market read. Absent when
 * the run has no AI extension.
 */
import type { AiMarketOverview } from "@/lib/report-types";

export function AiMarketSection({ market, model }: { market?: AiMarketOverview; model?: string }) {
	if (!market) return null;
	return (
		<div className="rounded-2xl border border-border bg-surface p-4">
			<div className="mb-2 flex items-center gap-2">
				<span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand">
					AI Brain
				</span>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Market read</h3>
				{model ? <span className="ml-auto text-xs text-muted">{model}</span> : null}
			</div>

			<dl className="space-y-2 text-sm">
				<Row label="Tape" value={market.tape} />
				<Row label="Risk tone" value={market.risk_tone} />
				<Row label="Macro" value={market.macro} />
				<Row label="Earnings cluster" value={market.earnings_cluster} />
			</dl>

			{market.handle_with_care?.length ? (
				<div className="mt-3">
					<div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Handle with care</div>
					<ul className="space-y-1">
						{market.handle_with_care.map((h, i) => (
							<li key={i} className="rounded-lg border border-watch/30 bg-watch/10 p-2 text-sm text-watch">
								{h}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{market.sources?.length ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{market.sources.map((s, i) => (
						<a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
							{hostOf(s.url)}
						</a>
					))}
				</div>
			) : null}
		</div>
	);
}

function Row({ label, value }: { label: string; value?: string }) {
	if (!value) return null;
	return (
		<div>
			<dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
			<dd className="text-muted">{value}</dd>
		</div>
	);
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
