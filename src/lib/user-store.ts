/**
 * KV-backed user store (DEVPLAN §3–§4). Server-only — imported by route handlers.
 *
 * Key layout:
 *   `<userid>`            -> UserRecord JSON  (the KV key IS the userid)
 *   `idx:code:<CODE>`     -> "<userid>"       (secondary index for redeem-by-code)
 *
 * Reports are NOT stored here (they stay as committed static files); KV holds only small user records.
 * For zero-config local dev, if the KV namespace is empty we auto-seed a few demo users so the login
 * flow is testable without `wrangler kv key put`. Seeding is skipped in production.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UserRecord } from "./user-types";

export const codeIndexKey = (code: string) => `idx:code:${code.trim().toUpperCase()}`;

/** Demo users seeded into a fresh/empty KV in non-production. Codes are case-insensitive on redeem. */
const DEMO_USERS: UserRecord[] = [
	{
		userid: "u_demo",
		name: "Demo Trader",
		email: "demo@aiqtrader.app",
		code: "AIQ-DEMO-2026",
		status: "active",
		validity: null,
		tier: "pro",
		schedules: [1],
		myList: [],
	},
	{
		userid: "u_free",
		name: "Free Tier",
		email: "free@aiqtrader.app",
		code: "AIQ-FREE-0001",
		status: "active",
		validity: null,
		tier: "free",
		schedules: [1],
		myList: [],
	},
	{
		userid: "u_expired",
		name: "Lapsed Sub",
		email: "expired@aiqtrader.app",
		code: "AIQ-EXP-0002",
		status: "active",
		validity: "2020-01-01T00:00:00Z", // past validity → rejected on redeem
		tier: "pro",
		schedules: [1],
		myList: [],
	},
	{
		userid: "u_suspended",
		name: "Suspended",
		email: "suspended@aiqtrader.app",
		code: "AIQ-SUSP-0003",
		status: "suspended", // → rejected on redeem
		validity: null,
		tier: "pro",
		schedules: [1],
		myList: [],
	},
	// Real subscribers — mirror of scripts/users.seed.json (that file provisions production KV via
	// `node scripts/seed-users.mjs`; these entries make them usable in local `next dev` too).
	{
		userid: "u_c95d00",
		name: "Venkat",
		email: "venkat@aiqtrader.app",
		code: "AIQ-6VHZ-ZAEJ",
		status: "active",
		validity: null,
		tier: "pro",
		schedules: [1],
		myList: [],
	},
	{
		userid: "u_90c3dc",
		name: "Sai",
		email: "sai@aiqtrader.app",
		code: "AIQ-59D4-7776",
		status: "active",
		validity: null,
		tier: "pro",
		schedules: [1],
		myList: [],
	},
	{
		userid: "u_12920a",
		name: "Hari",
		email: "hari@aiqtrader.app",
		code: "AIQ-9DQY-PQHF",
		status: "active",
		validity: null,
		tier: "pro",
		schedules: [1],
		myList: [],
	},
	{
		userid: "u_eca14b",
		name: "Nagul",
		email: "nagul@aiqtrader.app",
		code: "AIQ-9K5U-EXH6",
		status: "active",
		validity: null,
		tier: "pro",
		schedules: [1],
		myList: [],
	},
];

function getKV(): KVNamespace | undefined {
	try {
		return getCloudflareContext().env.KV;
	} catch {
		return undefined;
	}
}

/** Seed demo users into an empty KV, once, outside production. No-op if KV missing or already seeded. */
async function ensureSeed(kv: KVNamespace): Promise<void> {
	if (process.env.NODE_ENV === "production") return;
	const seeded = await kv.get("idx:seeded");
	if (seeded) return;
	await Promise.all(
		DEMO_USERS.flatMap((u) => [
			kv.put(u.userid, JSON.stringify(u)),
			kv.put(codeIndexKey(u.code), u.userid),
		]),
	);
	await kv.put("idx:seeded", new Date().toISOString());
}

export async function getUserById(userid: string): Promise<UserRecord | null> {
	const kv = getKV();
	if (!kv) return DEMO_USERS.find((u) => u.userid === userid) ?? null;
	await ensureSeed(kv);
	return kv.get<UserRecord>(userid, "json");
}

export async function getUserByCode(code: string): Promise<UserRecord | null> {
	const kv = getKV();
	if (!kv) return DEMO_USERS.find((u) => u.code.toUpperCase() === code.trim().toUpperCase()) ?? null;
	await ensureSeed(kv);
	const userid = await kv.get(codeIndexKey(code));
	if (!userid) return null;
	return kv.get<UserRecord>(userid, "json");
}

/** Persist a mutated user record. Rewrites the small object (My List updates, status changes, …). */
export async function putUser(user: UserRecord): Promise<void> {
	const kv = getKV();
	if (!kv) {
		const i = DEMO_USERS.findIndex((u) => u.userid === user.userid);
		if (i >= 0) DEMO_USERS[i] = user; // in-memory only (no KV binding present)
		return;
	}
	await kv.put(user.userid, JSON.stringify(user));
}

/** Fields safe to hand back to the client (strip nothing sensitive today, but a single seam for it). */
export function publicUser(u: UserRecord): UserRecord {
	return u;
}
