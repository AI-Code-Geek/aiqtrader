import { readAdmin } from "@/lib/admin";
import { listAccessRequests } from "@/lib/user-store";

export const dynamic = "force-dynamic";

/** GET /api/admin/requests → all access requests (newest first). Admin only. */
export async function GET(): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
	return Response.json({ requests: await listAccessRequests() });
}
