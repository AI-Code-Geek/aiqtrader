"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setUser } from "@/lib/client-user";
import { redeemCode } from "@/lib/api-client";

const ERRORS: Record<string, string> = {
	missing_code: "Enter your subscription code.",
	invalid_code: "That code isn’t recognised.",
	inactive: "This subscription is not active.",
	bad_request: "Something went wrong — try again.",
};

function LandingForm() {
	const router = useRouter();
	const params = useSearchParams();
	const next = params.get("next") || "/app";
	const [code, setCode] = useState("AIQ-DEMO-2026");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function redeem() {
		const c = code.trim();
		if (!c) return setError(ERRORS.missing_code);
		setBusy(true);
		setError("");
		// Real redeem (DEVPLAN §4): code → KV user → signed httpOnly cookie set by the server.
		const r = await redeemCode(c);
		setBusy(false);
		if (!r.ok || !r.user) {
			const msg = r.reason === "suspended" ? "This subscription is suspended." : r.reason === "expired" ? "This subscription has expired." : ERRORS[r.error ?? ""] ?? "Unable to sign in.";
			return setError(msg);
		}
		setUser(r.user); // localStorage mirror for instant paint (reconciled from /api/me later)
		router.push(next.startsWith("/app") ? next : "/app");
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
				<h1 className="text-2xl font-bold">
					AIQ<span className="text-brand">Trader</span>
				</h1>
				<p className="mt-1 mb-6 text-sm text-muted">Enter your subscription code to view watchlist reports.</p>

				<label className="mb-1 block text-sm text-muted">Access code</label>
				<input
					value={code}
					onChange={(e) => setCode(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && redeem()}
					placeholder="AIQ-XXXX-XXXX"
					autoComplete="off"
					className="mono mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-lg"
				/>
				{error ? <p className="mb-3 rounded-lg border border-short/30 bg-short/10 p-2 text-sm text-short">{error}</p> : null}
				<button
					onClick={redeem}
					disabled={busy}
					className="w-full rounded-lg bg-brand py-2 font-medium text-white disabled:opacity-60"
				>
					{busy ? "Checking…" : "Unlock dashboard →"}
				</button>
			</div>
		</div>
	);
}

export default function Landing() {
	return (
		<Suspense fallback={null}>
			<LandingForm />
		</Suspense>
	);
}
