/**
 * Mirror committed report data (data/reports/**) into public/reports/** so it is
 * served as static assets on Cloudflare (free tier, no R2/KV needed for report blobs).
 * Runs automatically via the `predev` / `prebuild` npm scripts.
 */
import { cp, rm, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "data", "reports");
const dest = join(root, "public", "reports");

async function main() {
	try {
		await stat(src);
	} catch {
		console.warn(`[sync-reports] no source at ${src} — skipping`);
		return;
	}
	await rm(dest, { recursive: true, force: true });
	await mkdir(dest, { recursive: true });
	await cp(src, dest, { recursive: true });
	console.log(`[sync-reports] copied ${src} -> ${dest}`);
}

main().catch((err) => {
	console.error("[sync-reports] failed:", err);
	process.exit(1);
});
