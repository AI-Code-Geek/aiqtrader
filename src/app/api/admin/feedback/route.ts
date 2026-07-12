import { readAdmin } from "@/lib/admin";
import { listFeedback, setFeedbackStatus } from "@/lib/user-store";

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** GET /api/admin/feedback — admin only. All feedback, newest-first. */
export async function GET(): Promise<Response> {
	if (!(await readAdmin())) return json({ error: "forbidden" }, 403);
	return json({ feedback: await listFeedback() }, 200);
}

/** PATCH /api/admin/feedback { id, status } — admin triage (new → read → archived). */
export async function PATCH(req: Request): Promise<Response> {
	if (!(await readAdmin())) return json({ error: "forbidden" }, 403);
	let body: { id?: string; status?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const status = body.status;
	if (!body.id || (status !== "new" && status !== "read" && status !== "archived")) {
		return json({ error: "bad_request" }, 400);
	}
	const rec = await setFeedbackStatus(body.id, status);
	if (!rec) return json({ error: "not_found" }, 404);
	return json({ ok: true, feedback: rec }, 200);
}
