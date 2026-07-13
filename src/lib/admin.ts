/**
 * Admin authorization. Server-only.
 *
 * An admin is a logged-in user (valid session cookie) who is on the admin allowlist. The allowlist is
 * configured in the environment (Cloudflare Pages/Workers env or local .env.local) so you never have to
 * edit code to grant admin:
 *   - ADMIN_KEYS      — comma-separated admin subscription codes. Primary. Any ONE match grants admin.
 *   - ADMIN_KEY       — singular alias, merged with ADMIN_KEYS.
 *   - ADMIN_CODES     — extra codes (comma-separated), merged too.
 *   - ADMIN_USER_IDS  — comma-separated userids (e.g. "u_eca14b")
 * A user record may also carry `role: "admin"` in KV. Any of these grants admin.
 *
 * Local convenience: outside production, if NO admin env var is set, a small built-in allowlist is used
 * so the admin page works on `next dev` without configuration. In production you MUST set ADMIN_KEYS.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readSession } from "./auth-server";
import { getUserById } from "./user-store";
import type { UserRecord } from "./user-types";

const isProd = () => process.env.NODE_ENV === "production";

/**
 * Local-dev fallback admin (used ONLY outside production, and only when no ADMIN_* env is set).
 * Deliberately just the public demo code — never a real subscriber/admin code, which must not live in a
 * committed file. Your real admin code goes in `ADMIN_KEYS` (.env.local locally, Cloudflare env in prod).
 */
const DEV_ADMIN_CODES = ["AIQ-DEMO-2026"];

function env(name: string): string | undefined {
	let v: string | undefined;
	try {
		v = (getCloudflareContext().env as unknown as Record<string, string | undefined>)[name];
	} catch {
		// no CF context (build phases / plain node) — fall through to process.env
	}
	return v ?? process.env[name];
}

function csv(name: string): string[] {
	return (env(name) ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isAdmin(user: UserRecord | null | undefined): boolean {
	if (!user) return false;
	if ((user as { role?: unknown }).role === "admin") return true;
	// ADMIN_KEYS (comma-separated) is primary; ADMIN_KEY (singular) + ADMIN_CODES are merged. Any match wins.
	let codes = [...csv("ADMIN_KEYS"), ...csv("ADMIN_KEY"), ...csv("ADMIN_CODES")].map((c) => c.toUpperCase());
	const ids = csv("ADMIN_USER_IDS");
	if (codes.length === 0 && ids.length === 0 && !isProd()) codes = DEV_ADMIN_CODES.map((c) => c.toUpperCase());
	if (user.code && codes.includes(user.code.toUpperCase())) return true;
	if (ids.includes(user.userid)) return true;
	return false;
}

/** The current admin user, or null if there is no valid session or the user isn't an admin. */
export async function readAdmin(): Promise<UserRecord | null> {
	const session = await readSession();
	if (!session) return null;
	const user = await getUserById(session.userid);
	return isAdmin(user) ? user : null;
}
