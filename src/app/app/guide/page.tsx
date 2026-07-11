import { TopNav } from "@/components/TopNav";
import { TraderGuide } from "@/components/TraderGuide";

// Static explanatory page — no report data. Available to all tiers (not a symbol-detail route).
export default function GuidePage() {
	return (
		<>
			<TopNav active="guide" subtitle="guide" />
			<TraderGuide />
		</>
	);
}
