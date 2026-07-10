import { cookies } from "next/headers";
import { getUserByCode, putUser, publicUser } from "@/lib/user-store";
import { isActive } from "@/lib/user-types";
import { signSession, SESSION_COOKIE, SESSION_MAX_SECONDS } from "@/lib/session";
import { envSecret, isProd } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/redeem { code }
 * code → idx:code:<CODE> → userid → user record. Gate on status + validity, then set a signed
 * httpOnly session cookie (self-verifying; no per-request KV read afterwards).
 */
export async function POST(req: Request): Promise<Response> {
	let code = "";
	try {
		const parsed = (await req.json()) as { code?: string };
		code = (parsed.code ?? "").trim();
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!code) return json({ error: "missing_code" }, 400);

	const user = await getUserByCode(code);
	if (!user) return json({ error: "invalid_code" }, 401);
	if (!isActive(user)) {
		const reason = user.status !== "active" ? user.status : "expired";
		return json({ error: "inactive", reason }, 403);
	}

	const now = Math.floor(Date.now() / 1000);
	let exp = now + SESSION_MAX_SECONDS;
	if (user.validity) exp = Math.min(exp, Math.floor(Date.parse(user.validity) / 1000));

	const token = await signSession({ userid: user.userid, tier: user.tier, exp }, envSecret());
	const jar = await cookies();
	jar.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: isProd(),
		sameSite: "lax",
		path: "/",
		maxAge: Math.max(0, exp - now),
	});

	// Best-effort last-login stamp (small record rewrite).
	user.lastLoginAt = new Date().toISOString();
	await putUser(user);

	return json({ user: publicUser(user) }, 200);
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
