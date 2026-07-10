import { NextResponse, type NextRequest } from "next/server";
import { verifySession, resolveSecret, SESSION_COOKIE } from "@/lib/session";

/**
 * Guard for /app/** (DEVPLAN §4). Next 16 "proxy" convention (formerly middleware). The session
 * cookie is self-verifying (HMAC), so this does NO KV read per request — it only checks the signature
 * + expiry. Tier also rides in the cookie:
 *   • no / invalid / expired session  → redirect to the redeem page (`/`).
 *   • free tier                       → blocked from the symbol detail view (charts are pro-only),
 *                                       redirected back to the dashboard with ?upgrade=1.
 * Never trusts anything from the client — tier comes from the signed payload.
 */
export async function proxy(req: NextRequest) {
	const token = req.cookies.get(SESSION_COOKIE)?.value;
	const session = await verifySession(token, resolveSecret(process.env.SECRET));

	if (!session) {
		const url = req.nextUrl.clone();
		url.pathname = "/";
		url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
		return NextResponse.redirect(url);
	}

	// Symbol detail = /app/<scheduleId>/<symbol>. Pro-only (charts).
	const parts = req.nextUrl.pathname.split("/").filter(Boolean); // ["app", scheduleId, symbol?]
	const isSymbolDetail = parts.length === 3 && parts[0] === "app";
	if (session.tier === "free" && isSymbolDetail) {
		const url = req.nextUrl.clone();
		url.pathname = `/app/${parts[1]}`;
		url.search = "?upgrade=1";
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/app/:path*"],
};
