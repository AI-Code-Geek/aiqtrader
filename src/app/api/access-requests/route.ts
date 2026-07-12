import { createAccessRequest, findReusableRequest } from "@/lib/user-store";
import { PERSONAS, type Persona, type Tier } from "@/lib/user-types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/access-requests { name, email, plan, persona, note? }
 * Stores a PENDING request in KV. Does NOT issue a code or a session — an admin mints codes offline
 * (scripts/mint-code.mjs) and hands them to the user, who then redeems on `/`. The captured persona is
 * carried onto the minted user as `defaultPersona` so we load that persona's reports.
 */
export async function POST(req: Request): Promise<Response> {
	let body: { name?: string; email?: string; plan?: string; persona?: string; note?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	const name = (body.name ?? "").trim();
	const email = (body.email ?? "").trim();
	const note = (body.note ?? "").trim().slice(0, 500);
	const plan: Tier = body.plan === "free" ? "free" : "pro";
	const persona: Persona = PERSONAS.includes(body.persona as Persona) ? (body.persona as Persona) : "swing";

	if (!name) return json({ error: "missing_name" }, 400);
	if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);

	// Dedupe: block a duplicate if this email is already pending OR already has a fulfilled code.
	const existing = await findReusableRequest(email);
	if (existing) {
		return json({ ok: true, status: existing.status, deduped: true }, 200);
	}

	const rec = await createAccessRequest({ name, email, plan, persona, note: note || undefined });
	return json({ ok: true, status: rec.status, id: rec.id }, 201);
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
