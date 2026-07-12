/** Thin client-side wrappers over the auth/user BFF (DEVPLAN §4–§5). Browser only. */
"use client";

import type { UserRecord, Feedback } from "./user-types";

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

export interface AccessRequestResult {
	ok: boolean;
	status?: string;
	error?: string;
}

/** Submit a request for an access code. Admin mints the code offline — this grants no access. */
export async function requestAccess(input: { name: string; email: string; plan: "free" | "pro"; persona?: string; note?: string }): Promise<AccessRequestResult> {
	const res = await fetch("/api/access-requests", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
	const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
	return { ok: res.ok, ...body };
}

export async function logout(): Promise<void> {
	await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

// ── Feedback ──────────────────────────────────────────────────────────────
export async function submitFeedback(input: {
	category: string;
	rating?: number;
	message: string;
	page?: string;
}): Promise<{ ok: boolean; error?: string }> {
	const res = await fetch("/api/feedback", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
	const body = (await res.json().catch(() => ({}))) as { error?: string };
	return { ok: res.ok, ...body };
}

/** Admin: list all feedback. Returns [] if not admin / unauthenticated. */
export async function fetchFeedback(): Promise<Feedback[]> {
	const res = await fetch("/api/admin/feedback");
	if (!res.ok) return [];
	const body = (await res.json().catch(() => ({}))) as { feedback?: Feedback[] };
	return body.feedback ?? [];
}

/** Admin: update a feedback item's triage status. */
export async function setFeedbackStatus(id: string, status: Feedback["status"]): Promise<boolean> {
	const res = await fetch("/api/admin/feedback", {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ id, status }),
	});
	return res.ok;
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
