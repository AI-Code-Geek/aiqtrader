/** Display formatters. UI-only — no business logic. */

export const money = (n: number | null | undefined): string =>
	n == null ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (n: number | null | undefined): string =>
	n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

export const num = (n: number | null | undefined, d = 2): string => (n == null ? "—" : n.toFixed(d));

export const mult = (n: number | null | undefined): string => (n == null ? "—" : `${n.toFixed(2)}×`);

export const time = (iso: string): string =>
	new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
