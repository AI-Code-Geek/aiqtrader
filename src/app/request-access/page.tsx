import { RequestAccessForm } from "@/components/RequestAccessForm";

// Public page (not under /app → not guarded by middleware). Writes a pending KV request.
export const dynamic = "force-dynamic";

export default function RequestAccessPage() {
	return <RequestAccessForm />;
}
