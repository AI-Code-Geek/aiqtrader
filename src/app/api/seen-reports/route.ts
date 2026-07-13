import { readSession } from "@/lib/auth-server";
import { getUserById, putUser, publicUser } from "@/lib/user-store";
import { isActive } from "@/lib/user-types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/seen-reports { seen: { [watchlistSlug]: generatedAtIso } }
 * Merges into the user's `seenReports` map (get → merge → put), mirroring the My List pattern. This is
 * the cross-device source of truth for which report runs the user has already been notified about; the
 * client keeps a localStorage mirror only for instant paint.
 *
 * Merge (not replace) and keep the LATER timestamp per watchlist, so two devices racing can't move a
 * watchlist backwards into "unread".
 */
export async function PATCH(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthenticated" }, 401);

	let seen: unknown;
	try {
		({ seen } = (await req.json()) as { seen?: unknown });
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (typeof seen !== "object" || seen === null || Array.isArray(seen)) {
		return json({ error: "invalid_seen" }, 400);
	}
	const incoming = seen as Record<string, unknown>;
	if (Object.values(incoming).some((v) => typeof v !== "string")) {
		return json({ error: "invalid_seen" }, 400);
	}

	const user = await getUserById(session.userid);
	if (!user || !isActive(user)) return json({ error: "inactive" }, 401);

	const merged: Record<string, string> = { ...(user.seenReports ?? {}) };
	for (const [slug, ts] of Object.entries(incoming as Record<string, string>)) {
		if (!merged[slug] || ts > merged[slug]) merged[slug] = ts; // keep the later timestamp
	}
	// Defensive cap — one entry per watchlist; the universe of watchlists is small.
	user.seenReports = Object.fromEntries(Object.entries(merged).slice(0, 100));
	await putUser(user);
	return json({ user: publicUser(user) }, 200);
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
