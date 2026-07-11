import { readAdmin } from "@/lib/admin";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/send-code { to, name, code } — email a subscription code. Admin only.
 *
 * Two supported providers (checked in order):
 *   1. Gmail via App Password + SMTP over Cloudflare's raw TCP socket (`cloudflare:sockets`).
 *      Env: GMAIL_USER, GMAIL_APP_PASSWORD (a 16-char Google App Password; requires 2FA on the account).
 *      NOTE: this path runs ONLY on the deployed Cloudflare Worker — `cloudflare:sockets` is not
 *      available under local `next dev`, so email can only be tested on the live site.
 *   2. Gmail REST API via OAuth2. Env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER.
 *
 * If neither is configured (or the send fails), returns non-200 and the admin UI falls back to
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

function subjectLine(): string {
	return "Your AIQTrader access code";
}
function htmlBody(name: string, code: string): string {
	return (
		`<p>Hi ${name},</p>` +
		`<p>Your AIQTrader subscription code is:</p>` +
		`<p style="font-size:20px;font-weight:bold;letter-spacing:1px">${code}</p>` +
		`<p>Enter it on the sign-in page to unlock your dashboard.</p>` +
		`<p style="color:#888;font-size:12px">Educational analysis, not financial advice.</p>`
	);
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

// ── Gmail SMTP over Cloudflare TCP socket (App Password) ─────────────────────
async function sendViaSmtp(user: string, appPassword: string, to: string, subject: string, html: string): Promise<void> {
	// Dynamic import so plain `next dev` (Node) doesn't choke on the cloudflare-only module.
	const { connect } = (await import("cloudflare:sockets")) as typeof import("cloudflare:sockets");
	const socket = connect({ hostname: "smtp.gmail.com", port: 465 }, { secureTransport: "on", allowHalfOpen: false });

	const writer = socket.writable.getWriter();
	const reader = socket.readable.getReader();
	const enc = new TextEncoder();
	const dec = new TextDecoder();

	async function read(expect: string): Promise<void> {
		let buf = "";
		for (;;) {
			const { value, done } = await reader.read();
			if (value) buf += dec.decode(value, { stream: true });
			const lines = buf.split("\r\n").filter(Boolean);
			const last = lines[lines.length - 1] ?? "";
			if (/^\d{3} /.test(last)) {
				if (!last.startsWith(expect)) throw new Error(`SMTP expected ${expect}, got: ${last}`);
				return;
			}
			if (done) throw new Error(`SMTP stream ended; buffer: ${buf.slice(0, 120)}`);
		}
	}
	const write = (s: string) => writer.write(enc.encode(s + "\r\n"));
	const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

	try {
		await read("220"); // greeting
		await write("EHLO aiqtrader"); await read("250");
		await write("AUTH LOGIN"); await read("334");
		await write(b64(user)); await read("334");
		await write(b64(appPassword.replace(/\s+/g, ""))); await read("235"); // app passwords are shown with spaces
		await write(`MAIL FROM:<${user}>`); await read("250");
		await write(`RCPT TO:<${to}>`); await read("250");
		await write("DATA"); await read("354");
		// dot-stuff any line beginning with '.' per RFC 5321, then terminate with <CRLF>.<CRLF>
		const data = buildMime(user, to, subject, html).replace(/\r\n\./g, "\r\n..");
		await write(data + "\r\n."); await read("250");
		await write("QUIT");
	} finally {
		try {
			await writer.close();
		} catch {
			/* ignore */
		}
	}
}

// ── Gmail REST API via OAuth2 ────────────────────────────────────────────────
async function sendViaOAuth(
	clientId: string,
	clientSecret: string,
	refreshToken: string,
	sender: string,
	to: string,
	subject: string,
	html: string,
): Promise<void> {
	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
	});
	const token = (await tokenRes.json()) as { access_token?: string };
	if (!tokenRes.ok || !token.access_token) throw new Error("oauth_failed");
	const raw = btoa(unescape(encodeURIComponent(buildMime(sender, to, subject, html))))
		.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
		method: "POST",
		headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
		body: JSON.stringify({ raw }),
	});
	if (!res.ok) throw new Error("send_failed: " + (await res.text().catch(() => "")).slice(0, 160));
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

	const subject = subjectLine();
	const html = htmlBody(name, code);

	const gUser = env("GMAIL_USER");
	const gPass = env("GMAIL_APP_PASSWORD");
	const clientId = env("GMAIL_CLIENT_ID");

	try {
		if (gUser && gPass) {
			await sendViaSmtp(gUser, gPass, to, subject, html);
			return Response.json({ ok: true, via: "smtp" });
		}
		if (clientId) {
			await sendViaOAuth(
				clientId,
				env("GMAIL_CLIENT_SECRET") ?? "",
				env("GMAIL_REFRESH_TOKEN") ?? "",
				env("GMAIL_SENDER") ?? gUser ?? "",
				to,
				subject,
				html,
			);
			return Response.json({ ok: true, via: "oauth" });
		}
		return Response.json({ error: "email_not_configured" }, { status: 501 });
	} catch (e) {
		return Response.json({ error: "send_failed", detail: String(e).slice(0, 200) }, { status: 502 });
	}
}
