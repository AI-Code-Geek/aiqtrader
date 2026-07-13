/**
 * Read layer for committed report data (data/reports/**). Free-tier design: no R2/KV for report
 * blobs. These fs reads run at BUILD time (SSG / generateStaticParams) — the Cloudflare Worker has no
 * fs at runtime, so pages that call these must be statically generated. Client-side run-switching
 * fetches the same files as static assets from /reports/** instead.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiReport, Report, ReportIndex } from "./report-types";
import type { ScheduleMeta, WatchlistMeta } from "./manifest-types";
import { SCHEDULE_IDS, SCHEDULES, WATCHLISTS } from "./reports-manifest";

const REPORTS_DIR = join(process.cwd(), "data", "reports");

export interface ScheduleSummary {
	id: string;
	name: string;
	persona: string;
	updated_at: string;
	latestVersion: string;
	candidate_count: number;
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf-8")) as T;
}

/**
 * Every schedule folder under data/reports (e.g. "001-watchlist-1").
 * Reads the BUILD-GENERATED manifest (scripts/sync-reports.mjs) rather than the filesystem, so this
 * is safe to call at runtime on the Worker (which has no fs) — e.g. the `/app` redirect.
 */
export async function listScheduleIds(): Promise<string[]> {
	return SCHEDULE_IDS;
}

export async function getIndex(scheduleId: string): Promise<ReportIndex> {
	return readJson<ReportIndex>(join(REPORTS_DIR, scheduleId, "index.json"));
}

export async function listSchedules(): Promise<ScheduleSummary[]> {
	const ids = await listScheduleIds();
	return Promise.all(
		ids.map(async (id) => {
			const idx = await getIndex(id);
			const latest = idx.versions[0];
			return {
				id,
				name: idx.name,
				persona: idx.persona,
				updated_at: idx.updated_at,
				latestVersion: latest?.version ?? "latest",
				candidate_count: latest?.candidate_count ?? 0,
			};
		}),
	);
}

/**
 * Load one run. `version` defaults to "latest" (reads latest.json). A concrete version reads
 * <version>.json. Throws if the schedule/version is missing.
 */
export async function getReport(scheduleId: string, version = "latest"): Promise<Report> {
	const file = version === "latest" ? "latest.json" : `${version}.json`;
	return readJson<Report>(join(REPORTS_DIR, scheduleId, file));
}

/**
 * Load the AI Brain extension for a run, or `null` if that run has none. The AI file is a sibling
 * named `<report_version>.ai.json` (there is no `latest.ai.json`), so pass the run's *report_version*
 * — resolve "latest" to its report_version first. Build-time fs read; client run-switching fetches the
 * same file as a static asset from `/reports/<slug>/<version>.ai.json`.
 */
export async function getAiReport(scheduleId: string, reportVersion: string): Promise<AiReport | null> {
	try {
		return await readJson<AiReport>(join(REPORTS_DIR, scheduleId, `${reportVersion}.ai.json`));
	} catch {
		return null; // most runs have no AI extension yet
	}
}

/**
 * Trim a full report down to a SINGLE symbol's slice for the symbol-detail page. The page only needs
 * this symbol's decision, analysis and charts (plus the small shared blocks), so we drop every other
 * symbol's decisions/analysis/OHLCV charts and the candidate list — the heavy parts. This shrinks the
 * SSR/hydration payload dramatically (often ~80-90% for a multi-symbol watchlist). SymbolDetailClient
 * indexes everything by symbol, so it works unchanged; run-switching still lazily fetches the full
 * `<version>.json` on demand.
 */
/**
 * Trim a full report for the DASHBOARD. The dashboard renders only the candidate list + data-health +
 * tape/universe headers — it never reads `charts`, `decisions` or `analysis` (verified against
 * DashboardClient). Those are the heavy parts (every symbol's OHLCV bars), so dropping them takes a
 * multi-MB RSC payload down to a few hundred KB. Run-switching still lazily fetches the full
 * `<version>.json` client-side when the user picks an archived run.
 */
export function sliceReportForDashboard(report: Report): Report {
	return {
		...report,
		decisions: {},
		analysis: undefined,
		charts: {},
	};
}

export function sliceReportForSymbol(report: Report, symbol: string): Report {
	return {
		...report,
		candidates: [],
		decisions: report.decisions?.[symbol] ? { [symbol]: report.decisions[symbol] } : {},
		analysis: report.analysis?.[symbol] ? { [symbol]: report.analysis[symbol] } : undefined,
		charts: report.charts?.[symbol] ? { [symbol]: report.charts[symbol] } : {},
	};
}

// ── Watchlist layer ──────────────────────────────────────────────────────────────────────────────
// The dashboard is organized by WATCHLIST (universe.watchlist_id), not by the scheduler that produced
// the reports. A watchlist is fed by one or more schedules (usually one per persona). These helpers
// resolve a watchlist slug → the underlying schedule(s) + runs, reusing the schedule-level loaders.

/** All watchlists (build manifest). Safe at runtime — no fs. */
export function listWatchlists(): WatchlistMeta[] {
	return WATCHLISTS;
}

export function getWatchlist(slug: string): WatchlistMeta | undefined {
	return WATCHLISTS.find((w) => w.slug === slug);
}

/** Schedule metadata for every schedule feeding a watchlist. */
export function watchlistSchedules(slug: string): ScheduleMeta[] {
	const w = getWatchlist(slug);
	if (!w) return [];
	return SCHEDULES.filter((s) => w.schedules.includes(s.id));
}

/**
 * Pick the schedule to load for a watchlist. With one persona this is the only schedule; with several
 * it defaults to the newest-updated (optionally filtered by `persona`).
 */
export function resolveSchedule(slug: string, persona?: string): ScheduleMeta | undefined {
	const scheds = watchlistSchedules(slug).filter((s) => !persona || s.persona === persona);
	if (scheds.length === 0) return undefined;
	return [...scheds].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
}

export interface WatchlistReportRow {
	version: string;
	scheduleId: string;
	persona: string;
	generated_at: string;
	candidate_count: number;
	status: string;
	hasAi: boolean;
}

/** The full report history for a watchlist, aggregated across its schedules, newest-first. Build-time. */
export async function getWatchlistReports(slug: string): Promise<WatchlistReportRow[]> {
	const scheds = watchlistSchedules(slug);
	const rows: WatchlistReportRow[] = [];
	for (const s of scheds) {
		const idx = await getIndex(s.id);
		for (const v of idx.versions) {
			rows.push({
				version: v.version,
				scheduleId: s.id,
				persona: s.persona,
				generated_at: v.generated_at,
				candidate_count: v.candidate_count,
				status: v.status,
				hasAi: s.ai_versions.includes(v.version),
			});
		}
	}
	return rows.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

/**
 * Load one watchlist run (technical + AI, if present) plus the resolved scheduleId (needed for
 * client-side run-switching, which fetches /reports/<scheduleId>/<version>.json). `version` defaults
 * to the watchlist's latest run.
 */
export async function getWatchlistReport(
	slug: string,
	version = "latest",
	persona?: string,
): Promise<{ scheduleId: string; report: Report; ai: AiReport | null; index: ReportIndex }> {
	const sched = resolveSchedule(slug, persona);
	if (!sched) throw new Error(`no schedule for watchlist ${slug}`);
	const [index, report] = await Promise.all([getIndex(sched.id), getReport(sched.id, version)]);
	const ai = await getAiReport(sched.id, report.report_version);
	return { scheduleId: sched.id, report, ai, index };
}
