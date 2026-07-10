/**
 * Provision the KV user records from scripts/users.seed.json (DEVPLAN §3–§4).
 *
 * For each user it writes two keys via `wrangler kv key put --binding KV`:
 *   <userid>          -> the UserRecord JSON
 *   idx:code:<CODE>   -> "<userid>"   (uppercased; the redeem-by-code index)
 *
 * Usage (run from aiqtrader-next-js/):
 *   node scripts/seed-users.mjs            # PRODUCTION (remote namespace in wrangler.jsonc)
 *   node scripts/seed-users.mjs --local    # local miniflare KV (for `next dev` / `wrangler dev`)
 *   node scripts/seed-users.mjs --dry-run  # print the commands, write nothing
 *
 * Requires a working `wrangler` (needs auth for --remote: `wrangler login`).
 */
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const scope = args.has("--local") ? "--local" : "--remote";

const codeIndexKey = (code) => `idx:code:${String(code).trim().toUpperCase()}`;

function put(key, value) {
	const cmd = ["wrangler", "kv", "key", "put", "--binding", "KV", scope, key, value];
	if (dryRun) {
		console.log(`  ${cmd.slice(0, -1).join(" ")} '<value>'`);
		return;
	}
	const r = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", shell: true });
	if (r.status !== 0) {
		console.error(`✗ failed to put ${key}`);
		process.exit(r.status ?? 1);
	}
}

const users = JSON.parse(await readFile(join(here, "users.seed.json"), "utf-8"));
console.log(`[seed-users] ${dryRun ? "DRY RUN — " : ""}seeding ${users.length} users into KV (${scope})`);
for (const u of users) {
	console.log(`• ${u.name} <${u.code}> -> ${u.userid}`);
	put(u.userid, JSON.stringify(u));
	put(codeIndexKey(u.code), u.userid);
}
console.log("[seed-users] done.");
