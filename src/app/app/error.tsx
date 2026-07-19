"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary for every /app page (App Router). Without this, a render exception —
 * e.g. an engine-specific failure surfaced only on iOS Safari / WebKit — produces a silent blank page.
 * This turns that into a legible message + retry, and prints the error to the console for remote
 * debugging (Safari Web Inspector). Charts are additionally isolated by ChartErrorBoundary so they
 * fail soft without reaching this level.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error("[app] page render failed:", error);
	}, [error]);

	return (
		<div className="mx-auto max-w-2xl px-4 py-16 text-center">
			<h1 className="text-lg font-semibold text-foreground">Something went wrong loading this page</h1>
			<p className="mt-2 text-sm text-muted">
				This can happen on some mobile browsers. Your data is fine — try again, or head back to the
				dashboard.
			</p>
			<div className="mt-4 flex items-center justify-center gap-3">
				<button
					onClick={reset}
					className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
				>
					Try again
				</button>
				<Link href="/app" className="rounded-md border border-border px-4 py-2 text-sm">
					Dashboard
				</Link>
			</div>
			<details className="mt-6 text-left">
				<summary className="cursor-pointer text-xs text-muted">error details</summary>
				<pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 p-3 text-[11px]">
					{error.message || String(error)}
					{error.digest ? `\n\ndigest: ${error.digest}` : ""}
				</pre>
			</details>
		</div>
	);
}
