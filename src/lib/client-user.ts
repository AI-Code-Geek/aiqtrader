/**
 * Client-side user/My-List mirror (localStorage). Instant paint + offline; in the real app this is
 * reconciled with the KV user record via /api/me and PATCH /api/my-list (DEVPLAN §4). Phase 1 uses the
 * localStorage half only.
 */
"use client";

import type { UserRecord } from "./user-types";

const KEY = "aiq_user";

export function getUser(): UserRecord | null {
	if (typeof window === "undefined") return null;
	try {
		return JSON.parse(window.localStorage.getItem(KEY) ?? "null");
	} catch {
		return null;
	}
}

export function setUser(u: UserRecord): void {
	window.localStorage.setItem(KEY, JSON.stringify(u));
}

export function clearUser(): void {
	window.localStorage.removeItem(KEY);
}

export function getMyList(): string[] {
	return getUser()?.myList ?? [];
}

export function setMyList(list: string[]): void {
	const u = getUser();
	if (!u) return;
	u.myList = list;
	setUser(u);
}

export function toggleMyList(symbol: string): string[] {
	const list = getMyList().slice();
	const i = list.indexOf(symbol);
	if (i >= 0) list.splice(i, 1);
	else list.push(symbol);
	setMyList(list);
	return list;
}
