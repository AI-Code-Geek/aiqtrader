"use client";

import Link from "next/link";
import { useState } from "react";
import { requestAccess } from "@/lib/api-client";
import { PERSONAS, type Persona } from "@/lib/user-types";
import { Brand } from "./Brand";

const ERRORS: Record<string, string> = {
	missing_name: "Please enter your name.",
	invalid_email: "Enter a valid email address.",
	bad_request: "Something went wrong — try again.",
};

export function RequestAccessForm() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [plan, setPlan] = useState<"pro" | "free">("free");
	const [persona, setPersona] = useState<Persona>("swing");
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);

	async function submit() {
		setError("");
		if (!name.trim()) return setError(ERRORS.missing_name);
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(ERRORS.invalid_email);
		setBusy(true);
		const r = await requestAccess({ name: name.trim(), email: email.trim(), plan, persona, note: note.trim() || undefined });
		setBusy(false);
		if (!r.ok) return setError(ERRORS[r.error ?? ""] ?? "Unable to submit — try again.");
		setDone(true);
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
				<Brand size="lg" tagline />

				{done ? (
					<div className="mt-4">
						<div className="rounded-lg border border-long/30 bg-long/10 p-3 text-sm text-long">
							Thanks, {name.split(" ")[0] || "there"} — your request is in. We&rsquo;ll email your
							subscription code to <b>{email}</b> once it&rsquo;s issued.
						</div>
						<Link href="/" className="mt-4 inline-block text-sm text-brand">
							← Back to sign in
						</Link>
					</div>
				) : (
					<>
						<p className="mt-1 mb-6 text-sm text-muted">
							Request a subscription code. We issue codes manually — you&rsquo;ll get yours by email.
						</p>

						<label className="mb-1 block text-sm text-muted">Name</label>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Your name"
							className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2"
						/>

						<label className="mb-1 block text-sm text-muted">Email</label>
						<input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="you@example.com"
							autoComplete="email"
							className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2"
						/>

						<label className="mb-1 block text-sm text-muted">Plan</label>
						<div className="mb-3 flex gap-2">
							{(["free", "pro"] as const).map((p) => {
								const enabled = p === "free"; // Pro is a future paid tier — kept visible, disabled.
								return (
									<button
										key={p}
										type="button"
										disabled={!enabled}
										aria-disabled={!enabled}
										title={enabled ? undefined : "Coming soon"}
										onClick={() => enabled && setPlan(p)}
										className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
											plan === p
												? "border-brand bg-brand/10 text-brand"
												: "border-border text-muted hover:bg-surface-2"
										} ${enabled ? "" : "cursor-not-allowed opacity-50 hover:bg-transparent"}`}
									>
										{p}
										{enabled ? "" : <span className="ml-1 text-[10px] uppercase tracking-wide">soon</span>}
									</button>
								);
							})}
						</div>

						<label className="mb-1 block text-sm text-muted">Persona (report style)</label>
						<div className="mb-1 flex gap-2">
							{PERSONAS.map((p) => {
								const enabled = p === "swing"; // Day & Scalp are future options — kept visible, disabled.
								return (
									<button
										key={p}
										type="button"
										disabled={!enabled}
										aria-disabled={!enabled}
										title={enabled ? undefined : "Coming soon"}
										onClick={() => enabled && setPersona(p)}
										className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
											persona === p
												? "border-brand bg-brand/10 text-brand"
												: "border-border text-muted hover:bg-surface-2"
										} ${enabled ? "" : "cursor-not-allowed opacity-50 hover:bg-transparent"}`}
									>
										{p}
										{enabled ? "" : <span className="ml-1 text-[10px] uppercase tracking-wide">soon</span>}
									</button>
								);
							})}
						</div>
						<p className="mb-3 text-xs text-muted">Which report stream you want to trade — we&rsquo;ll load that persona&rsquo;s reports for you. Day &amp; Scalp are coming soon.</p>

						<label className="mb-1 block text-sm text-muted">Note (optional)</label>
						<textarea
							value={note}
							onChange={(e) => setNote(e.target.value)}
							rows={3}
							placeholder="Anything we should know?"
							className="mb-3 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm"
						/>

						{error ? <p className="mb-3 rounded-lg border border-short/30 bg-short/10 p-2 text-sm text-short">{error}</p> : null}

						<button
							onClick={submit}
							disabled={busy}
							className="w-full rounded-lg bg-brand py-2 font-medium text-white disabled:opacity-60"
						>
							{busy ? "Submitting…" : "Request access →"}
						</button>

						<Link href="/" className="mt-4 inline-block text-sm text-muted hover:text-brand">
							Already have a code? Sign in
						</Link>
					</>
				)}
			</div>
		</div>
	);
}
