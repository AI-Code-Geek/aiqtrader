/**
 * Lightweight per-IP rate limiter backed by Cloudflare KV. Server-only.
 *
 * Fixed-window counter: each recorded attempt increments `rl:<bucket>:<id>` with a TTL = the window, so
 * the count auto-expires. Used to throttle/lock out brute-force and spam on public POST routes (redeem,
 * access-requests, feedback). Defense-in-depth: if no KV binding is present it fails OPEN (never blocks a
 * legitimate request just because the limiter store is unavailable). Pair with a Cloudflare WAF
 * Rate-Limiting Rule for a hard edge cap.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

function kv(): KVNamespace | undefined {
	try {
		return getCloudflareContext().env.KV;
	} catch {
		return undefined;
	}
}

/** The real client IP on Cloudflare. Never trust X-Forwarded-For (client-settable). */
export function clientIp(req: Request): string {
	return req.headers.get("CF-Connecting-IP") || req.headers.get("x-real-ip") || "unknown";
}

const key = (bucket: string, id: string) => `rl:${bucket}:${id}`;

/** True if `id` has reached `max` recorded attempts in the current window. */
export async function isRateLimited(bucket: string, id: string, max: number): Promise<boolean> {
	const store = kv();
	if (!store) return false;
	const n = Number((await store.get(key(bucket, id))) ?? 0);
	return n >= max;
}

/** Record one attempt; the counter auto-expires after `windowSec` (KV min TTL is 60s). */
export async function recordAttempt(bucket: string, id: string, windowSec: number): Promise<void> {
	const store = kv();
	if (!store) return;
	const k = key(bucket, id);
	const n = Number((await store.get(k)) ?? 0) + 1;
	await store.put(k, String(n), { expirationTtl: Math.max(60, windowSec) });
}

/** Reset the counter (e.g. on a successful login). */
export async function clearAttempts(bucket: string, id: string): Promise<void> {
	const store = kv();
	if (!store) return;
	await store.delete(key(bucket, id));
}
