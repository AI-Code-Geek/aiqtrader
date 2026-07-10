import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth-server";
import { LandingForm } from "@/components/LandingForm";

// Reads the session cookie per request → must not be statically prerendered.
export const dynamic = "force-dynamic";

/**
 * Landing / redeem page. If the visitor already has a valid session, skip the code form and send them
 * straight to the dashboard — otherwise returning to the root domain would re-prompt for the code even
 * though they're logged in. Unauthenticated visitors get the redeem form.
 */
export default async function Landing() {
	const session = await readSession();
	if (session) redirect("/app");
	return <LandingForm />;
}
