import { readSession } from "@/lib/auth-server";
import { getUserById, putUser, publicUser } from "@/lib/user-store";
import { isActive } from "@/lib/user-types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/my-list { myList: string[] } — get → mutate myList → put on the user record (DEVPLAN §5).
 * The client keeps a localStorage mirror for instant paint; this is the cross-device source of truth.
 */
export async function PATCH(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthenticated" }, 401);

	let myList: unknown;
	try {
		({ myList } = (await req.json()) as { myList?: unknown });
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!Array.isArray(myList) || myList.some((s) => typeof s !== "string")) {
		return json({ error: "invalid_my_list" }, 400);
	}

	const user = await getUserById(session.userid);
	if (!user || !isActive(user)) return json({ error: "inactive" }, 401);

	// De-dupe + cap defensively; the engine's universe is small.
	user.myList = Array.from(new Set(myList as string[])).slice(0, 200);
	await putUser(user);
	return json({ user: publicUser(user) }, 200);
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
