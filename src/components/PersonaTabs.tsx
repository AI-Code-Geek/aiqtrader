import Link from "next/link";

/**
 * Persona selector for a watchlist. Reports are organized watchlist → persona → runs; each persona is
 * a distinct report stream (its own scheduler). Rendered on every persona-scoped page.
 */
export function PersonaTabs({
	watchlistId,
	personas,
	active,
	view = "",
}: {
	watchlistId: string;
	personas: string[];
	active: string;
	/** Sub-view to preserve when switching persona: "" (dashboard), "market", or "history". */
	view?: "" | "market" | "history";
}) {
	if (personas.length === 0) return null;
	const href = (p: string) => `/app/w/${watchlistId}/${p}${view ? `/${view}` : ""}`;
	return (
		<div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-3">
			<span className="text-xs text-muted">Persona:</span>
			{personas.map((p) => (
				<Link
					key={p}
					href={href(p)}
					className={`rounded-full border px-3 py-1 text-xs capitalize ${
						p === active
							? "border-brand bg-brand/10 text-brand"
							: "border-border text-muted hover:border-brand"
					}`}
				>
					{p}
				</Link>
			))}
		</div>
	);
}
