/**
 * User record stored in KV under the key `<userid>` (the key IS the userid).
 * A secondary index `idx:code:<CODE>` -> "<userid>" enables redeem-by-code lookup.
 * See DEVPLAN.md §3–§4. The shape is intentionally extensible.
 */

export type Tier = "free" | "pro";
export type UserStatus = "active" | "suspended" | "expired";

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

export function isActive(user: Pick<UserRecord, "status" | "validity">, now = Date.now()): boolean {
	if (user.status !== "active") return false;
	if (user.validity && Date.parse(user.validity) < now) return false;
	return true;
}
