import { readAdmin } from "@/lib/admin";
import { deleteUser } from "@/lib/user-store";

export const dynamic = "force-dynamic";

/** POST /api/admin/user-delete { userid } — permanently remove a user + their code. Admin only. */
export async function POST(req: Request): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
	let body: { userid?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return Response.json({ error: "bad_request" }, { status: 400 });
	}
	if (!body.userid) return Response.json({ error: "missing_userid" }, { status: 400 });
	await deleteUser(body.userid);
	return Response.json({ ok: true });
}
