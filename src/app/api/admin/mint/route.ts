import { readAdmin } from "@/lib/admin";
import { createUser, getAccessRequest, putAccessRequest } from "@/lib/user-store";
import type { Tier } from "@/lib/user-types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/mint  — generate a subscription code + user record. Admin only.
 * Body: { reqId? , name?, email?, tier?, persona?, validityDays? }
 *   - reqId: fulfil a pending access request (name/email/persona pulled from it, then marked fulfilled).
 *   - or name+email directly for an ad-hoc code.
 *   - validityDays: 7 / 30 / custom; 0 or omitted = perpetual.
 * Returns { code, user } — the plaintext code is shown once in the admin UI for manual sharing.
 */
export async function POST(req: Request): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

	let body: {
		reqId?: string;
		name?: string;
		email?: string;
		tier?: string;
		persona?: string;
		validityDays?: number | null;
	};
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return Response.json({ error: "bad_request" }, { status: 400 });
	}

	let { name, email } = body;
	let persona = body.persona;
	let request = null;
	if (body.reqId) {
		request = await getAccessRequest(body.reqId);
		if (!request) return Response.json({ error: "request_not_found" }, { status: 404 });
		name = name || request.name;
		email = email || request.email;
		persona = persona || request.persona;
		if (!body.tier) body.tier = request.plan;
	}

	name = (name ?? "").trim();
	email = (email ?? "").trim();
	if (!name) return Response.json({ error: "missing_name" }, { status: 400 });
	if (!EMAIL_RE.test(email)) return Response.json({ error: "invalid_email" }, { status: 400 });

	const tier: Tier = body.tier === "free" ? "free" : "pro";
	const validityDays = typeof body.validityDays === "number" ? body.validityDays : null;

	const user = await createUser({ name, email, tier, persona, validityDays });

	if (request) {
		request.status = "fulfilled";
		request.fulfilledAt = new Date().toISOString();
		request.code = user.code;
		await putAccessRequest(request);
	}

	return Response.json({ code: user.code, user });
}
