/**
 * KV-backed user store (DEVPLAN §3–§4). Server-only — imported by route handlers.
 *
 * Key layout:
 *   `<userid>`            -> UserRecord JSON  (the KV key IS the userid)
 *   `idx:code:<CODE>`     -> "<userid>"       (secondary index for redeem-by-code)
 *
 * Reports are NOT stored here (they stay as committed static files); KV holds only small user records.
 *
 * Seeding: if the KV namespace hasn't been seeded (no `idx:seeded:<ver>` marker) we lazily write the
 * seed users on first access. Real SUBSCRIBERS are seeded in EVERY environment (including production)
 * so the deployed app works without a manual `wrangler kv key put`. The DEV_USERS (demo/test accounts,
 * whose codes are public in this repo) are seeded ONLY outside production — otherwise anyone could log
 * in with a well-known demo code. Bump SEED_VERSION to force a re-seed after editing the sets.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UserRecord, AccessRequest } from "./user-types";

export const codeIndexKey = (code: string) => `idx:code:${code.trim().toUpperCase()}`;
const reqKey = (id: string) => `req:${id}`;
const REQ_INDEX = "idx:reqs";

/** Bump when SUBSCRIBERS/DEV_USERS change so an already-seeded namespace re-seeds once. */
const SEED_VERSION = "v2";

/** Real subscribers — mirror of scripts/users.seed.json. Seeded in ALL environments. */
const SUBSCRIBERS: UserRecord[] = [
	{ userid: "u_c95d00", name: "Venkat", email: "venkat@aiqtrader.app", code: "AIQ-6VHZ-ZAEJ", status: "active", validity: null, tier: "pro", schedules: [1], myList: [] },
	{ userid: "u_90c3dc", name: "Sai", email: "sai@aiqtrader.app", code: "AIQ-59D4-7776", status: "active", validity: null, tier: "pro", schedules: [1], myList: [] },
	{ userid: "u_12920a", name: "Hari", email: "hari@aiqtrader.app", code: "AIQ-9DQY-PQHF", status: "active", validity: null, tier: "pro", schedules: [1], myList: [] },
	{ userid: "u_eca14b", name: "Nagul", email: "nagul@aiqtrader.app", code: "AIQ-9K5U-EXH6", status: "active", validity: null, tier: "pro", schedules: [1], myList: [] },
];

/** Demo/test accounts. Codes are public in the repo → seeded ONLY outside production. */
const DEV_USERS: UserRecord[] = [
	{ userid: "u_demo", name: "Demo Trader", email: "demo@aiqtrader.app", code: "AIQ-DEMO-2026", status: "active", validity: null, tier: "pro", schedules: [1], myList: [] },
	{ userid: "u_free", name: "Free Tier", email: "free@aiqtrader.app", code: "AIQ-FREE-0001", status: "active", validity: null, tier: "free", schedules: [1], myList: [] },
	{ userid: "u_expired", name: "Lapsed Sub", email: "expired@aiqtrader.app", code: "AIQ-EXP-0002", status: "active", validity: "2020-01-01T00:00:00Z", tier: "pro", schedules: [1], myList: [] },
	{ userid: "u_suspended", name: "Suspended", email: "suspended@aiqtrader.app", code: "AIQ-SUSP-0003", status: "suspended", validity: null, tier: "pro", schedules: [1], myList: [] },
];

const isProd = () => process.env.NODE_ENV === "production";

/** Users seeded for the current environment. */
const seedUsers = (): UserRecord[] => (isProd() ? SUBSCRIBERS : [...SUBSCRIBERS, ...DEV_USERS]);

/**
 * Local fallback set when no KV binding is present (local `next dev` without miniflare KV).
 *
 * The authoritative local store is the FILE `scripts/users.seed.json` — so codes minted with
 * scripts/mint-code.mjs (which append to that file) validate locally without editing this module.
 * We read it lazily via a dynamic import (keeps `node:fs` out of the Cloudflare Worker's static graph;
 * this branch never runs in production, which always has KV). Falls back to the compiled SUBSCRIBERS
 * mirror if the file can't be read. DEV_USERS (demo codes) are added on top in non-prod, matching KV seeding.
 */
let _localUsers: UserRecord[] | null = null;

async function localUsers(): Promise<UserRecord[]> {
	if (_localUsers) return _localUsers;
	let fromFile: UserRecord[] = SUBSCRIBERS;
	try {
		const { readFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const raw = await readFile(join(process.cwd(), "scripts", "users.seed.json"), "utf-8");
		fromFile = JSON.parse(raw) as UserRecord[];
	} catch {
		// file missing/unreadable → keep the compiled mirror
	}
	// De-dupe by userid (file wins), then add demo accounts outside production.
	const byId = new Map(fromFile.map((u) => [u.userid, u]));
	const extras = isProd() ? [] : DEV_USERS;
	for (const u of extras) if (!byId.has(u.userid)) byId.set(u.userid, u);
	_localUsers = [...byId.values()];
	return _localUsers;
}

function getKV(): KVNamespace | undefined {
	try {
		return getCloudflareContext().env.KV;
	} catch {
		return undefined;
	}
}

/** Seed the environment's users into KV once (guarded by a versioned marker). Idempotent. */
async function ensureSeed(kv: KVNamespace): Promise<void> {
	const marker = `idx:seeded:${SEED_VERSION}`;
	if (await kv.get(marker)) return;
	await Promise.all(
		seedUsers().flatMap((u) => [kv.put(u.userid, JSON.stringify(u)), kv.put(codeIndexKey(u.code), u.userid)]),
	);
	await kv.put(marker, new Date().toISOString());
}

export async function getUserById(userid: string): Promise<UserRecord | null> {
	const kv = getKV();
	if (!kv) return (await localUsers()).find((u) => u.userid === userid) ?? null;
	await ensureSeed(kv);
	// KV is eventually consistent — right after a seed the read can miss; fall back to the seed set.
	return (await kv.get<UserRecord>(userid, "json")) ?? seedUsers().find((u) => u.userid === userid) ?? null;
}

export async function getUserByCode(code: string): Promise<UserRecord | null> {
	const kv = getKV();
	const bySeed = () => seedUsers().find((u) => u.code.toUpperCase() === code.trim().toUpperCase()) ?? null;
	if (!kv) return (await localUsers()).find((u) => u.code.toUpperCase() === code.trim().toUpperCase()) ?? null;
	await ensureSeed(kv);
	const userid = await kv.get(codeIndexKey(code));
	if (!userid) return bySeed(); // index not yet propagated after seeding
	return (await kv.get<UserRecord>(userid, "json")) ?? bySeed();
}

/** Persist a mutated user record. Rewrites the small object (My List updates, status changes, …). */
export async function putUser(user: UserRecord): Promise<void> {
	const kv = getKV();
	if (!kv) {
		const list = await localUsers();
		const i = list.findIndex((u) => u.userid === user.userid);
		if (i >= 0) list[i] = user; // in-memory only (no KV binding present); not written back to the file
		return;
	}
	await kv.put(user.userid, JSON.stringify(user));
}

/** Fields safe to hand back to the client (strip nothing sensitive today, but a single seam for it). */
export function publicUser(u: UserRecord): UserRecord {
	return u;
}

// ── Access requests (offline-code intake) ──────────────────────────────────
// Stored WITHOUT auto-issuing a code; an admin mints codes offline (scripts/mint-code.mjs).
// In-memory fallback so `next dev` without a KV binding still works.
const memoryRequests: AccessRequest[] = [];

/** True if this email already has a pending request (dedupe). */
export async function hasPendingRequest(email: string): Promise<boolean> {
	const e = email.trim().toLowerCase();
	const all = await listAccessRequests();
	return all.some((r) => r.email.toLowerCase() === e && r.status === "pending");
}

/** Persist a new pending access request and append its id to the index list. */
export async function createAccessRequest(input: Omit<AccessRequest, "id" | "status" | "createdAt">): Promise<AccessRequest> {
	const rec: AccessRequest = {
		id: `r_${crypto.randomUUID().slice(0, 8)}`,
		status: "pending",
		createdAt: new Date().toISOString(),
		...input,
	};
	const kv = getKV();
	if (!kv) {
		memoryRequests.push(rec);
		return rec;
	}
	await kv.put(reqKey(rec.id), JSON.stringify(rec));
	const ids = JSON.parse((await kv.get(REQ_INDEX)) ?? "[]") as string[];
	ids.push(rec.id);
	await kv.put(REQ_INDEX, JSON.stringify(ids));
	return rec;
}

/** List all access requests (newest first). Used by the admin mint script. */
export async function listAccessRequests(): Promise<AccessRequest[]> {
	const kv = getKV();
	if (!kv) return [...memoryRequests].reverse();
	const ids = JSON.parse((await kv.get(REQ_INDEX)) ?? "[]") as string[];
	const recs = await Promise.all(ids.map((id) => kv.get<AccessRequest>(reqKey(id), "json")));
	return recs.filter((r): r is AccessRequest => !!r).reverse();
}
