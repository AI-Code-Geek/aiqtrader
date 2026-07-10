/**
 * Read layer for committed report data (data/reports/**). Free-tier design: no R2/KV for report
 * blobs. These fs reads run at BUILD time (SSG / generateStaticParams) — the Cloudflare Worker has no
 * fs at runtime, so pages that call these must be statically generated. Client-side run-switching
 * fetches the same files as static assets from /reports/** instead.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Report, ReportIndex } from "./report-types";
import { SCHEDULE_IDS } from "./reports-manifest";

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
