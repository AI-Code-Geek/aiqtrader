import { readAdmin } from "@/lib/admin";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/send-code { to, name, code } — email a subscription code. Admin only.
 *
 * EMAIL IS CURRENTLY OFF for App-Password/SMTP: sending Gmail over raw SMTP needs the Cloudflare TCP
 * sockets module, which OpenNext's esbuild bundler can't resolve at build time (breaks the deploy build).
 * So the SMTP path is disabled. The only build-safe provider is the fetch-based Gmail OAuth2 API below;
 * when it isn't configured we return 501 and the admin UI falls back to "copy the code and share manually".
 *
 * To turn email back on WITHOUT breaking the build, the reliable option on Cloudflare is a transactional
 * relay called over `fetch` (e.g. Resend/Brevo) — no sockets. Ask and it can be wired as the primary.
 *
 * OAuth2 env (optional): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER.
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

function buildMime(from: string, to: string, subject: string, html: string): string {
	return [
		`From: <${from}>`,
		`To: <${to}>`,
		`Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=utf-8",
		"",
		html,
	].join("\r\n");
}

async function sendViaOAuth(to: string, subject: string, html: string): Promise<void> {
	const clientId = env("GMAIL_CLIENT_ID")!;
	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: env("GMAIL_CLIENT_SECRET") ?? "",
			refresh_token: env("GMAIL_REFRESH_TOKEN") ?? "",
			grant_type: "refresh_token",
		}),
	});
	const token = (await tokenRes.json()) as { access_token?: string };
	if (!tokenRes.ok || !token.access_token) throw new Error("oauth_failed");
	const sender = env("GMAIL_SENDER") ?? env("GMAIL_USER") ?? "";
	const raw = btoa(unescape(encodeURIComponent(buildMime(sender, to, subject, html))))
		.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
		method: "POST",
		headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
		body: JSON.stringify({ raw }),
	});
	if (!res.ok) throw new Error("send_failed");
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

	// Only the fetch-based OAuth2 provider is build-safe. No provider configured → tell the UI to fall back.
	if (!env("GMAIL_CLIENT_ID")) return Response.json({ error: "email_disabled" }, { status: 501 });

	const subject = "Your AIQTrader access code";
	const html =
		`<p>Hi ${name},</p>` +
		`<p>Your AIQTrader subscription code is:</p>` +
		`<p style="font-size:20px;font-weight:bold;letter-spacing:1px">${code}</p>` +
		`<p>Enter it on the sign-in page to unlock your dashboard.</p>` +
		`<p style="color:#888;font-size:12px">Educational analysis, not financial advice.</p>`;

	try {
		await sendViaOAuth(to, subject, html);
		return Response.json({ ok: true, via: "oauth" });
	} catch (e) {
		return Response.json({ error: "send_failed", detail: String(e).slice(0, 160) }, { status: 502 });
	}
}
