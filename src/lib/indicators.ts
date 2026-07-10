/**
 * DISPLAY-ONLY indicator derivation for the sub-panels (RSI / MACD).
 *
 * ⚠️ CLAUDE.md #2 + DEVPLAN Phase 2: these values are NEVER a decision input. The engine (Module 2)
 * owns all scoring/decision math; this is purely so the recharts sub-panels have something to draw
 * when the report's chart bars don't ship precomputed indicator series. Warm-up periods are kept as
 * `null` (never filtered) so every series stays index-aligned with the candle bar set (CLAUDE.md #9).
 */
import type { Bar } from "./report-types";

/** Wilder-smoothed RSI(14). Returns one value per bar, `null` during warm-up. */
export function rsi(bars: Bar[], period = 14): (number | null)[] {
	const out: (number | null)[] = new Array(bars.length).fill(null);
	if (bars.length <= period) return out;
	let gain = 0;
	let loss = 0;
	for (let i = 1; i <= period; i++) {
		const ch = bars[i].c - bars[i - 1].c;
		if (ch >= 0) gain += ch;
		else loss -= ch;
	}
	let avgGain = gain / period;
	let avgLoss = loss / period;
	out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
	for (let i = period + 1; i < bars.length; i++) {
		const ch = bars[i].c - bars[i - 1].c;
		const g = ch >= 0 ? ch : 0;
		const l = ch < 0 ? -ch : 0;
		avgGain = (avgGain * (period - 1) + g) / period;
		avgLoss = (avgLoss * (period - 1) + l) / period;
		out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
	}
	return out;
}

function ema(values: number[], period: number): (number | null)[] {
	const out: (number | null)[] = new Array(values.length).fill(null);
	if (values.length < period) return out;
	const k = 2 / (period + 1);
	let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
	out[period - 1] = prev;
	for (let i = period; i < values.length; i++) {
		prev = values[i] * k + prev * (1 - k);
		out[i] = prev;
	}
	return out;
}

export interface MacdPoint {
	macd: number | null;
	signal: number | null;
	hist: number | null;
}

/** MACD(12,26,9) on closes. Warm-up bars stay `null`. */
export function macd(bars: Bar[], fast = 12, slow = 26, signalP = 9): MacdPoint[] {
	const closes = bars.map((b) => b.c);
	const fastE = ema(closes, fast);
	const slowE = ema(closes, slow);
	const line: (number | null)[] = closes.map((_, i) =>
		fastE[i] != null && slowE[i] != null ? (fastE[i] as number) - (slowE[i] as number) : null,
	);
	// Signal = EMA of the (contiguous) MACD line; keep index alignment against the full bar set.
	const firstIdx = line.findIndex((v) => v != null);
	const compact = firstIdx < 0 ? [] : (line.slice(firstIdx).filter((v) => v != null) as number[]);
	const sigCompact = ema(compact, signalP);
	const signal: (number | null)[] = new Array(bars.length).fill(null);
	if (firstIdx >= 0) for (let i = 0; i < sigCompact.length; i++) signal[firstIdx + i] = sigCompact[i];
	return line.map((m, i) => ({
		macd: m,
		signal: signal[i],
		hist: m != null && signal[i] != null ? m - (signal[i] as number) : null,
	}));
}
