/**
 * TradeAIQ brand lockup — matches the design handoff (TradeAIQ Theme.dc.html cover):
 * a square gradient mark ("AIQ") + the "TradeAIQ" wordmark, optional "AI + Trader IQ, together" tagline.
 * Colors/gradient/shadow are taken verbatim from the handoff for design fidelity (CLAUDE.md #12).
 */
const SIZES = {
	md: { box: "h-9 w-9 rounded-[10px] text-sm", word: "text-base", tag: "text-[11px]" },
	lg: { box: "h-11 w-11 rounded-xl text-base", word: "text-2xl", tag: "text-xs" },
} as const;

const MARK_STYLE: React.CSSProperties = {
	background: "linear-gradient(145deg, oklch(0.62 0.17 258), oklch(0.5 0.18 268))",
	boxShadow: "0 4px 12px oklch(0.58 0.165 258 / 0.35)",
};

export function Brand({
	size = "md",
	tagline = false,
}: {
	size?: keyof typeof SIZES;
	tagline?: boolean;
}) {
	const s = SIZES[size];
	return (
		<span className="flex items-center gap-2.5">
			<span
				className={`${s.box} flex items-center justify-center font-bold tracking-tight text-white`}
				style={MARK_STYLE}
				aria-hidden
			>
				AIQ
			</span>
			<span className="leading-[1.05]">
				<span className={`block font-bold tracking-tight ${s.word}`}>TradeAIQ</span>
				{tagline ? (
					<span className={`block font-medium text-muted ${s.tag}`}>AI + Trader IQ, together</span>
				) : null}
			</span>
		</span>
	);
}
