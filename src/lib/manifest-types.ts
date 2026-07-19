/**
 * Stable types for the build-generated report manifest (src/lib/reports-manifest.ts).
 * The manifest data is emitted by scripts/sync-reports.mjs; these interfaces are hand-maintained so
 * the generated file stays data-only. A "watchlist" is the organizing unit (universe.watchlist_id);
 * a "schedule" is just the producer that pushes reports for it.
 */

/** One schedule folder under data/reports/** (e.g. "001-watchlist-1"), enriched with the watchlist it targets. */
export interface ScheduleMeta {
	/** Folder id / slug under data/reports. */
	id: string;
	schedule_id: number;
	name: string;
	persona: string;
	/** From the run's universe — the watchlist this schedule pushes reports for. */
	watchlist_id: number;
	watchlist_name: string;
	updated_at: string;
	version_count: number;
	latest_version: string | null;
	latest_generated_at: string | null;
	latest_candidate_count: number;
	/** report_versions that have a sibling <version>.ai.json (AI Brain extension). */
	ai_versions: string[];
	/** report_versions that have a sibling <version>.diff.json (run-to-run diff, P9). Newest-first. */
	diff_versions: string[];
	/** report_versions that have a sibling <version>.outcome.json (report card, P11). Newest-first. */
	outcome_versions?: string[];
}

/** A watchlist (universe.watchlist_id) with the schedule(s) that feed it. The dashboard's top nav unit. */
export interface WatchlistMeta {
	watchlist_id: number;
	name: string;
	/** URL param — String(watchlist_id). */
	slug: string;
	/** Schedule folder ids that push reports for this watchlist (one per persona, usually). */
	schedules: string[];
	personas: string[];
	updated_at: string;
	report_count: number;
	latest: {
		scheduleId: string;
		version: string;
		generated_at: string;
		persona: string;
		candidate_count: number;
		hasAi: boolean;
	} | null;
}
