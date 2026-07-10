import { readSession } from "@/lib/auth-server";
import { getUserById, publicUser } from "@/lib/user-store";
import { isActive } from "@/lib/user-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — server truth for the current user (My List, live status). One KV read.
 * Rejects if the session is gone OR the record flipped to suspended/expired mid-session.
 */
export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthenticated" }, 401);
	const user = await getUserById(session.userid);
	if (!user || !isActive(user)) return json({ error: "inactive" }, 401);
	return json({ user: publicUser(user) }, 200);
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
