/**
 * User record stored in KV under the key `<userid>` (the key IS the userid).
 * A secondary index `idx:code:<CODE>` -> "<userid>" enables redeem-by-code lookup.
 * See DEVPLAN.md §3–§4. The shape is intentionally extensible.
 */

export type Tier = "free" | "pro";
export type UserStatus = "active" | "suspended" | "expired";
/** Report stream a user works in — mirrors report-types.Persona. Drives which persona's reports load. */
export type Persona = "swing" | "day" | "scalp";
export const PERSONAS: Persona[] = ["swing", "day", "scalp"];

export interface UserRecord {
	/** = the KV key */
	userid: string;
	name: string;
	email: string;
	/** subscription code; also indexed at idx:code:<code> -> userid */
	code: string;
	status: UserStatus;
	/** ISO subscription end; null = perpetual */
	validity: string | null;
	tier: Tier;
	/** schedule ids this user may view */
	schedules: number[];
	/** preferred report stream — set from the access request; used to land the user on that persona */
	defaultPersona?: Persona;
	/** personal subset of the universe — a field inside the record */
	myList: string[];
	createdAt?: string;
	lastLoginAt?: string;
	[key: string]: unknown;
}

/** The signed-cookie session payload (self-verifying; no per-request KV read). */
export interface Session {
	userid: string;
	tier: Tier;
	/** epoch seconds; min(sessionMax, validity) */
	exp: number;
}

/**
 * A visitor's request for an access code. Stored in KV at `req:<id>`; the id is appended to the
 * `idx:reqs` list. Codes are NOT auto-issued — an admin reviews requests and mints codes offline
 * (scripts/mint-code.mjs), so a request grants no session or access on its own.
 */
export interface AccessRequest {
	id: string;
	name: string;
	email: string;
	/** desired tier */
	plan: Tier;
	/** persona (report stream) the visitor wants — carried onto the minted user as defaultPersona */
	persona: Persona;
	note?: string;
	status: "pending" | "fulfilled" | "rejected";
	createdAt: string;
	/** set when an admin mints a code for this request */
	fulfilledAt?: string;
	code?: string;
}

export function isActive(user: Pick<UserRecord, "status" | "validity">, now = Date.now()): boolean {
	if (user.status !== "active") return false;
	if (user.validity && Date.parse(user.validity) < now) return false;
	return true;
}
