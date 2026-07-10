"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMyList, setMyList } from "@/lib/client-user";
import { fetchMe, saveMyList } from "@/lib/api-client";
import { VerdictBadge } from "./badges";
import type { Verdict } from "@/lib/report-types";

export interface UniverseSymbol {
	symbol: string;
	/** verdict if the symbol is an actionable candidate in the latest run, else null */
	verdict: Verdict | null;
	label: string | null;
}

/**
 * Manage the user's personal subset of the universe. localStorage mirror for instant paint
 * (DEVPLAN §4/§5); in Phase 4+ this reconciles with the KV user record via PATCH /api/my-list.
 */
export function MyListClient({ scheduleId, universe }: { scheduleId: string; universe: UniverseSymbol[] }) {
	const [mine, setMine] = useState<string[]>([]);
	const [query, setQuery] = useState("");

	useEffect(() => {
		// Instant paint from the localStorage mirror, then reconcile with the KV record (cross-device).
		setMine(getMyList());
		fetchMe().then((me) => {
			if (!me) return;
			setMine(me.myList ?? []);
			setMyList(me.myList ?? []);
		});
	}, []);

	function toggle(symbol: string) {
		setMine((prev) => {
			const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
			setMyList(next); // localStorage mirror (instant)
			saveMyList(next); // KV record (source of truth); fire-and-forget
			return next;
		});
	}

	const filtered = useMemo(() => {
		const q = query.trim().toUpperCase();
		return q ? universe.filter((u) => u.symbol.includes(q)) : universe;
	}, [universe, query]);

	return (
		<div className="mx-auto max-w-4xl px-4 py-4">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-xl font-semibold">My List</h1>
					<span className="text-sm text-muted">
						{mine.length} of {universe.length} symbols selected ·{" "}
						<Link href={`/app/${scheduleId}?mine=1`} className="text-brand">view dashboard filtered →</Link>
					</span>
				</div>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Filter symbols…"
					className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
				/>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{filtered.map((u) => {
					const on = mine.includes(u.symbol);
					return (
						<button
							key={u.symbol}
							onClick={() => toggle(u.symbol)}
							className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
								on ? "border-brand bg-brand/10" : "border-border bg-surface hover:bg-surface-2"
							}`}
						>
							<div>
								<div className="font-semibold">{u.symbol}</div>
								<div className="text-xs text-muted">{u.label ?? "watching · no setup"}</div>
							</div>
							<div className="flex items-center gap-2">
								{u.verdict ? <VerdictBadge verdict={u.verdict} /> : null}
								<span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${on ? "border-brand bg-brand text-white" : "border-border text-muted"}`}>
									{on ? "✓" : "+"}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
