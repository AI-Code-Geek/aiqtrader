import { readAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/whoami → { admin: boolean, name? }. Used by the nav to reveal the Admin link. */
export async function GET(): Promise<Response> {
	const admin = await readAdmin();
	return Response.json({ admin: !!admin, name: admin?.name ?? null });
}
