"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/lib/api-client";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/user-types";

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
	idea: "💡 Idea",
	bug: "🐛 Bug",
	praise: "🎉 Praise",
	question: "❓ Question",
	other: "💬 Other",
};

export function FeedbackForm() {
	const pathname = usePathname();
	const [category, setCategory] = useState<FeedbackCategory>("idea");
	const [rating, setRating] = useState(0);
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState("");

	async function submit() {
		setError("");
		if (!message.trim()) return setError("Please tell us a little more.");
		setBusy(true);
		const r = await submitFeedback({
			category,
			rating: rating || undefined,
			message: message.trim(),
			page: pathname ?? undefined,
		});
		setBusy(false);
		if (!r.ok) {
			return setError(r.error === "unauthenticated" ? "Please sign in first." : "Couldn't send — please try again.");
		}
		setDone(true);
	}

	return (
		<div className="mx-auto max-w-xl px-4 py-8">
			<h1 className="text-xl font-semibold">Share your feedback</h1>
			<p className="mt-1 mb-6 text-sm text-muted">
				Ideas, bugs, or anything you love or want changed — we read every message.
			</p>

			{done ? (
				<div className="rounded-xl border border-long/30 bg-long/10 p-4 text-sm text-long">
					🙏 Thank you — your feedback is in. We appreciate you helping make TradeAIQ better.
					<div className="mt-3">
						<button onClick={() => { setDone(false); setMessage(""); setRating(0); }} className="text-brand">
							Send another
						</button>
						<span className="mx-2 text-muted">·</span>
						<Link href="/app" className="text-brand">Back to dashboard</Link>
					</div>
				</div>
			) : (
				<div className="rounded-2xl border border-border bg-surface p-5">
					<label className="mb-1 block text-sm text-muted">What kind of feedback?</label>
					<div className="mb-4 flex flex-wrap gap-2">
						{FEEDBACK_CATEGORIES.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setCategory(c)}
								className={`rounded-lg border px-3 py-1.5 text-sm ${
									category === c ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:bg-surface-2"
								}`}
							>
								{CATEGORY_LABEL[c]}
							</button>
						))}
					</div>

					<label className="mb-1 block text-sm text-muted">How&rsquo;s your experience? (optional)</label>
					<div className="mb-4 flex gap-1" role="radiogroup" aria-label="rating">
						{[1, 2, 3, 4, 5].map((n) => (
							<button
								key={n}
								type="button"
								aria-label={`${n} star${n > 1 ? "s" : ""}`}
								onClick={() => setRating(n === rating ? 0 : n)}
								className={`text-2xl leading-none ${n <= rating ? "text-brand" : "text-muted opacity-40 hover:opacity-70"}`}
							>
								★
							</button>
						))}
					</div>

					<label className="mb-1 block text-sm text-muted">Your message</label>
					<textarea
						value={message}
						onChange={(e) => { setMessage(e.target.value); setError(""); }}
						rows={5}
						maxLength={4000}
						placeholder="What's on your mind?"
						className="mb-1 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm"
						style={{ borderColor: error ? "var(--tc-bear, #ef4444)" : undefined }}
					/>
					<div className="mb-3 text-right text-[11px] text-muted">{message.length}/4000</div>

					{error ? <p className="mb-3 rounded-lg border border-short/30 bg-short/10 p-2 text-sm text-short">{error}</p> : null}

					<button
						onClick={submit}
						disabled={busy}
						className="w-full rounded-lg bg-brand py-2 font-medium text-white disabled:opacity-60"
					>
						{busy ? "Sending…" : "Send feedback"}
					</button>
				</div>
			)}
		</div>
	);
}
