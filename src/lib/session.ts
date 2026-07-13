/**
 * Stateless signed-cookie session (DEVPLAN §4). The cookie is self-verifying: HMAC-SHA256 over the
 * payload with env SECRET, so the middleware guard needs NO KV read per request. Uses Web Crypto
 * (crypto.subtle) which is available in both the Edge middleware runtime and the Cloudflare Worker.
 */
import type { Session } from "./user-types";

export const SESSION_COOKIE = "aiq_session";
/** Default session lifetime when the subscription has no earlier `validity`. */
export const SESSION_MAX_SECONDS = 60 * 60 * 24 * 14; // 14 days

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
	const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
	const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
	const out = new Uint8Array(new ArrayBuffer(bin.length));
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
		"verify",
	]);
}

/** Sign a session into a `<payload>.<sig>` token (both base64url). */
export async function signSession(session: Session, secret: string): Promise<string> {
	// Fail closed: never sign with an empty/missing secret (would otherwise be forgeable).
	if (!secret) throw new Error("SECRET is not configured — refusing to sign a session");
	const data = b64urlEncode(encoder.encode(JSON.stringify(session)));
	const key = await hmacKey(secret);
	const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
	return `${data}.${b64urlEncode(sig)}`;
}

/**
 * Verify a token and return the Session, or `null` if the signature is bad, the token is malformed,
 * or it has expired. Signature check is constant-time (crypto.subtle.verify).
 */
export async function verifySession(token: string | undefined | null, secret: string): Promise<Session | null> {
	if (!token) return null;
	if (!secret) return null; // fail closed: no secret configured → no valid session
	const dot = token.indexOf(".");
	if (dot < 0) return null;
	const data = token.slice(0, dot);
	const sigStr = token.slice(dot + 1);
	try {
		const key = await hmacKey(secret);
		const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigStr), encoder.encode(data));
		if (!ok) return null;
		const session = JSON.parse(new TextDecoder().decode(b64urlDecode(data))) as Session;
		if (typeof session.exp !== "number" || session.exp * 1000 < Date.now()) return null;
		return session;
	} catch {
		return null;
	}
}

/**
 * Signing secret — the bound env var ONLY (Worker: env.SECRET → process.env.SECRET via OpenNext;
 * `.dev.vars` / `.env.local` for local dev). There is deliberately NO fallback default: if SECRET is
 * unset this returns "" and the app fails closed — signSession() throws and verifySession() returns null,
 * so a session is NEVER signed or accepted with a public/known key. Set SECRET in every environment.
 */
export function resolveSecret(envSecret?: string): string {
	return envSecret || process.env.SECRET || "";
}
