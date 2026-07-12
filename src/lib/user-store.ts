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
import type { UserRecord, AccessRequest, Feedback } from "./user-types";

export const codeIndexKey = (code: string) => `idx:code:${code.trim().toUpperCase()}`;
const reqKey = (id: string) => `req:${id}`;
const REQ_INDEX = "idx:reqs";
const USER_INDEX = "idx:users"; // list of minted userids (seed users aren't listed here)

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

// ── Customer feedback ──────────────────────────────────────────────────────
// Same KV pattern as access requests: one record at `fb:<id>`, ids tracked in `idx:feedback`.
// In-memory fallback so `next dev` without a KV binding still works.
const fbKey = (id: string) => `fb:${id}`;
const FB_INDEX = "idx:feedback";
const memoryFeedback: Feedback[] = [];

/** Persist a new feedback item and append its id to the index list. */
export async function createFeedback(
	input: Omit<Feedback, "id" | "status" | "createdAt">,
): Promise<Feedback> {
	const rec: Feedback = {
		id: `fb_${crypto.randomUUID().slice(0, 8)}`,
		status: "new",
		createdAt: new Date().toISOString(),
		...input,
	};
	const kv = getKV();
	if (!kv) {
		memoryFeedback.push(rec);
		return rec;
	}
	await kv.put(fbKey(rec.id), JSON.stringify(rec));
	const ids = JSON.parse((await kv.get(FB_INDEX)) ?? "[]") as string[];
	ids.push(rec.id);
	await kv.put(FB_INDEX, JSON.stringify(ids));
	return rec;
}

/** All feedback, newest-first. */
export async function listFeedback(): Promise<Feedback[]> {
	const kv = getKV();
	if (!kv) return [...memoryFeedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	const ids = JSON.parse((await kv.get(FB_INDEX)) ?? "[]") as string[];
	const items = await Promise.all(ids.map((id) => kv.get<Feedback>(fbKey(id), "json")));
	return items.filter((x): x is Feedback => !!x).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Update a feedback item's status (admin triage: new → read → archived). */
export async function setFeedbackStatus(id: string, status: Feedback["status"]): Promise<Feedback | null> {
	const kv = getKV();
	if (!kv) {
		const rec = memoryFeedback.find((f) => f.id === id);
		if (rec) rec.status = status;
		return rec ?? null;
	}
	const rec = await kv.get<Feedback>(fbKey(id), "json");
	if (!rec) return null;
	rec.status = status;
	await kv.put(fbKey(id), JSON.stringify(rec));
	return rec;
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

/**
 * An existing request that should block a NEW submission for the same email: one still pending, or one
 * already fulfilled (they have a code). A previously rejected request does NOT block a re-request.
 */
export async function findReusableRequest(email: string): Promise<AccessRequest | null> {
	const e = email.trim().toLowerCase();
	const all = await listAccessRequests();
	return all.find((r) => r.email.toLowerCase() === e && (r.status === "pending" || r.status === "fulfilled")) ?? null;
}

/** Delete an access request: removes the record and its idx:reqs entry. */
export async function deleteAccessRequest(id: string): Promise<void> {
	const kv = getKV();
	if (!kv) {
		const i = memoryRequests.findIndex((r) => r.id === id);
		if (i >= 0) memoryRequests.splice(i, 1);
		return;
	}
	await kv.delete(reqKey(id));
	const ids = (JSON.parse((await kv.get(REQ_INDEX)) ?? "[]") as string[]).filter((x) => x !== id);
	await kv.put(REQ_INDEX, JSON.stringify(ids));
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

export async function getAccessRequest(id: string): Promise<AccessRequest | null> {
	const kv = getKV();
	if (!kv) return memoryRequests.find((r) => r.id === id) ?? null;
	return (await kv.get<AccessRequest>(reqKey(id), "json")) ?? null;
}

/** Persist a mutated request (e.g. mark fulfilled with the issued code). */
export async function putAccessRequest(rec: AccessRequest): Promise<void> {
	const kv = getKV();
	if (!kv) {
		const i = memoryRequests.findIndex((r) => r.id === rec.id);
		if (i >= 0) memoryRequests[i] = rec;
		return;
	}
	await kv.put(reqKey(rec.id), JSON.stringify(rec));
}

// ── Admin: mint users + list ────────────────────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1

function randomBlock(n = 4): string {
	const bytes = new Uint8Array(n);
	crypto.getRandomValues(bytes);
	let s = "";
	for (let i = 0; i < n; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	return s;
}
export const genCode = () => `AIQ-${randomBlock()}-${randomBlock()}`;
export const genUserId = () => {
	const b = new Uint8Array(3);
	crypto.getRandomValues(b);
	return "u_" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
};

/** validityDays → ISO end date. 0 / null / undefined = perpetual (null). */
export function validityFromDays(days?: number | null): string | null {
	if (!days || days <= 0) return null;
	return new Date(Date.now() + days * 86400_000).toISOString();
}

/** Extend an existing validity by N days from the LATER of now / current expiry (a true renewal). */
export function extendValidity(current: string | null | undefined, days: number): string | null {
	if (!days || days <= 0) return null; // perpetual
	const base = current ? Math.max(Date.now(), Date.parse(current)) : Date.now();
	return new Date(base + days * 86400_000).toISOString();
}

export interface MintInput {
	name: string;
	email: string;
	tier?: "free" | "pro";
	persona?: string;
	validityDays?: number | null;
	schedules?: number[];
}

/** Create + persist a new user with a fresh code. Returns the record (including its plaintext code). */
export async function createUser(input: MintInput): Promise<UserRecord> {
	const user: UserRecord = {
		userid: genUserId(),
		name: input.name,
		email: input.email,
		code: genCode(),
		status: "active",
		validity: validityFromDays(input.validityDays),
		tier: input.tier === "free" ? "free" : "pro",
		schedules: input.schedules?.length ? input.schedules : [1],
		myList: [],
		createdAt: new Date().toISOString(),
	};
	if (input.persona) (user as Record<string, unknown>).defaultPersona = input.persona;

	const kv = getKV();
	if (!kv) {
		// Local dev: keep in memory AND append to the seed file so it persists across restarts.
		(await localUsers()).push(user);
		try {
			const { readFile, writeFile } = await import("node:fs/promises");
			const { join } = await import("node:path");
			const p = join(process.cwd(), "scripts", "users.seed.json");
			const seed = JSON.parse(await readFile(p, "utf-8")) as UserRecord[];
			seed.push(user);
			await writeFile(p, JSON.stringify(seed, null, "\t") + "\n");
		} catch {
			// best-effort; memory copy still validates this session
		}
		return user;
	}
	await kv.put(user.userid, JSON.stringify(user));
	await kv.put(codeIndexKey(user.code), user.userid);
	const ids = JSON.parse((await kv.get(USER_INDEX)) ?? "[]") as string[];
	ids.push(user.userid);
	await kv.put(USER_INDEX, JSON.stringify(ids));
	return user;
}

/** Delete a user: removes the record, its code index, and its idx:users entry. */
export async function deleteUser(userid: string): Promise<void> {
	const kv = getKV();
	if (!kv) {
		const list = await localUsers();
		const i = list.findIndex((u) => u.userid === userid);
		if (i >= 0) {
			list.splice(i, 1);
			try {
				const { readFile, writeFile } = await import("node:fs/promises");
				const { join } = await import("node:path");
				const p = join(process.cwd(), "scripts", "users.seed.json");
				const seed = (JSON.parse(await readFile(p, "utf-8")) as UserRecord[]).filter((u) => u.userid !== userid);
				await writeFile(p, JSON.stringify(seed, null, "\t") + "\n");
			} catch {
				/* best-effort */
			}
		}
		return;
	}
	const user = await kv.get<UserRecord>(userid, "json");
	await kv.delete(userid);
	if (user?.code) await kv.delete(codeIndexKey(user.code));
	const ids = (JSON.parse((await kv.get(USER_INDEX)) ?? "[]") as string[]).filter((id) => id !== userid);
	await kv.put(USER_INDEX, JSON.stringify(ids));
}

/** All users the admin can manage: seed subscribers + every minted user (idx:users), newest first. */
export async function listUsers(): Promise<UserRecord[]> {
	const kv = getKV();
	if (!kv) return [...(await localUsers())].reverse();
	const byId = new Map<string, UserRecord>();
	for (const u of seedUsers()) byId.set(u.userid, u);
	const ids = JSON.parse((await kv.get(USER_INDEX)) ?? "[]") as string[];
	const recs = await Promise.all(ids.map((id) => kv.get<UserRecord>(id, "json")));
	for (const r of recs) if (r) byId.set(r.userid, r);
	return [...byId.values()].reverse();
}
