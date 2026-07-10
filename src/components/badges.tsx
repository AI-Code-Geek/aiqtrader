/** Small presentational badges/meters. Pure rendering — no business logic (CLAUDE.md #2). */
import type { Verdict, Alignment, Direction, Grade, Confluence } from "@/lib/report-types";

const VERDICT_STYLE: Record<string, string> = {
	take: "text-take bg-take/15",
	watch: "text-watch bg-watch/15",
	arm: "text-arm bg-arm/15",
	avoid: "text-avoid bg-avoid/15",
};

export function VerdictBadge({ verdict, alignment }: { verdict: Verdict; alignment?: Alignment }) {
	const style = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.avoid;
	const ring = alignment === "conflict" ? " ring-2 ring-inset ring-short/40" : "";
	return (
		<span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style}${ring}`}>
			{verdict}
		</span>
	);
}

const GRADE_STYLE: Record<string, string> = {
	A: "text-take bg-take/15",
	B: "text-arm bg-arm/15",
	C: "text-watch bg-watch/15",
	D: "text-short bg-short/15",
};

export function QualityGrade({ grade }: { grade: Grade }) {
	const key = (grade ?? "?").charAt(0);
	const style = GRADE_STYLE[key] ?? "text-muted bg-surface-2";
	return (
		<span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold ${style}`}>
			{key}
		</span>
	);
}

export function ConvictionMeter({ value }: { value: number }) {
	const w = Math.max(0, Math.min(100, value));
	return (
		<div className="h-1.5 w-full overflow-hidden rounded bg-surface-2">
			<span className="block h-full bg-brand" style={{ width: `${w}%` }} />
		</div>
	);
}

export function DirectionLabel({ direction }: { direction: Direction }) {
	return (
		<span className={`font-semibold ${direction === "long" ? "text-long" : "text-short"}`}>
			{direction === "long" ? "▲ Long" : "▼ Short"}
		</span>
	);
}

export function RegimeChip({ label }: { label: string }) {
	return (
		<span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">{label}</span>
	);
}

const DIM_ORDER = ["trend", "momentum", "volatility", "volume", "structure"];

export function ConfluenceMini({ confluence }: { confluence: Confluence }) {
	const dims = confluence.dimensions ?? {};
	return (
		<div className="flex flex-wrap gap-1">
			{DIM_ORDER.filter((k) => dims[k]).map((k) => {
				const read = dims[k].read;
				const color = read === "bull" ? "text-bull border-bull/40" : read === "bear" ? "text-bear border-bear/40" : "text-muted";
				return (
					<span key={k} title={`${dims[k].detail} (w${dims[k].weight})`} className={`rounded border border-border px-1.5 py-0.5 text-[0.7rem] ${color}`}>
						{k.charAt(0).toUpperCase()}: {read}
					</span>
				);
			})}
		</div>
	);
}
