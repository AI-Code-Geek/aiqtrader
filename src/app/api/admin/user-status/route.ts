import { readAdmin } from "@/lib/admin";
import { getUserById, putUser, validityFromDays, extendValidity } from "@/lib/user-store";
import type { UserStatus } from "@/lib/user-types";

export const dynamic = "force-dynamic";

const STATUSES: UserStatus[] = ["active", "suspended", "expired"];

/**
 * POST /api/admin/user-status — activate / suspend a user, set or extend validity. Admin only.
 * Body: { userid, status?, validityDays?, extendDays? }
 *   - status: active | suspended | expired
 *   - validityDays: SET validity to N days from now (0/null = perpetual)
 *   - extendDays: EXTEND validity by N days from the later of now / current expiry (0 = perpetual)
 */
export async function POST(req: Request): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

	let body: {
		userid?: string;
		status?: string;
		validityDays?: number | null;
		extendDays?: number | null;
		delivery?: string;
	};
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return Response.json({ error: "bad_request" }, { status: 400 });
	}
	if (!body.userid) return Response.json({ error: "missing_userid" }, { status: 400 });

	const user = await getUserById(body.userid);
	if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

	if (body.status && STATUSES.includes(body.status as UserStatus)) user.status = body.status as UserStatus;
	// Manual code-delivery flag (admin marks after emailing the code from their own tooling).
	if (body.delivery === "sent" || body.delivery === "not_sent") {
		(user as Record<string, unknown>).delivery = body.delivery;
	}
	if (body.extendDays !== undefined && body.extendDays !== null) {
		user.validity = extendValidity(user.validity, body.extendDays);
		if (user.status === "expired") user.status = "active"; // a renewal reactivates
	} else if (body.validityDays !== undefined) {
		user.validity = validityFromDays(body.validityDays);
	}

	await putUser(user);
	return Response.json({ user });
}
