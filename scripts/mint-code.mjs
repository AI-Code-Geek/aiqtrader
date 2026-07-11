/**
 * Admin: mint OFFLINE subscription codes from access requests (DEVPLAN §6).
 *
 * Visitors submit /request-access → a pending record lands in KV (`req:<id>`, listed in `idx:reqs`).
 * This script lets an admin review those requests and mint a code + user record — no self-serve access.
 *
 * Usage (run from aiqtrader-next-js/):
 *   node scripts/mint-code.mjs list [--local]                       # list access requests
 *   node scripts/mint-code.mjs mint --req <id> [--tier pro] [opts]  # mint for a stored request
 *   node scripts/mint-code.mjs mint --name "Jane" --email j@x.com [--tier pro] [opts]
 *
 * Options: --local (miniflare KV) | --remote (default, prod), --validity <ISO|null>,
 *          --schedules 1,2, --dry-run (print, write nothing), --no-seed (skip users.seed.json append).
 *
 * Requires a working `wrangler` (auth for --remote: `wrangler login`).
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "users.seed.json");

// ── args ──
const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Map();
for (let i = 1; i < argv.length; i++) {
	if (argv[i].startsWith("--")) {
		const key = argv[i].slice(2);
		const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
		flags.set(key, val);
	}
}
const scope = flags.get("local") === "true" ? "--local" : "--remote";
const dryRun = flags.get("dry-run") === "true";

const codeIndexKey = (code) => `idx:code:${String(code).trim().toUpperCase()}`;

// ── wrangler kv helpers ──
function kvGet(key) {
	const r = spawnSync("wrangler", ["kv", "key", "get", "--binding", "KV", scope, key], {
		encoding: "utf-8",
		shell: true,
	});
	if (r.status !== 0) return null; // key-not-found returns nonzero
	return r.stdout?.trim() || null;
}
function kvPut(key, value) {
	if (dryRun) {
		console.log(`  [dry] wrangler kv key put --binding KV ${scope} ${key} '<value>'`);
		return;
	}
	const r = spawnSync("wrangler", ["kv", "key", "put", "--binding", "KV", scope, key, value], {
		stdio: "inherit",
		shell: true,
	});
	if (r.status !== 0) {
		console.error(`✗ failed to put ${key}`);
		process.exit(r.status ?? 1);
	}
}

// ── code / id generation ──
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1 (avoid ambiguity)
function block(n = 4) {
	const b = randomBytes(n);
	let s = "";
	for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
	return s;
}
const genCode = () => `AIQ-${block()}-${block()}`;
const genUserId = () => `u_${randomBytes(3).toString("hex")}`;

function listRequests() {
	const ids = JSON.parse(kvGet("idx:reqs") ?? "[]");
	if (!ids.length) {
		console.log("[mint-code] no access requests found.");
		return [];
	}
	const reqs = ids
		.map((id) => {
			const raw = kvGet(`req:${id}`);
			return raw ? JSON.parse(raw) : null;
		})
		.filter(Boolean)
		.reverse();
	for (const r of reqs) {
		const tag = r.status === "pending" ? "•" : r.status === "fulfilled" ? "✓" : "✗";
		console.log(`${tag} ${r.id}  ${r.status.padEnd(9)} ${r.plan.padEnd(4)} ${r.name} <${r.email}>${r.code ? `  → ${r.code}` : ""}`);
		if (r.note) console.log(`    note: ${r.note}`);
	}
	return reqs;
}

async function mint() {
	let req = null;
	let name = flags.get("name");
	let email = flags.get("email");
	let tier = flags.get("tier") || "pro";

	const reqId = flags.get("req");
	if (reqId) {
		const raw = kvGet(`req:${reqId}`);
		if (!raw) return console.error(`✗ request ${reqId} not found`);
		req = JSON.parse(raw);
		name = name || req.name;
		email = email || req.email;
		if (!flags.has("tier")) tier = req.plan || "pro";
	}

	// Persona (report stream) — from --persona, else the request's captured persona, else swing.
	const PERSONAS = ["swing", "day", "scalp"];
	const personaRaw = flags.get("persona") || req?.persona || "swing";
	const defaultPersona = PERSONAS.includes(personaRaw) ? personaRaw : "swing";
	if (!name || !email) {
		return console.error("✗ need --req <id>, or both --name and --email");
	}

	const validityRaw = flags.get("validity");
	const validity = validityRaw && validityRaw !== "null" ? validityRaw : null;
	const schedules = (flags.get("schedules") || "1").split(",").map((s) => Number(s.trim())).filter(Number.isFinite);

	const user = {
		userid: genUserId(),
		name,
		email,
		code: genCode(),
		status: "active",
		validity,
		tier: tier === "free" ? "free" : "pro",
		schedules: schedules.length ? schedules : [1],
		defaultPersona,
		myList: [],
		createdAt: new Date().toISOString(),
	};

	console.log(`[mint-code] ${dryRun ? "DRY RUN — " : ""}minting for ${name} <${email}> (${user.tier})`);
	kvPut(user.userid, JSON.stringify(user));
	kvPut(codeIndexKey(user.code), user.userid);

	// Mark the request fulfilled.
	if (req && !dryRun) {
		req.status = "fulfilled";
		req.fulfilledAt = new Date().toISOString();
		req.code = user.code;
		kvPut(`req:${req.id}`, JSON.stringify(req));
	}

	// Append to users.seed.json so prod re-seeds deterministically (unless --no-seed / dry-run).
	if (flags.get("no-seed") !== "true" && !dryRun) {
		try {
			const seed = JSON.parse(await readFile(seedPath, "utf-8"));
			seed.push(user);
			await writeFile(seedPath, JSON.stringify(seed, null, "\t") + "\n");
			console.log("  appended to scripts/users.seed.json");
		} catch (e) {
			console.warn(`  (could not update users.seed.json: ${e.message})`);
		}
	}

	console.log("\n────────────────────────────────────────");
	console.log(`  CODE:  ${user.code}`);
	console.log(`  user:  ${user.userid}   tier: ${user.tier}   validity: ${user.validity ?? "perpetual"}`);
	console.log("────────────────────────────────────────");
	console.log(`  Email this code to ${email}; they redeem it on the sign-in page.`);
}

if (cmd === "list") {
	listRequests();
} else if (cmd === "mint") {
	await mint();
} else {
	console.log("Usage:");
	console.log("  node scripts/mint-code.mjs list [--local]");
	console.log("  node scripts/mint-code.mjs mint --req <id> [--tier pro] [--local] [--dry-run]");
	console.log("  node scripts/mint-code.mjs mint --name \"Jane\" --email j@x.com [--tier pro]");
	process.exit(cmd ? 1 : 0);
}
