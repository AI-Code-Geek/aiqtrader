import { TopNav } from "@/components/TopNav";
import { FeedbackForm } from "@/components/FeedbackForm";

// Under /app/** → middleware requires a session. The form posts with the session cookie.
export const dynamic = "force-dynamic";

export default function FeedbackPage() {
	return (
		<>
			<TopNav active="feedback" />
			<FeedbackForm />
		</>
	);
}
