import { readAdmin } from "@/lib/admin";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/send-code { to, name, code } — email a subscription code via the Gmail API. Admin only.
 *
 * IMPORTANT: Gmail SMTP + an App Password does NOT work on Cloudflare's edge (no raw SMTP sockets,
 * nodemailer won't bundle). The working, edge-safe path is the Gmail REST API with an OAuth2 refresh
 * token, exchanged for a short-lived access token via fetch. Configure (Cloudflare env / .env.local):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER (the from address).
 * (Create these once in Google Cloud Console → OAuth consent + credentials, scope
 *  https://www.googleapis.com/auth/gmail.send, then mint a refresh token via the OAuth playground.)
 *
 * If email isn't configured or the send fails, this returns a non-200 and the admin UI falls back to
 * "copy the code and share it manually".
 */
function env(name: string): string | undefined {
	try {
		const v = (getCloudflareContext().env as unknown as Record<string, string | undefined>)[name];
		if (v) return v;
	} catch {
		/* no CF context */
	}
	return process.env[name];
}

function b64url(s: string): string {
	// btoa over UTF-8 bytes, then URL-safe.
	const utf8 = unescape(encodeURIComponent(s));
	return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: Request): Promise<Response> {
	if (!(await readAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

	let body: { to?: string; name?: string; code?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return Response.json({ error: "bad_request" }, { status: 400 });
	}
	const to = (body.to ?? "").trim();
	const code = (body.code ?? "").trim();
	const name = (body.name ?? "there").trim();
	if (!to || !code) return Response.json({ error: "missing_fields" }, { status: 400 });

	const clientId = env("GMAIL_CLIENT_ID");
	const clientSecret = env("GMAIL_CLIENT_SECRET");
	const refreshToken = env("GMAIL_REFRESH_TOKEN");
	const sender = env("GMAIL_SENDER") || env("GMAIL_USER");
	if (!clientId || !clientSecret || !refreshToken || !sender) {
		return Response.json({ error: "email_not_configured" }, { status: 501 });
	}

	try {
		// 1. refresh token → access token
		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				refresh_token: refreshToken,
				grant_type: "refresh_token",
			}),
		});
		const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
		if (!tokenRes.ok || !tokenJson.access_token) {
			return Response.json({ error: "oauth_failed", detail: tokenJson.error }, { status: 502 });
		}

		// 2. build MIME + send via Gmail API
		const subject = "Your AIQTrader access code";
		const html =
			`<p>Hi ${name},</p>` +
			`<p>Your AIQTrader subscription code is:</p>` +
			`<p style="font-size:20px;font-weight:bold;letter-spacing:1px">${code}</p>` +
			`<p>Enter it on the sign-in page to unlock your dashboard.</p>` +
			`<p style="color:#888;font-size:12px">Educational analysis, not financial advice.</p>`;
		const mime = [
			`From: <${sender}>`,
			`To: <${to}>`,
			`Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
			"MIME-Version: 1.0",
			"Content-Type: text/html; charset=utf-8",
			"",
			html,
		].join("\r\n");

		const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
			method: "POST",
			headers: { authorization: `Bearer ${tokenJson.access_token}`, "content-type": "application/json" },
			body: JSON.stringify({ raw: b64url(mime) }),
		});
		if (!sendRes.ok) {
			const detail = await sendRes.text().catch(() => "");
			return Response.json({ error: "send_failed", detail: detail.slice(0, 200) }, { status: 502 });
		}
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: "exception", detail: String(e).slice(0, 200) }, { status: 500 });
	}
}
