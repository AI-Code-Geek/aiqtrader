/**
 * New-report notifications. Client-side only.
 *
 * Feed: the STATIC file `/reports/manifest.json` (emitted by scripts/sync-reports.mjs) — one entry per
 * watchlist with its latest run. Reports publish as static assets, so a new report shows up there as
 * soon as it's deployed; the bell polls it so an open tab notices without a reload.
 *
 * Read/unread state is PER-ACCOUNT: the source of truth is `user.seenReports` in the KV record
 * (`PATCH /api/seen-reports`), so notifications stay in sync across devices. localStorage is only a
 * mirror for instant paint before `/api/me` returns — same pattern as My List.
 */
"use client";

import { fetchMe, saveSeenReports } from "./api-client";

export interface FeedEntry {
	slug: string;
	name: string;
	persona: string;
	version: string;
	generated_at: string;
	candidate_count: number;
	hasAi: boolean;
}

export interface ReportsFeed {
	generated_at: string;
	watchlists: FeedEntry[];
}

/** watchlist slug -> generated_at of the newest run this user has seen. */
export type SeenMap = Record<string, string>;

/**
 * localStorage mirror of `user.seenReports` (instant paint only — NOT the source of truth).
 * Keyed PER USERID: if two accounts use the same browser, the second must not inherit the first's
 * read-state (and must still be detected as a brand-new account so it gets seeded, not spammed).
 */
const mirrorKey = (userid: string) => `aiq_seen_reports:${userid}`;

/** Set by loadSeen() so persistSeen() writes the mirror under the right account. */
let currentUserId: string | null = null;

function readMirror(userid: string): SeenMap | null {
	try {
		const raw = localStorage.getItem(mirrorKey(userid));
		return raw ? (JSON.parse(raw) as SeenMap) : null;
	} catch {
		return null;
	}
}

function writeMirror(userid: string, map: SeenMap): void {
	try {
		localStorage.setItem(mirrorKey(userid), JSON.stringify(map));
	} catch {
		/* storage unavailable */
	}
}

/** Merge two seen-maps keeping the LATER timestamp per watchlist (device races can't un-read a report). */
export function mergeSeen(a: SeenMap, b: SeenMap): SeenMap {
	const out: SeenMap = { ...a };
	for (const [slug, ts] of Object.entries(b)) {
		if (!out[slug] || ts > out[slug]) out[slug] = ts;
	}
	return out;
}

/**
 * Load the account's seen-map: instant from the mirror, then reconciled with server truth (/api/me).
 * Returns `{ seen, isNew }` — `isNew` is true when this ACCOUNT has no seen-state yet (first ever load),
 * so the caller can seed everything as read instead of screaming "N new reports" at a new user.
 */
export async function loadSeen(): Promise<{ seen: SeenMap; isNew: boolean }> {
	const me = await fetchMe();
	if (!me) return { seen: {}, isNew: false }; // signed out — nothing to notify about
	currentUserId = me.userid;

	const server = (me.seenReports ?? null) as SeenMap | null;
	const mirror = readMirror(me.userid); // per-account: another user's mirror can't leak in

	// Brand-new account (no state anywhere) → caller seeds everything as read instead of spamming.
	if (!server && !mirror) return { seen: {}, isNew: true };

	const seen = mergeSeen(server ?? {}, mirror ?? {});
	writeMirror(me.userid, seen);
	return { seen, isNew: false };
}

/** Persist a seen-map: mirror locally for instant paint, then merge into the KV record (cross-device). */
export async function persistSeen(seen: SeenMap): Promise<void> {
	if (currentUserId) writeMirror(currentUserId, seen);
	await saveSeenReports(seen).catch(() => null);
}

/** Entries whose latest run is newer than what this account has seen, newest first. */
export function unseen(entries: FeedEntry[], seen: SeenMap): FeedEntry[] {
	return entries
		.filter((e) => !seen[e.slug] || e.generated_at > seen[e.slug])
		.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

/** A seen-map that marks every entry in the feed as read. */
export function seenAll(entries: FeedEntry[]): SeenMap {
	return Object.fromEntries(entries.map((e) => [e.slug, e.generated_at]));
}

/** Fetch the static feed. `no-store` so a live tab sees a freshly published report. */
export async function fetchFeed(): Promise<ReportsFeed | null> {
	try {
		const res = await fetch("/reports/manifest.json", { cache: "no-store" });
		if (!res.ok) return null;
		return (await res.json()) as ReportsFeed;
	} catch {
		return null;
	}
}
