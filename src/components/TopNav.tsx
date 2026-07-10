"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, setUser, clearUser } from "@/lib/client-user";
import { fetchMe, logout } from "@/lib/api-client";

export function TopNav({ subtitle, active }: { subtitle?: string; active?: "dashboard" | "mylist" }) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [tier, setTier] = useState("");

	useEffect(() => {
		// Instant paint from the localStorage mirror, then reconcile with server truth (/api/me).
		const u = getUser();
		if (u) {
			setName(u.name ?? "");
			setTier(u.tier ?? "");
		}
		fetchMe().then((me) => {
			if (!me) return;
			setUser(me);
			setName(me.name ?? "");
			setTier(me.tier ?? "");
		});
	}, []);

	function toggleTheme() {
		const el = document.documentElement;
		const next = el.getAttribute("data-theme") === "dark" ? "" : "dark";
		el.setAttribute("data-theme", next);
		localStorage.setItem("aiq_theme", next);
	}

	async function signOut() {
		await logout(); // clears the httpOnly session cookie server-side
		clearUser();
		router.push("/");
	}

	const linkCls = (key: string) =>
		`text-sm ${active === key ? "font-semibold text-foreground" : "text-muted"}`;

	return (
		<nav className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-surface px-4 py-3">
			<Link href="/app" className="text-lg font-bold tracking-tight">
				AIQ<span className="text-brand">Trader</span>
			</Link>
			<div className="flex gap-4">
				<Link href="/app" className={linkCls("dashboard")}>Dashboard</Link>
				<Link href="/app/my-list" className={linkCls("mylist")}>My List</Link>
			</div>
			<div className="ml-auto flex items-center gap-2">
				{subtitle ? <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">{subtitle}</span> : null}
				{name ? <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">{name} · {tier}</span> : null}
				<button onClick={toggleTheme} className="rounded-md border border-border px-2 py-1 text-sm" aria-label="Toggle theme">◐</button>
				<button onClick={signOut} className="rounded-md border border-border px-2 py-1 text-sm">Sign out</button>
			</div>
		</nav>
	);
}
