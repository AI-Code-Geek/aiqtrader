/**
 * Types for the trading-engine periodical report contract.
 * Mirrors DEVPLAN.md §2. The engine (Module 2) is the single source of truth — the UI only reads
 * these shapes, it never recomputes them. Fields are kept faithful to the JSON on disk; unknowns are
 * typed loosely rather than invented.
 */

export type Persona = "swing" | "day" | "scalp";
export type Timeframe = "1Hour" | "1Day" | "1Week" | string;
export type Direction = "long" | "short";
export type Verdict = "take" | "watch" | "arm" | "avoid";
export type Alignment = "agree" | "conflict";
export type StrategyClass = "continuation" | "reversal" | string;
export type Grade = "A" | "B" | "C" | "D" | string;

/** One OHLCV candle. 1Hour/1Day up to ~200 bars, 1Week ~57. */
export interface Bar {
	ts: string;
	o: number;
	h: number;
	l: number;
	c: number;
	v: number;
}

export interface ReportVersion {
	version: string;
	file: string;
	generated_at: string;
	candidate_count: number;
	status: string;
}

/** index.json — the periodical archive manifest for one schedule. */
export interface ReportIndex {
	schedule_id: number;
	name: string;
	persona: Persona;
	updated_at: string;
	versions: ReportVersion[];
}

export interface Setup {
	direction: Direction;
	entry: number;
	stop: number;
	target: number;
	rr: number;
	stop_widened_by?: number;
}

export interface QualityFactor {
	factor: string;
	detail: string;
}

export interface Quality {
	direction: Direction;
	grade: Grade;
	trap_risk: number;
	confirmations: QualityFactor[];
	warnings: QualityFactor[];
	verdict: string;
}

export interface Condition {
	name: string;
	met: boolean;
}

export interface ConfluenceDimension {
	read: "bull" | "bear" | "neutral" | string;
	detail: string;
	weight: number;
}

export interface Confluence {
	regime: string;
	dimensions: Record<string, ConfluenceDimension>;
	agreement: unknown;
	score: number;
	lean: "bullish" | "bearish" | "neutral" | string;
	strength: "strong" | "moderate" | "weak" | string;
	price: number;
}

export interface LadderTarget {
	level: number;
	rr: number;
	basis: string;
	pct: number;
	milestone: string;
}

export interface EntryPlan {
	direction: Direction;
	entry_now?: {
		label: string;
		type: string;
		price: number;
		stop: number;
		target: number;
		rr: number;
		chase_risk?: { score: number; label: string; atr_from_value: number };
		ladder?: { targets: LadderTarget[] };
	};
}

export interface MarketContext {
	state: string;
	label: string;
	bias: string;
	posture?: string;
	sector: string;
	sector_state: string;
	size_mult?: number;
	gated?: boolean;
	note: string;
}

export interface Confirmation {
	score: number;
	state: string;
	at_level?: boolean;
	evidence: { axis: string; detail: string }[];
	missing: { axis: string; detail: string }[];
}

/** The fused, server-side trade decision. */
export interface Decision {
	verdict: Verdict;
	conviction: number;
	raw_conviction: number;
	alignment: Alignment;
	klass: StrategyClass;
	context: string;
	context_label: string;
	context_tone?: string;
	htf_lean: string;
	size_factor: number;
	confirmation: Confirmation;
	market: MarketContext;
	rank_score: number;
	entry_plan: EntryPlan;
	reason: string;
	trend_state?: string;
	position_gate?: unknown;
	[key: string]: unknown;
}

export interface Screening {
	tradeable: boolean;
	blocks: unknown[];
	warnings: unknown[];
	dollar_volume: number;
	atr_pct: number;
	vol_band: string;
}

/** An entry in report.candidates[] — a ranked, actionable setup (the dashboard's primary list). */
export interface Candidate {
	symbol: string;
	regime: string;
	price: number;
	change_pct: number;
	rvol: number;
	strategy: string;
	label: string;
	direction: Direction;
	status: "active" | "watch" | string;
	conviction: number;
	setup: Setup;
	quality: Quality;
	decision: Decision;
	screening: Screening;
	rank_score: number;
	age_bars: number;
	thesis_expired: boolean;
}

export interface HtfStructure {
	htf_tf: string;
	htf_atr: number;
	support_levels: number[];
	resistance_levels: number[];
	supports?: { price: number; dist_entry_atr: number; dist_htf_atr: number }[];
	resistances?: { price: number; dist_entry_atr: number; dist_htf_atr: number }[];
}

export interface BestStrategy {
	strategy: string;
	label: string;
	direction: Direction;
	status: string;
	regime_ok: boolean;
	conviction: number;
	conditions: Condition[];
	setup: Setup;
	quality: Quality;
}

/** An entry in report.decisions{} — full per-symbol detail for the symbol page. */
export interface SymbolDecision {
	symbol: string;
	timeframe: Timeframe;
	regime: string;
	price: number;
	best: BestStrategy;
	confluence: Confluence;
	decision: Decision;
	structure: { htf: HtfStructure; level_strength: unknown };
	computed_at: string;
}

export interface DataHealth {
	checked_at: string;
	timeframes: unknown[];
	summary: {
		total_symbols: number;
		ok: number;
		partial: number;
		missing: number;
		errors: number;
		by_timeframe: Record<string, { ok: number; stale: number; missing: number }>;
	};
	synced: Record<string, number>;
	ok: boolean;
}

export interface Universe {
	watchlist_id: number;
	name: string;
	symbol_count: number;
	symbols: string[];
}

export interface Schedule {
	id: number;
	name: string;
	persona: Persona;
	timeframe: Timeframe;
	cadence: { kind: string; interval_minutes: number };
	min_rr: number | null;
	include_decisions: boolean;
	include_charts: boolean;
	detail_limit: number;
}

/** A full periodical run (latest.json / <version>.json). */
export interface Report {
	schema_version: number;
	report_version: string;
	generated_at: string;
	schedule: Schedule;
	persona: Persona;
	timeframes: Timeframe[];
	data_health: DataHealth;
	universe: Universe;
	candidates: Candidate[];
	decisions: Record<string, SymbolDecision>;
	charts: Record<string, Record<string, Bar[]>>;
}
