import { redirect } from "next/navigation";
import { readAdmin } from "@/lib/admin";
import { TopNav } from "@/components/TopNav";
import { AdminClient } from "@/components/AdminClient";

// Admin-only. Gated server-side: non-admins (or signed-out) are bounced to the dashboard.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const admin = await readAdmin();
	if (!admin) redirect("/app");
	return (
		<>
			<TopNav active="admin" subtitle="admin" />
			<AdminClient adminName={admin.name} />
		</>
	);
}
