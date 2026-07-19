/**
 * P9-08 · "Since you last looked" — compose the stored per-run diffs over the unseen window
 * (last-seen run → now) into ONE net view: the NET verdict change per symbol, not the 6 intermediate
 * wiggles. This is sanctioned UI *composition* of what the engine already computed (each `.diff.json`),
 * not re-derivation of analysis (CLAUDE.md §2, and phase overview open-question #1 explicitly assigns
 * the multi-run merge to the viewer). No new engine work.
 *
 * The boundary `since` is the `generated_at` the account last acknowledged for this watchlist
 * (`user.seenReports[slug]`, shared with the notification bell).
 */
import type { ReportDiff } from "./report-types";

// Verdict ordering (worst → best) — MIRRORS app/reports/differ.py::_VERDICT_RANK. Keep in sync.
const VRANK: Record<string, number> = { avoid: 0, watch: 1, arm: 2, take_small: 3, take: 4 };
const isTake = (v?: string | null): boolean => v === "take" || v === "take_small";

export type MergedKind =
	| "new_take" | "lost_take" | "promotion" | "demotion" | "new" | "dropped" | "changed";

export interface MergedSymbol {
	symbol: string;
	kind: MergedKind;
	verdictFrom?: string | null; // state at `since` (or last verdict before it dropped)
	verdictTo?: string | null; // state now
	reason?: string; // for new / dropped
	runs: number; // how many runs in the window touched this symbol materially
	resolved: string[]; // confirmation items satisfied across the window
	triggerCrossed: boolean;
	thesisExpired: boolean;
	planMoved: boolean;
}

export interface MergedHighlight {
	kind: MergedKind;
	symbol: string;
	text: string;
}

export interface MergedSince {
	since: string; // the acknowledged boundary
	fromAt: string; // earliest unseen run
	toAt: string; // latest run
	runs: number; // # unseen runs
	material: boolean;
	newTakes: string[];
	lostTakes: string[];
	promotions: string[];
	demotions: string[];
	newSymbols: string[];
	droppedSymbols: string[];
	symbols: MergedSymbol[]; // ranked, most important first
	highlights: MergedHighlight[]; // ranked trader's-log lines, capped
}

const KIND_ORDER: Record<MergedKind, number> = {
	new_take: 1, lost_take: 2, promotion: 3, demotion: 4, new: 8, dropped: 9, changed: 11,
};

interface Acc {
	firstFrom: string | null | undefined; // verdict just before the first change in the window
	last: string | null | undefined; // running absolute verdict
	enteredNew: boolean;
	droppedLast: boolean;
	droppedFrom: string | null | undefined;
	reason?: string;
	runs: number;
	resolved: string[];
	trigger: boolean;
	thesis: boolean;
	plan: boolean;
	verdictChanged: boolean;
}

/**
 * Compose diffs (any order) newer than `since` into a single net view, or null when there's nothing
 * unseen (or no boundary yet — a first-ever visit must NOT render "everything since forever").
 */
export function mergeSince(diffs: ReportDiff[], since: string | null): MergedSince | null {
	if (!since) return null;
	const window = diffs
		.filter((d) => d.generated_at > since)
		.sort((a, b) => a.generated_at.localeCompare(b.generated_at)); // oldest → newest
	if (window.length === 0) return null;

	const acc = new Map<string, Acc>();
	const touch = (sym: string): Acc => {
		let a = acc.get(sym);
		if (!a) {
			a = {
				firstFrom: undefined, last: undefined, enteredNew: false, droppedLast: false,
				droppedFrom: undefined, runs: 0, resolved: [], trigger: false, thesis: false,
				plan: false, verdictChanged: false,
			};
			acc.set(sym, a);
		}
		return a;
	};

	for (const d of window) {
		for (const [sym, s] of Object.entries(d.symbols)) {
			if (s.status === "unchanged") continue;
			const a = touch(sym);
			a.runs++;
			if (s.status === "new") {
				a.enteredNew = true;
				a.droppedLast = false;
				a.last = s.snapshot?.verdict ?? s.verdict?.to ?? a.last ?? null;
				if (s.reason) a.reason = s.reason;
			} else if (s.status === "dropped") {
				a.droppedLast = true;
				a.droppedFrom = s.last?.verdict ?? a.last ?? null;
				if (s.reason) a.reason = s.reason;
				a.last = null;
			} else {
				// changed
				a.droppedLast = false;
				if (a.firstFrom === undefined && s.verdict?.from !== undefined) a.firstFrom = s.verdict.from ?? null;
				if (s.verdict?.to != null) {
					a.last = s.verdict.to;
					a.verdictChanged = true;
				}
				if (s.confirmation?.resolved?.length) a.resolved.push(...s.confirmation.resolved);
				if (s.derived?.trigger_crossed) a.trigger = true;
				if (s.thesis_expired?.to) a.thesis = true;
				if (s.plan?.moved) a.plan = true;
			}
		}
	}

	const symbols: MergedSymbol[] = [];
	for (const [symbol, a] of acc) {
		const base = {
			symbol, runs: a.runs, resolved: [...new Set(a.resolved)],
			triggerCrossed: a.trigger, thesisExpired: a.thesis, planMoved: a.plan,
		};
		if (a.droppedLast) {
			const from = a.droppedFrom ?? null;
			symbols.push({ ...base, kind: isTake(from) ? "lost_take" : "dropped", verdictFrom: from, reason: a.reason });
			continue;
		}
		if (a.enteredNew) {
			const to = a.last ?? null;
			symbols.push({ ...base, kind: isTake(to) ? "new_take" : "new", verdictTo: to, reason: a.reason });
			continue;
		}
		// persisted throughout the window — net verdict move from firstFrom → last
		const from = a.firstFrom ?? null;
		const to = a.last ?? null;
		if (from != null && to != null && from !== to) {
			let kind: MergedKind;
			if (isTake(to) && !isTake(from)) kind = "new_take";
			else if (isTake(from) && !isTake(to)) kind = "lost_take";
			else kind = (VRANK[to] ?? -1) > (VRANK[from] ?? -1) ? "promotion" : "demotion";
			symbols.push({ ...base, kind, verdictFrom: from, verdictTo: to });
		} else if (a.trigger || a.thesis || a.plan || base.resolved.length) {
			// Net verdict unchanged (or only a wiggle that returned), but a genuine event still occurred.
			symbols.push({ ...base, kind: "changed", verdictFrom: from, verdictTo: to });
		}
		// else: net nothing — suppressed (this is the whole point of the merge)
	}

	symbols.sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || x.symbol.localeCompare(y.symbol));

	const of = (k: MergedKind) => symbols.filter((s) => s.kind === k).map((s) => s.symbol);
	const highlights = symbols.map((s) => ({ kind: s.kind, symbol: s.symbol, text: lineFor(s) })).slice(0, 15);

	return {
		since,
		fromAt: window[0].generated_at,
		toAt: window[window.length - 1].generated_at,
		runs: window.length,
		material: symbols.length > 0,
		newTakes: of("new_take"),
		lostTakes: of("lost_take"),
		promotions: of("promotion"),
		demotions: of("demotion"),
		newSymbols: of("new"),
		droppedSymbols: of("dropped"),
		symbols,
		highlights,
	};
}

const up = (v?: string | null) => (v ? v.replace(/_/g, " ").toUpperCase() : "—");

function lineFor(s: MergedSymbol): string {
	switch (s.kind) {
		case "new_take":
			return s.verdictTo != null && s.reason
				? `${s.symbol} — new candidate, straight to TAKE`
				: `${s.symbol} became TAKE`;
		case "lost_take":
			return s.reason ? `${s.symbol} lost its TAKE (${s.reason.replace(/_/g, " ")})` : `${s.symbol} lost its TAKE`;
		case "promotion":
			return `${s.symbol} promoted ${up(s.verdictFrom)} → ${up(s.verdictTo)}`;
		case "demotion":
			return `${s.symbol} demoted ${up(s.verdictFrom)} → ${up(s.verdictTo)}`;
		case "new":
			return `${s.symbol} — new candidate (${up(s.verdictTo)})`;
		case "dropped":
			return s.reason ? `${s.symbol} — dropped (${s.reason.replace(/_/g, " ")})` : `${s.symbol} — dropped`;
		default: {
			const bits: string[] = [];
			if (s.triggerCrossed) bits.push("trigger crossed");
			if (s.thesisExpired) bits.push("thesis expired");
			if (s.planMoved) bits.push("plan re-anchored");
			if (s.resolved.length) bits.push(`confirmation: ${s.resolved[0]}`);
			return `${s.symbol} — ${bits.join(", ") || "changed"}`;
		}
	}
}
