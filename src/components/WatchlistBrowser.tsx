"use client";

import Link from "next/link";
import { useState } from "react";
import type { WatchlistMeta } from "@/lib/manifest-types";
import { PERSONAS, type Persona } from "@/lib/user-types";
import { time } from "@/lib/format";

/**
 * Watchlists landing: pick a persona, then see the watchlists that have that persona's report stream.
 * Cards deep-link into the persona-scoped dashboard (/app/w/<id>/<persona>). Day/Scalp are shown but
 * disabled until a scheduler produces those streams (data-driven via `available`).
 */
export function WatchlistBrowser({
	watchlists,
	available,
}: {
	watchlists: WatchlistMeta[];
	available: string[];
}) {
	const firstAvailable = (PERSONAS.find((p) => available.includes(p)) ?? "swing") as Persona;
	const [persona, setPersona] = useState<Persona>(firstAvailable);
	const shown = watchlists.filter((w) => w.personas.includes(persona));

	return (
		<div className="mx-auto max-w-6xl px-4 py-6">
			<h1 className="mb-1 text-xl font-semibold">Watchlists</h1>
			<p className="mb-4 text-sm text-muted">
				Pick a persona, then open a watchlist to see its reports (technical + AI).
			</p>

			<div className="mb-5 flex items-center gap-2">
				<span className="text-xs text-muted">Persona:</span>
				{PERSONAS.map((p) => {
					const enabled = available.includes(p);
					return (
						<button
							key={p}
							type="button"
							disabled={!enabled}
							aria-disabled={!enabled}
							title={enabled ? undefined : "Coming soon"}
							onClick={() => enabled && setPersona(p)}
							className={`rounded-full border px-3 py-1 text-xs capitalize ${
								persona === p
									? "border-brand bg-brand/10 text-brand"
									: "border-border text-muted hover:border-brand"
							} ${enabled ? "" : "cursor-not-allowed opacity-50 hover:border-border"}`}
						>
							{p}
							{enabled ? "" : <span className="ml-1 text-[10px] uppercase tracking-wide">soon</span>}
						</button>
					);
				})}
			</div>

			{shown.length === 0 ? (
				<p className="text-sm text-muted">No watchlists for the {persona} persona yet.</p>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{shown.map((w) => (
						<Link
							key={w.slug}
							href={`/app/w/${w.slug}/${persona}`}
							className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="font-semibold">{w.name}</span>
								{w.latest?.hasAi ? (
									<span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand">
										AI ✓
									</span>
								) : (
									<span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">
										technical only
									</span>
								)}
							</div>
							<div className="mt-2 text-xs capitalize text-muted">
								{persona} · {w.report_count} report{w.report_count === 1 ? "" : "s"}
							</div>
							{w.latest ? (
								<div className="mt-1 text-xs text-muted">
									{w.latest.candidate_count} candidates · latest {time(w.latest.generated_at)}
								</div>
							) : null}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
