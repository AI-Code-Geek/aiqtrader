/** Thin client-side wrappers over the auth/user BFF (DEVPLAN §4–§5). Browser only. */
"use client";

import type { UserRecord } from "./user-types";

export interface RedeemResult {
	ok: boolean;
	user?: UserRecord;
	error?: string;
	reason?: string;
}

export async function redeemCode(code: string): Promise<RedeemResult> {
	const res = await fetch("/api/auth/redeem", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ code }),
	});
	const body = (await res.json().catch(() => ({}))) as { user?: UserRecord; error?: string; reason?: string };
	return { ok: res.ok, ...body };
}

export async function logout(): Promise<void> {
	await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

/** Current server-truth user, or null if the session is gone/inactive. */
export async function fetchMe(): Promise<UserRecord | null> {
	const res = await fetch("/api/me");
	if (!res.ok) return null;
	const { user } = (await res.json()) as { user: UserRecord };
	return user;
}

/** Persist the My List subset to the KV record. Returns the updated user, or null on failure. */
export async function saveMyList(myList: string[]): Promise<UserRecord | null> {
	const res = await fetch("/api/my-list", {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ myList }),
	});
	if (!res.ok) return null;
	const { user } = (await res.json()) as { user: UserRecord };
	return user;
}
