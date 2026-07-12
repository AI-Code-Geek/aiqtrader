"use client";

/**
 * Admin console — manage access requests and users. Admin-gated by the page (and every /api/admin route).
 * Flow: a visitor submits /request-access → it appears here as "pending" → admin generates a code with a
 * chosen validity → the code is shown for manual sharing (or emailed, if Gmail is configured).
 */
import { useCallback, useEffect, useState } from "react";
import type { AccessRequest, Tier, UserRecord, UserStatus } from "@/lib/user-types";
import { AdminFeedbackClient } from "./AdminFeedbackClient";

const PERSONAS = ["swing", "day", "scalp"] as const;
const VALIDITY_PRESETS: { label: string; days: number }[] = [
	{ label: "Perpetual", days: 0 },
	{ label: "1 week", days: 7 },
	{ label: "1 month", days: 30 },
	{ label: "3 months", days: 90 },
	{ label: "Custom…", days: -1 },
];

type Tab = "requests" | "users" | "feedback";

export function AdminClient({ adminName }: { adminName: string }) {
	const [tab, setTab] = useState<Tab>("requests");
	return (
		<div className="mx-auto max-w-5xl px-4 py-6">
			<div className="mb-4 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Admin</h1>
				<span className="text-sm text-muted">signed in as {adminName}</span>
			</div>
			<div className="mb-4 flex gap-1 border-b border-border">
				{(["requests", "users", "feedback"] as Tab[]).map((t) => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={`rounded-t-md px-4 py-2 text-sm capitalize ${t === tab ? "border-b-2 border-brand font-semibold text-foreground" : "text-muted hover:text-foreground"}`}
					>
						{t}
					</button>
				))}
			</div>
			{tab === "requests" ? <RequestsTab /> : tab === "users" ? <UsersTab /> : <AdminFeedbackClient />}
		</div>
	);
}

// ── Requests ────────────────────────────────────────────────────────────────
function RequestsTab() {
	const [reqs, setReqs] = useState<AccessRequest[] | null>(null);
	const load = useCallback(() => {
		fetch("/api/admin/requests")
			.then((r) => r.json() as Promise<{ requests?: AccessRequest[] }>)
			.then((d) => setReqs(d.requests ?? []))
			.catch(() => setReqs([]));
	}, []);
	useEffect(load, [load]);

	if (reqs === null) return <p className="text-muted">Loading…</p>;
	if (!reqs.length) return <p className="text-muted">No access requests yet.</p>;

	const pending = reqs.filter((r) => r.status === "pending");
	const done = reqs.filter((r) => r.status !== "pending");

	return (
		<div className="space-y-6">
			<section>
				<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pending ({pending.length})</h2>
				{pending.length ? (
					<div className="space-y-3">
						{pending.map((r) => (
							<RequestRow key={r.id} req={r} onDone={load} />
						))}
					</div>
				) : (
					<p className="text-sm text-muted">Nothing pending.</p>
				)}
			</section>
			{done.length ? (
				<section>
					<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Handled ({done.length})</h2>
					<div className="space-y-2">
						{done.map((r) => (
							<div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface p-3 text-sm">
								<span className="font-medium">{r.name}</span>
								<span className="text-muted">{r.email}</span>
								<span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs capitalize">{r.plan}</span>
								<span className={`text-xs ${r.status === "fulfilled" ? "text-long" : "text-short"}`}>{r.status}</span>
								{r.code ? <CodePill code={r.code} email={r.email} name={r.name} /> : null}
								<span className="ml-auto">
									<DeleteButton onConfirm={() => requestAction(r.id, "delete").then(load)} />
								</span>
							</div>
						))}
					</div>
				</section>
			) : null}
		</div>
	);
}

/** A Delete control with an inline Confirm/Cancel step (avoids one-click accidents). */
function DeleteButton({ onConfirm, label = "Delete" }: { onConfirm: () => void | Promise<void>; label?: string }) {
	const [confirm, setConfirm] = useState(false);
	const [busy, setBusy] = useState(false);
	if (confirm) {
		return (
			<span className="inline-flex items-center gap-1">
				<button
					disabled={busy}
					onClick={async () => { setBusy(true); await onConfirm(); }}
					className="rounded-md bg-short px-2 py-1 text-xs font-medium text-white"
				>
					Confirm
				</button>
				<button onClick={() => setConfirm(false)} className="rounded-md border border-border px-2 py-1 text-xs">Cancel</button>
			</span>
		);
	}
	return (
		<button onClick={() => setConfirm(true)} className="rounded-md border border-short/40 px-2 py-1 text-xs text-short">
			{label}
		</button>
	);
}

async function requestAction(id: string, action: "deny" | "delete") {
	await fetch("/api/admin/request-action", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ id, action }),
	}).catch(() => {});
}

function RequestRow({ req, onDone }: { req: AccessRequest; onDone: () => void }) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [minted, setMinted] = useState<{ code: string; name: string; email: string } | null>(null);

	async function act(action: "deny" | "delete") {
		setBusy(true);
		await requestAction(req.id, action);
		setBusy(false);
		onDone();
	}

	if (minted) {
		return (
			<div className="rounded-xl border border-long/30 bg-long/[0.06] p-4">
				<div className="text-sm">
					Code generated for <b>{minted.name}</b> ({minted.email}):
				</div>
				<div className="mt-2">
					<CodePill code={minted.code} email={minted.email} name={minted.name} big />
				</div>
			</div>
		);
	}
	return (
		<div className="rounded-xl border border-border bg-surface p-4">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<span className="font-medium">{req.name}</span>
				<span className="text-muted">{req.email}</span>
				<span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs capitalize">{req.plan}</span>
				{req.persona ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs capitalize">{req.persona}</span> : null}
				<span className="text-xs text-muted">{new Date(req.createdAt).toLocaleDateString()}</span>
				<div className="ml-auto flex items-center gap-1.5">
					<button
						onClick={() => setOpen((o) => !o)}
						className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white"
					>
						{open ? "Cancel" : "Generate code"}
					</button>
					<button disabled={busy} onClick={() => act("deny")} className="rounded-md border border-watch/40 px-2 py-1 text-xs text-watch">
						Deny
					</button>
					<DeleteButton onConfirm={() => act("delete")} />
				</div>
			</div>
			{req.note ? <p className="mt-1 text-xs text-muted">“{req.note}”</p> : null}
			{open ? (
				<MintForm
					defaults={{ tier: req.plan, persona: req.persona }}
					reqId={req.id}
					onMinted={(code) => {
						setMinted({ code, name: req.name, email: req.email });
						onDone();
					}}
				/>
			) : null}
		</div>
	);
}

// ── Users ───────────────────────────────────────────────────────────────────
type DeliveryStatus = "sent" | "not_sent";
const deliveryOf = (u: UserRecord): DeliveryStatus =>
	(u as { delivery?: string }).delivery === "sent" ? "sent" : "not_sent";

/** Export a set of users as a downloaded JSON file (code-delivery fields included for your mailer). */
function exportUsersJson(list: UserRecord[], filename: string) {
	const rows = list.map((u) => ({
		name: u.name,
		email: u.email,
		code: u.code,
		tier: u.tier,
		status: u.status,
		validity: u.validity,
		persona: (u as { defaultPersona?: string }).defaultPersona ?? null,
		delivery: deliveryOf(u),
	}));
	const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function UsersTab() {
	const [users, setUsers] = useState<UserRecord[] | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [sel, setSel] = useState<Set<string>>(new Set());
	const load = useCallback(() => {
		fetch("/api/admin/users")
			.then((r) => r.json() as Promise<{ users?: UserRecord[] }>)
			.then((d) => setUsers(d.users ?? []))
			.catch(() => setUsers([]));
	}, []);
	useEffect(load, [load]);

	const toggle = (id: string) =>
		setSel((s) => {
			const n = new Set(s);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	const allChecked = !!users?.length && users.every((u) => sel.has(u.userid));
	const toggleAll = () => setSel(allChecked ? new Set() : new Set((users ?? []).map((u) => u.userid)));

	const notSent = (users ?? []).filter((u) => deliveryOf(u) === "not_sent");
	const selected = (users ?? []).filter((u) => sel.has(u.userid));
	const stamp = new Date().toISOString().slice(0, 10);

	return (
		<div>
			<div className="mb-3 flex flex-wrap items-center justify-end gap-2">
				<button onClick={() => users && exportUsersJson(users, `users-all-${stamp}.json`)} className="rounded-md border border-border px-3 py-1.5 text-sm">
					Export all ({users?.length ?? 0})
				</button>
				<button
					disabled={!selected.length}
					onClick={() => exportUsersJson(selected, `users-selected-${stamp}.json`)}
					className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
				>
					Export selected ({selected.length})
				</button>
				<button
					disabled={!notSent.length}
					onClick={() => exportUsersJson(notSent, `users-not-sent-${stamp}.json`)}
					className="rounded-md border border-watch/50 px-3 py-1.5 text-sm text-watch disabled:opacity-50"
					title="Users whose code hasn't been emailed yet — feed this into your local mailer"
				>
					Export not-sent ({notSent.length})
				</button>
				<button onClick={() => setShowCreate((s) => !s)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white">
					{showCreate ? "Close" : "+ New code"}
				</button>
			</div>
			{showCreate ? (
				<div className="mb-4 rounded-xl border border-border bg-surface p-4">
					<AdHocCreate onDone={load} />
				</div>
			) : null}

			{users === null ? (
				<p className="text-muted">Loading…</p>
			) : !users.length ? (
				<p className="text-muted">No users.</p>
			) : (
				<div className="overflow-x-auto rounded-xl border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
							<tr>
								<th className="p-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
								<th className="p-2">Name</th>
								<th className="p-2">Email</th>
								<th className="p-2">Code</th>
								<th className="p-2">Tier</th>
								<th className="p-2">Status</th>
								<th className="p-2">Validity</th>
								<th className="p-2">Delivery</th>
								<th className="p-2 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => (
								<UserRow key={u.userid} user={u} onChange={load} selected={sel.has(u.userid)} onToggle={() => toggle(u.userid)} />
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

const EXTEND_OPTIONS: { label: string; days: number }[] = [
	{ label: "+1 week", days: 7 },
	{ label: "+1 month", days: 30 },
	{ label: "+3 months", days: 90 },
	{ label: "Perpetual", days: 0 },
];

function UserRow({
	user,
	onChange,
	selected,
	onToggle,
}: {
	user: UserRecord;
	onChange: () => void;
	selected: boolean;
	onToggle: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const [confirmDel, setConfirmDel] = useState(false);

	async function post(path: string, payload: Record<string, unknown>) {
		setBusy(true);
		await fetch(path, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ userid: user.userid, ...payload }),
		}).catch(() => {});
		setBusy(false);
		onChange();
	}
	const setStatus = (status: UserStatus) => post("/api/admin/user-status", { status });
	const extend = (days: number) => post("/api/admin/user-status", { extendDays: days });
	const setDelivery = (delivery: DeliveryStatus) => post("/api/admin/user-status", { delivery });
	const del = () => post("/api/admin/user-delete", {});

	const expired = user.validity && Date.parse(user.validity) < Date.now();
	const delivery = deliveryOf(user);
	return (
		<tr className="border-t border-border">
			<td className="p-2"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${user.name}`} /></td>
			<td className="p-2 font-medium">{user.name}</td>
			<td className="p-2 text-muted">{user.email}</td>
			<td className="p-2"><CodePill code={user.code} email={user.email} name={user.name} /></td>
			<td className="p-2 capitalize">{user.tier}</td>
			<td className={`p-2 capitalize ${user.status === "active" && !expired ? "text-long" : "text-short"}`}>
				{expired ? "expired" : user.status}
			</td>
			<td className="p-2 text-muted">{user.validity ? new Date(user.validity).toLocaleDateString() : "perpetual"}</td>
			<td className="p-2">
				<select
					value={delivery}
					disabled={busy}
					onChange={(e) => setDelivery(e.target.value as DeliveryStatus)}
					className={`rounded border border-border bg-surface px-1 py-1 text-xs ${delivery === "sent" ? "text-long" : "text-watch"}`}
					title="Code-delivery status (you set this after emailing the code)"
				>
					<option value="not_sent">Not sent</option>
					<option value="sent">Sent</option>
				</select>
			</td>
			<td className="p-2">
				<div className="flex items-center justify-end gap-1.5">
					{user.status === "suspended" ? (
						<button disabled={busy} onClick={() => setStatus("active")} className="rounded border border-border px-2 py-1 text-xs text-long">Activate</button>
					) : (
						<button disabled={busy} onClick={() => setStatus("suspended")} className="rounded border border-border px-2 py-1 text-xs text-short">Suspend</button>
					)}
					<select
						disabled={busy}
						value=""
						onChange={(e) => { if (e.target.value !== "") extend(Number(e.target.value)); e.target.value = ""; }}
						className="rounded border border-border bg-surface px-1 py-1 text-xs text-muted"
						title="Extend expiry"
					>
						<option value="">Extend…</option>
						{EXTEND_OPTIONS.map((o) => <option key={o.label} value={o.days}>{o.label}</option>)}
					</select>
					{confirmDel ? (
						<span className="flex items-center gap-1">
							<button disabled={busy} onClick={del} className="rounded bg-short px-2 py-1 text-xs font-medium text-white">Confirm</button>
							<button onClick={() => setConfirmDel(false)} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>
						</span>
					) : (
						<button disabled={busy} onClick={() => setConfirmDel(true)} className="rounded border border-short/40 px-2 py-1 text-xs text-short">Delete</button>
					)}
				</div>
			</td>
		</tr>
	);
}

function AdHocCreate({ onDone }: { onDone: () => void }) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [minted, setMinted] = useState<{ code: string; name: string; email: string } | null>(null);

	if (minted) {
		return (
			<div>
				<div className="text-sm">Code for <b>{minted.name}</b> ({minted.email}):</div>
				<div className="mt-2"><CodePill code={minted.code} email={minted.email} name={minted.name} big /></div>
				<button onClick={() => { setMinted(null); setName(""); setEmail(""); onDone(); }} className="mt-3 text-sm text-brand">+ Another</button>
			</div>
		);
	}
	return (
		<div>
			<div className="grid gap-2 sm:grid-cols-2">
				<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
				<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
			</div>
			<MintForm defaults={{ tier: "pro" }} name={name} email={email} onMinted={(code) => setMinted({ code, name, email })} />
		</div>
	);
}

// ── Shared: mint form (tier · persona · validity) ────────────────────────────
function MintForm({
	defaults,
	reqId,
	name,
	email,
	onMinted,
}: {
	defaults: { tier?: Tier; persona?: string };
	reqId?: string;
	name?: string;
	email?: string;
	onMinted: (code: string) => void;
}) {
	const [tier, setTier] = useState<Tier>(defaults.tier ?? "pro");
	const [persona, setPersona] = useState(defaults.persona ?? "swing");
	const [preset, setPreset] = useState(0); // index into VALIDITY_PRESETS
	const [customDays, setCustomDays] = useState(14);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const p = VALIDITY_PRESETS[preset];
	const validityDays = p.days === -1 ? customDays : p.days;

	async function submit() {
		setError("");
		setBusy(true);
		const res = await fetch("/api/admin/mint", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ reqId, name, email, tier, persona, validityDays }),
		});
		setBusy(false);
		const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
		if (!res.ok || !data.code) return setError(data.error ?? "Failed to generate code.");
		onMinted(data.code);
	}

	return (
		<div className="mt-3 grid gap-2 rounded-lg bg-surface-2 p-3 sm:grid-cols-4">
			<label className="text-xs text-muted">
				Tier
				<select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm">
					<option value="pro">pro</option>
					<option value="free">free</option>
				</select>
			</label>
			<label className="text-xs text-muted">
				Persona
				<select value={persona} onChange={(e) => setPersona(e.target.value)} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm">
					{PERSONAS.map((pp) => <option key={pp} value={pp}>{pp}</option>)}
				</select>
			</label>
			<label className="text-xs text-muted">
				Validity
				<select value={preset} onChange={(e) => setPreset(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm">
					{VALIDITY_PRESETS.map((v, i) => <option key={v.label} value={i}>{v.label}</option>)}
				</select>
			</label>
			{p.days === -1 ? (
				<label className="text-xs text-muted">
					Days
					<input type="number" min={1} value={customDays} onChange={(e) => setCustomDays(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm" />
				</label>
			) : (
				<div className="flex items-end">
					<span className="text-xs text-muted">{validityDays === 0 ? "never expires" : `expires in ${validityDays}d`}</span>
				</div>
			)}
			<div className="sm:col-span-4">
				{error ? <p className="mb-2 text-xs text-short">{error}</p> : null}
				<button onClick={submit} disabled={busy} className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
					{busy ? "Generating…" : "Generate & show code"}
				</button>
			</div>
		</div>
	);
}

// ── Shared: code pill (copy + optional email) ────────────────────────────────
function CodePill({ code, email, name, big }: { code: string; email: string; name: string; big?: boolean }) {
	const [copied, setCopied] = useState(false);
	const [emailState, setEmailState] = useState<"" | "sending" | "sent" | "failed">("");

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* clipboard blocked */
		}
	}
	async function sendEmail() {
		setEmailState("sending");
		const res = await fetch("/api/admin/send-code", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ to: email, name, code }),
		}).catch(() => null);
		setEmailState(res && res.ok ? "sent" : "failed");
	}

	return (
		<span className="inline-flex items-center gap-2">
			<code className={`mono rounded bg-surface-2 px-2 py-0.5 ${big ? "text-lg font-semibold" : "text-sm"}`}>{code}</code>
			<button onClick={copy} className="rounded border border-border px-2 py-0.5 text-xs">{copied ? "Copied!" : "Copy"}</button>
			<button onClick={sendEmail} disabled={emailState === "sending"} className="rounded border border-border px-2 py-0.5 text-xs">
				{emailState === "sending" ? "Sending…" : emailState === "sent" ? "Emailed ✓" : emailState === "failed" ? "Email failed — copy" : "Email"}
			</button>
		</span>
	);
}
