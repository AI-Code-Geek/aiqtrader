import { readAdmin } from "@/lib/admin";
import { getAccessRequest, putAccessRequest, deleteAccessRequest } from "@/lib/user-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/request-action { id, action } — manage an access request. Admin only.
 *   - action "deny":   mark the request rejected (kept for the record; no code issued).
 *   - action "delete": remove the request entirely.
 */
export async function POST(req: Request): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

	let body: { id?: string; action?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return Response.json({ error: "bad_request" }, { status: 400 });
	}
	if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });

	if (body.action === "delete") {
		await deleteAccessRequest(body.id);
		return Response.json({ ok: true, action: "delete" });
	}
	if (body.action === "deny") {
		const rec = await getAccessRequest(body.id);
		if (!rec) return Response.json({ error: "request_not_found" }, { status: 404 });
		rec.status = "rejected";
		await putAccessRequest(rec);
		return Response.json({ ok: true, action: "deny" });
	}
	return Response.json({ error: "unknown_action" }, { status: 400 });
}
