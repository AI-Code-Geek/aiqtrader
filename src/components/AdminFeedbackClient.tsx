"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchFeedback, setFeedbackStatus } from "@/lib/api-client";
import type { Feedback, FeedbackStatus } from "@/lib/user-types";
import { time } from "@/lib/format";

const CAT_ICON: Record<string, string> = { idea: "💡", bug: "🐛", praise: "🎉", question: "❓", other: "💬" };
const FILTERS: Array<"all" | FeedbackStatus> = ["all", "new", "read", "archived"];

export function AdminFeedbackClient() {
	const [items, setItems] = useState<Feedback[]>([]);
	const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchFeedback().then(setItems).finally(() => setLoading(false));
	}, []);

	const counts = useMemo(() => {
		const c: Record<string, number> = { all: items.length, new: 0, read: 0, archived: 0 };
		for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
		return c;
	}, [items]);

	const shown = useMemo(
		() => (filter === "all" ? items : items.filter((i) => i.status === filter)),
		[items, filter],
	);

	async function mark(id: string, status: FeedbackStatus) {
		const ok = await setFeedbackStatus(id, status);
		if (ok) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
	}

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted">{items.length} total · newest first</p>
				<div className="flex gap-2">
					{FILTERS.map((f) => (
						<button
							key={f}
							onClick={() => setFilter(f)}
							className={`rounded-full border px-3 py-1 text-xs capitalize ${
								filter === f ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:border-brand"
							}`}
						>
							{f} {counts[f] ? `(${counts[f]})` : ""}
						</button>
					))}
				</div>
			</div>

			{loading ? (
				<p className="text-sm text-muted">Loading…</p>
			) : shown.length === 0 ? (
				<p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
					No {filter === "all" ? "" : filter} feedback yet.
				</p>
			) : (
				<div className="flex flex-col gap-3">
					{shown.map((f) => (
						<div
							key={f.id}
							className={`rounded-xl border bg-surface p-4 ${
								f.status === "new" ? "border-brand/40" : "border-border"
							} ${f.status === "archived" ? "opacity-60" : ""}`}
						>
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<span title={f.category}>{CAT_ICON[f.category] ?? "💬"}</span>
								<span className="font-semibold">{f.name || f.email}</span>
								<span className="text-muted">· {f.email}</span>
								{f.rating ? <span className="text-brand" title={`${f.rating}/5`}>{"★".repeat(f.rating)}</span> : null}
								{f.status === "new" ? (
									<span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] uppercase text-brand">new</span>
								) : null}
								<span className="ml-auto text-xs text-muted">{time(f.createdAt)}</span>
							</div>
							<p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
							<div className="mt-3 flex items-center gap-3 text-xs text-muted">
								{f.page ? <span>on <code className="rounded bg-surface-2 px-1">{f.page}</code></span> : null}
								<span className="ml-auto flex gap-2">
									{f.status !== "read" ? (
										<button onClick={() => mark(f.id, "read")} className="text-brand hover:underline">Mark read</button>
									) : null}
									{f.status !== "archived" ? (
										<button onClick={() => mark(f.id, "archived")} className="hover:underline">Archive</button>
									) : (
										<button onClick={() => mark(f.id, "read")} className="text-brand hover:underline">Unarchive</button>
									)}
								</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
