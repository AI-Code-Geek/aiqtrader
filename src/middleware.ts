import { NextResponse, type NextRequest } from "next/server";
import { verifySession, resolveSecret, SESSION_COOKIE } from "@/lib/session";

/**
 * Guard for /app/** (DEVPLAN §4).
 *
 * NOTE: this deliberately uses the `middleware` convention, NOT Next 16's newer `proxy` convention.
 * `proxy` runs on the Node.js runtime, which @opennextjs/cloudflare cannot bundle into the Worker
 * ("Node.js middleware is not currently supported"). `middleware` runs on the **Edge** runtime, which
 * OpenNext supports — and this code is edge-safe (Web Crypto only, no Node APIs). The deprecation
 * warning from `next build` is expected and harmless here.
 *
 * The session cookie is self-verifying (HMAC), so this does NO KV read per request — only a signature
 * + expiry check. Tier also rides in the cookie:
 *   • no / invalid / expired session  → redirect to the redeem page (`/`).
 *   • free tier                       → blocked from the symbol detail view (charts are pro-only),
 *                                       redirected back to the dashboard with ?upgrade=1.
 * Never trusts anything from the client — tier comes from the signed payload.
 */
/** CSRF defense-in-depth: a mutating API request carrying an Origin must be same-origin. */
function csrfBlocked(req: NextRequest): boolean {
	const method = req.method.toUpperCase();
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
	const origin = req.headers.get("origin");
	if (!origin) return false; // no Origin (non-browser / same-origin nav) → rely on sameSite=lax cookie
	try {
		return new URL(origin).host !== req.headers.get("host");
	} catch {
		return true; // malformed Origin → reject
	}
}

export async function middleware(req: NextRequest) {
	// API routes: no session-redirect (each handler self-gates), but enforce the CSRF Origin-check on
	// state-changing methods. This centralizes CSRF for every current + future /api/** route.
	if (req.nextUrl.pathname.startsWith("/api/")) {
		if (csrfBlocked(req)) return NextResponse.json({ error: "csrf_origin_mismatch" }, { status: 403 });
		return NextResponse.next();
	}

	const token = req.cookies.get(SESSION_COOKIE)?.value;
	const session = await verifySession(token, resolveSecret(process.env.SECRET));

	if (!session) {
		const url = req.nextUrl.clone();
		url.pathname = "/";
		url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
		return NextResponse.redirect(url);
	}

	// Symbol detail = /app/<scheduleId>/<symbol>. Pro-only (charts). The market overview
	// (/app/<scheduleId>/market) is macro context, not per-symbol charts → available to all tiers.
	//
	// Feature flag (temporary): set env SYMBOL_DETAIL_PRO_ONLY="false" to OPEN symbol pages to the free
	// tier. Default (unset / any other value) keeps the Pro-only gate. Flip the env back to re-gate —
	// no code change needed.
	const symbolDetailProOnly = process.env.SYMBOL_DETAIL_PRO_ONLY !== "false";
	const parts = req.nextUrl.pathname.split("/").filter(Boolean); // ["app", scheduleId, symbol?]
	const isSymbolDetail = parts.length === 3 && parts[0] === "app" && parts[2] !== "market";
	if (symbolDetailProOnly && session.tier === "free" && isSymbolDetail) {
		const url = req.nextUrl.clone();
		url.pathname = `/app/${parts[1]}`;
		url.search = "?upgrade=1";
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/app/:path*", "/api/:path*"],
};
