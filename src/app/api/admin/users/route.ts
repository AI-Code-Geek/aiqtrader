import { readAdmin } from "@/lib/admin";
import { listUsers } from "@/lib/user-store";

export const dynamic = "force-dynamic";

/** GET /api/admin/users → all manageable users (seed + minted), newest first. Admin only. */
export async function GET(): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
	return Response.json({ users: await listUsers() });
}
