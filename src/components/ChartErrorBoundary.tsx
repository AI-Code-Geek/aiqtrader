"use client";

import { Component, type ReactNode } from "react";

/**
 * Isolates third-party chart libraries (lightweight-charts / recharts) so an engine-specific render
 * failure — most often seen on iOS Safari / WebKit — degrades to a small "chart unavailable" notice
 * instead of blanking the whole symbol-detail page. The trade plan, decision and analysis still render.
 *
 * The caught error message is shown (collapsed) so a device without devtools can still report *what*
 * failed. Charts are the one heavy client-only surface on the symbol page; nothing here is a decision
 * input, so failing soft is always the right call.
 */
interface Props {
	children: ReactNode;
	label?: string;
}
interface State {
	error: Error | null;
}

export class ChartErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error) {
		// Surface it in the console for remote-debugging (Safari Web Inspector) too.
		console.error("[chart] render failed:", error);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
					<div className="font-semibold text-foreground">
						{this.props.label ?? "Chart"} unavailable on this device
					</div>
					<p className="mt-1">
						The rest of the analysis below is unaffected. If this keeps happening, try rotating the
						device or reloading.
					</p>
					<details className="mt-2">
						<summary className="cursor-pointer text-xs">details</summary>
						<pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap break-words text-[11px]">
							{this.state.error.message || String(this.state.error)}
						</pre>
					</details>
				</div>
			);
		}
		return this.props.children;
	}
}
