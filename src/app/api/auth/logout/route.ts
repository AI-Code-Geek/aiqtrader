import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — clear the session cookie. */
export async function POST(): Promise<Response> {
	const jar = await cookies();
	jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}
