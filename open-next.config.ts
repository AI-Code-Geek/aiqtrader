import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
	// Serve prerendered SSG pages (/app/[scheduleId], /app/[scheduleId]/[symbol]) from the deployed
	// static ASSETS binding. Without an incrementalCache, those pages 404 with `NoFallbackError` at
	// runtime. This override is the free-tier choice — no R2/KV — and is correct here because the app
	// is purely prerendered (reports are baked at build; no ISR/revalidation).
	incrementalCache: staticAssetsIncrementalCache,
});
