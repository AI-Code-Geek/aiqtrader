"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./Brand";
import { NotificationBell } from "./NotificationBell";
import { getUser, setUser, clearUser } from "@/lib/client-user";
import { fetchMe, logout } from "@/lib/api-client";

export function TopNav({
	subtitle,
	active,
	scheduleId,
	watchlistId,
	persona,
}: {
	subtitle?: string;
	active?: "dashboard" | "mylist" | "market" | "guide" | "feedback" | "admin";
	/** When set, shows a Market link scoped to this schedule (persona-scoped market overview). */
	scheduleId?: string;
	/** Preferred over scheduleId: scopes links to the watchlist route (/app/w/<id>/<persona>/…). */
	watchlistId?: string;
	/** The active persona — required with watchlistId to build persona-scoped links. */
	persona?: string;
}) {
	const marketHref =
		watchlistId && persona
			? `/app/w/${watchlistId}/${persona}/market`
			: scheduleId
				? `/app/${scheduleId}/market`
				: null;
	const router = useRouter();
	const [name, setName] = useState("");
	const [tier, setTier] = useState("");
	const [isAdmin, setIsAdmin] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

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
		// Reveal the Admin link only for admins (server decides; never trusted from the client).
		fetch("/api/admin/whoami")
			.then((r) => r.json() as Promise<{ admin?: boolean }>)
			.then((d) => setIsAdmin(!!d.admin))
			.catch(() => {});
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

	const initials =
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join("")
			.toUpperCase() || "?";

	// Links are shared between the desktop row and the mobile menu.
	const links = (
		<>
			<Link href="/app" className={linkCls("dashboard")}>Dashboard</Link>
			{marketHref ? <Link href={marketHref} className={linkCls("market")}>Market</Link> : null}
			<Link href="/app/my-list" className={linkCls("mylist")}>My List</Link>
			<Link href="/app/guide" className={linkCls("guide")}>Guide</Link>
			<Link href="/app/feedback" className={linkCls("feedback")}>Feedback</Link>
			{isAdmin ? <Link href="/app/admin" className={linkCls("admin")}>Admin</Link> : null}
		</>
	);

	return (
		// `overflow-x-clip` + `min-w-0` on the flex children keep a long subtitle/name from forcing the
		// page into a horizontal scroll on narrow screens (the nav was ~653px wide in a 390px viewport).
		<nav className="sticky top-0 z-10 overflow-x-clip border-b border-border bg-surface px-4 py-3">
			<div className="flex items-center gap-3 md:gap-4">
				<Link href="/app" className="flex shrink-0 items-center">
					{/* Tagline is dead weight on a phone — show it from md up. */}
					<span className="hidden md:block"><Brand tagline /></span>
					<span className="md:hidden"><Brand /></span>
				</Link>

				{/* Desktop link row */}
				<div className="hidden gap-4 md:flex">{links}</div>

				<div className="ml-auto flex min-w-0 items-center gap-2">
					{subtitle ? (
						<span className="hidden truncate rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted lg:inline">
							{subtitle}
						</span>
					) : null}
					{name ? (
						<span className="flex shrink-0 items-center gap-2" title={`${name}${tier ? ` · ${tier}` : ""}`}>
							<span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-xs font-semibold text-brand">
								{initials}
							</span>
							<span className="hidden text-xs text-muted lg:inline">{name}{tier ? ` · ${tier}` : ""}</span>
						</span>
					) : null}
					<NotificationBell />
					<button onClick={toggleTheme} className="shrink-0 rounded-md border border-border px-2 py-1 text-sm" aria-label="Toggle theme">◐</button>
					{/* Sign out moves into the mobile menu to save space */}
					<button onClick={signOut} className="hidden shrink-0 rounded-md border border-border px-2 py-1 text-sm md:block">Sign out</button>
					{/* Hamburger — mobile only */}
					<button
						onClick={() => setMenuOpen((o) => !o)}
						className="shrink-0 rounded-md border border-border px-2 py-1 text-sm md:hidden"
						aria-label="Menu"
						aria-expanded={menuOpen}
					>
						{menuOpen ? "✕" : "☰"}
					</button>
				</div>
			</div>

			{/* Mobile menu */}
			{menuOpen ? (
				<div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 md:hidden" onClick={() => setMenuOpen(false)}>
					{links}
					<button onClick={signOut} className="self-start rounded-md border border-border px-2 py-1 text-sm">
						Sign out
					</button>
				</div>
			) : null}
		</nav>
	);
}
