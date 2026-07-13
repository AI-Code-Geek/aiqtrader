import type { NextConfig } from "next";

// Security headers applied to every route. NOTE on CSP: this app is SSG-heavy (report/symbol pages use
// generateStaticParams), and a nonce-based CSP would force every page to render dynamically (a nonce is
// per-request). So we use an SSG-compatible policy: script-src stays 'self' + 'unsafe-inline' (needed for
// Next's inline bootstrap + the theme script), but everything else is locked down — no external scripts,
// no framing, no plugins, forms/base restricted to self. Combined with React's auto-escaping and the fact
// that the app renders NO user-supplied HTML, this is solid defense-in-depth. Upgrade to nonce-CSP only if
// the app moves off SSG. Dev additionally needs 'unsafe-eval' + ws: for React Fast Refresh / HMR.
const isProd = process.env.NODE_ENV === "production";

const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	`connect-src 'self'${isProd ? "" : " ws: wss:"}`,
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: csp },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
	...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
