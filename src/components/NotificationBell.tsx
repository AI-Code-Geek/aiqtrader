"use client";

/**
 * New-report notifications. Shows a bell in the nav with an unread count; the dropdown lists the
 * watchlists whose latest report is newer than what this ACCOUNT has seen.
 *
 * - Feed: static `/reports/manifest.json`, polled so an open tab notices a newly published report.
 * - Read/unread: per-account (`user.seenReports` in KV via PATCH /api/seen-reports), so it syncs across
 *   devices; localStorage is only an instant-paint mirror. See src/lib/notifications.ts.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	fetchFeed,
	loadSeen,
	mergeSeen,
	persistSeen,
	seenAll,
	unseen,
	type FeedEntry,
	type SeenMap,
} from "@/lib/notifications";

const POLL_MS = 5 * 60 * 1000; // 5 min — reports publish on a cadence, not per-second

function ago(iso: string): string {
	const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const h = Math.round(mins / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.round(h / 24)}d ago`;
}

export function NotificationBell() {
	const [items, setItems] = useState<FeedEntry[]>([]);
	const [open, setOpen] = useState(false);
	const seenRef = useRef<SeenMap>({});
	const boxRef = useRef<HTMLDivElement>(null);

	/** Re-evaluate the feed against the current seen-map. */
	const refresh = useCallback(async () => {
		const feed = await fetchFeed();
		if (!feed) return;
		setItems(unseen(feed.watchlists, seenRef.current));
	}, []);

	// Initial load: resolve the account's seen-state (server truth), then diff the feed against it.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const [{ seen, isNew }, feed] = await Promise.all([loadSeen(), fetchFeed()]);
			if (cancelled || !feed) return;
			if (isNew) {
				// Brand-new account: seed everything as read rather than showing every existing report.
				const all = seenAll(feed.watchlists);
				seenRef.current = all;
				await persistSeen(all);
				setItems([]);
				return;
			}
			seenRef.current = seen;
			setItems(unseen(feed.watchlists, seen));
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Poll for newly published reports; also re-check when the user returns to the tab.
	useEffect(() => {
		const id = setInterval(refresh, POLL_MS);
		const onFocus = () => refresh();
		window.addEventListener("focus", onFocus);
		return () => {
			clearInterval(id);
			window.removeEventListener("focus", onFocus);
		};
	}, [refresh]);

	// Close the dropdown on an outside click.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	/** Mark entries read: update local state + persist to the account record (syncs to other devices). */
	const markRead = useCallback((entries: FeedEntry[]) => {
		const next = mergeSeen(seenRef.current, seenAll(entries));
		seenRef.current = next;
		setItems((cur) => cur.filter((x) => !entries.some((e) => e.slug === x.slug)));
		void persistSeen(next);
	}, []);

	const count = items.length;

	return (
		<div className="relative" ref={boxRef}>
			<button
				onClick={() => setOpen((o) => !o)}
				className="relative rounded-md border border-border px-2 py-1 text-sm"
				aria-label={count ? `${count} new reports` : "Notifications"}
				title={count ? `${count} new report${count > 1 ? "s" : ""}` : "No new reports"}
			>
				🔔
				{count ? (
					<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
						{count > 9 ? "9+" : count}
					</span>
				) : null}
			</button>

			{open ? (
				<div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-lg">
					<div className="mb-1 flex items-center justify-between px-2 py-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-muted">
							New reports {count ? `(${count})` : ""}
						</span>
						{count ? (
							<button onClick={() => markRead(items)} className="text-xs text-brand">
								Mark all read
							</button>
						) : null}
					</div>

					{count === 0 ? (
						<p className="px-2 py-3 text-sm text-muted">You&rsquo;re up to date — no new reports.</p>
					) : (
						<ul className="max-h-80 space-y-1 overflow-y-auto">
							{items.map((e) => (
								<li key={e.slug}>
									<Link
										href={`/app/w/${e.slug}/${e.persona}`}
										onClick={() => {
											markRead([e]);
											setOpen(false);
										}}
										className="block rounded-lg p-2 hover:bg-surface-2"
									>
										<div className="flex items-center gap-2">
											<span className="font-medium">{e.name}</span>
											<span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs capitalize text-muted">{e.persona}</span>
											{e.hasAi ? (
												<span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">AI</span>
											) : null}
											<span className="ml-auto text-xs text-muted">{ago(e.generated_at)}</span>
										</div>
										<div className="mt-0.5 text-xs text-muted">{e.candidate_count} candidates · new run</div>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}
		</div>
	);
}
