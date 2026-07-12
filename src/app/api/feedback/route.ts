import { readSession } from "@/lib/auth-server";
import { getUserById, createFeedback } from "@/lib/user-store";
import { isActive, FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/user-types";

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * POST /api/feedback { category, rating?, message, page? } — any signed-in customer submits feedback.
 * Identity (userid/email/name) comes from the session, never the client body. Admin viewing lives at
 * /api/admin/feedback (gated by the admin allowlist).
 */
export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthenticated" }, 401);
	const user = await getUserById(session.userid);
	if (!user || !isActive(user)) return json({ error: "unauthenticated" }, 401);

	let body: { category?: string; rating?: number; message?: string; page?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	const message = (body.message ?? "").trim().slice(0, 4000);
	if (!message) return json({ error: "missing_message" }, 400);
	const category: FeedbackCategory = FEEDBACK_CATEGORIES.includes(body.category as FeedbackCategory)
		? (body.category as FeedbackCategory)
		: "other";
	const rating =
		typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5 ? Math.round(body.rating) : undefined;

	const rec = await createFeedback({
		userid: user.userid,
		email: user.email,
		name: user.name,
		category,
		rating,
		message,
		page: (body.page ?? "").slice(0, 200) || undefined,
	});
	return json({ ok: true, id: rec.id }, 201);
}
