"use client";

import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ComposedChart,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { Bar as OHLC } from "@/lib/report-types";
import { rsi, macd } from "@/lib/indicators";

/**
 * Sub-panels (recharts), plotted BY ARRAY INDEX from the SAME bar set as the candles (CLAUDE.md #9).
 * Volume is real; RSI/MACD are derived DISPLAY-ONLY (see indicators.ts) and never feed a decision.
 * Warm-up bars carry `null` so the index alignment with the candlestick chart is preserved.
 */
export function IndicatorPanels({ bars, intraday }: { bars: OHLC[]; intraday: boolean }) {
	const data = useMemo(() => {
		const r = rsi(bars);
		const m = macd(bars);
		return bars.map((b, i) => ({
			i,
			label: new Date(b.ts).toLocaleString([], intraday
				? { month: "short", day: "numeric", hour: "2-digit" }
				: { month: "short", day: "numeric" }),
			vol: b.v,
			up: b.c >= b.o,
			rsi: r[i],
			macd: m[i].macd,
			signal: m[i].signal,
			hist: m[i].hist,
		}));
	}, [bars, intraday]);

	const axis = { stroke: "var(--muted)", fontSize: 10 };
	const grid = <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />;
	const xa = <XAxis dataKey="i" hide />;

	return (
		<div className="space-y-2">
			<Panel title="Volume">
				<ResponsiveContainer width="100%" height={90}>
					<BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
						{grid}
						{xa}
						<YAxis {...axis} width={48} tickFormatter={(v) => compact(v as number)} />
						<Tooltip content={<Tip intraday={intraday} />} />
						<Bar dataKey="vol" isAnimationActive={false}>
							{data.map((d) => (
								<Cell key={d.i} fill={d.up ? "var(--long)" : "var(--short)"} fillOpacity={0.55} />
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</Panel>

			<Panel title="RSI (14) · display only">
				<ResponsiveContainer width="100%" height={90}>
					<LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
						{grid}
						{xa}
						<YAxis {...axis} width={48} domain={[0, 100]} ticks={[30, 50, 70]} />
						<ReferenceLine y={70} stroke="var(--short)" strokeDasharray="3 3" strokeOpacity={0.5} />
						<ReferenceLine y={30} stroke="var(--long)" strokeDasharray="3 3" strokeOpacity={0.5} />
						<Tooltip content={<Tip intraday={intraday} />} />
						<Line dataKey="rsi" stroke="var(--brand)" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
					</LineChart>
				</ResponsiveContainer>
			</Panel>

			<Panel title="MACD (12,26,9) · display only">
				<ResponsiveContainer width="100%" height={90}>
					<ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
						{grid}
						{xa}
						<YAxis {...axis} width={48} />
						<ReferenceLine y={0} stroke="var(--border)" />
						<Tooltip content={<Tip intraday={intraday} />} />
						<Bar dataKey="hist" isAnimationActive={false}>
							{data.map((d) => (
								<Cell key={d.i} fill={(d.hist ?? 0) >= 0 ? "var(--long)" : "var(--short)"} fillOpacity={0.5} />
							))}
						</Bar>
						<Line dataKey="macd" stroke="var(--brand)" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
						<Line dataKey="signal" stroke="var(--watch)" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
					</ComposedChart>
				</ResponsiveContainer>
			</Panel>
		</div>
	);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-border bg-surface p-2">
			<div className="mb-1 px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{title}</div>
			{children}
		</div>
	);
}

const compact = (v: number) =>
	v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`;

interface TipPayload {
	payload: { label: string; vol: number; rsi: number | null; macd: number | null; signal: number | null };
}
function Tip({ active, payload, intraday: _intraday }: { active?: boolean; payload?: TipPayload[]; intraday: boolean }) {
	if (!active || !payload?.length) return null;
	const p = payload[0].payload;
	return (
		<div className="rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-sm">
			<div className="mono text-muted">{p.label}</div>
			{p.vol != null ? <div>Vol {compact(p.vol)}</div> : null}
			{p.rsi != null ? <div>RSI {p.rsi.toFixed(1)}</div> : null}
			{p.macd != null ? <div>MACD {p.macd.toFixed(2)}</div> : null}
		</div>
	);
}
