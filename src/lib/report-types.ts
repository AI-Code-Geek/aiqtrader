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

export interface Ladder {
	targets: LadderTarget[];
	rr1?: number;
	rr2?: number;
	rr_blended?: number;
	scale_out?: string;
	capped?: boolean;
	t1_sub_1r?: boolean;
}

/** Immediate market/limit entry. */
export interface EntryNow {
	label: string;
	type: string;
	price: number;
	stop: number;
	target: number;
	rr: number;
	chase_risk?: { score: number; label: string; atr_from_value: number };
	ladder?: Ladder;
}

/** A staged trigger entry (e.g. "Breakout confirm" / pullback): enter on confirmation through a zone. */
export interface EntryStaged {
	label: string;
	type: string;
	zone?: { low: number; high: number };
	trigger: number;
	stop: number;
	target: number;
	rr: number;
	fill_odds?: { score: number; label: string; atr_away: number };
	note?: string;
	ladder?: Ladder;
}

/**
 * How long the thesis is good for — the trade's clock. Computed by the engine (Module 2) and carried in
 * the report; the UI only renders it. `max_bars` is also what the AI overlay's `in_window` catalyst check
 * is recomputed against, so this is the authoritative horizon for the trade.
 */
export interface Duration {
	expected_bars?: number;
	max_bars?: number;
	unit?: string; // "day" | "hour" | ...
	duration_source?: string;
	per_bar_atr_k?: number;
	flat_by_close?: boolean;
	/** Pre-formatted human string, e.g. "expected ~11 days, valid up to ~28 days". */
	valid_until?: string;
	/** What to do when the clock runs out. */
	time_stop?: {
		trigger?: string; // e.g. "max_bars_elapsed"
		action?: string; // e.g. "exit_market"
		note?: string;
	};
}

export interface EntryPlan {
	direction: Direction;
	entry_now?: EntryNow;
	/** "Breakout confirm" / pullback — present when the engine offers a staged trigger. */
	entry_pullback?: EntryStaged;
	/** Trade horizon + time-stop (how many bars/days the setup stays valid). */
	duration?: Duration;
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
	phase?: string;
	htf_agree?: boolean | string;
	/** Caveat blocks — present when a gate/adjustment fired. Shapes are loose (faithful to JSON). */
	event_block?: { active?: boolean; label?: string; note?: string; detail?: string } | null;
	cost_block?: { label?: string; note?: string; detail?: string; spread_pct?: number } | null;
	market_block?: { label?: string; note?: string; state?: string } | null;
	take_small_block?: { active?: boolean; label?: string; note?: string; reason?: string } | null;
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

/** Per-timeframe MTF read (engine `/indicators/{sym}/mtf` summary). */
export interface MTFRow {
	available: boolean;
	score?: number | null;
	bias?: string | null;
	direction?: "bull" | "bear" | "neutral" | string | null;
	trend_alignment?: string | null;
	momentum_bias?: string | null;
	rsi?: number | null;
	macd_hist?: number | null;
	price?: number | null;
	reason?: string;
}

export interface MTF {
	summary?: Record<string, MTFRow>;
	alignment?: {
		verdict: string;
		label: string;
		bull: number;
		bear: number;
		neutral: number;
		available: number;
		agreement: number;
	};
	computed_at?: string;
}

/** Volume & candle psychology (engine `/analysis/{sym}/price-volume`). */
export interface PriceVolume {
	available: boolean;
	price?: number;
	vwap?: number | null;
	vwap_side?: string | null;
	rvol?: number | null;
	volume_trend?: string | null;
	climax?: { detected: boolean; type?: string; mult?: number } | null;
	effort_result?: { i: number; effort: number; result: number; flag: string }[];
	key_candles?: { i: number; pattern: string; psychology: string; location: string }[];
}

/** Candlestick patterns / Fibonacci / pivots (engine `/analysis/{sym}/price-action`). */
export interface PriceAction {
	candlestick_patterns?: {
		name?: string;
		pattern?: string;
		direction?: string;
		bias?: string;
		reliability?: string | number;
		[k: string]: unknown;
	}[];
	fibonacci?: Record<string, unknown> | null;
	pivots?: Record<string, unknown> | null;
}

export interface SymbolAnalysis {
	mtf?: MTF;
	price_volume?: PriceVolume;
	price_action?: PriceAction;
}

// ── AI Brain extension (Phase 7) — a `<report_version>.ai.json` sibling that `extends` the technical
// run. Produced separately by the AI plugin; the viewer renders it read-only when present. ──────────
export type AiStance = "supportive" | "cautionary" | "conflicting" | string;
export type AiLean =
	| "bullish"
	| "mildly_bullish"
	| "neutral"
	| "mildly_bearish"
	| "bearish"
	| string;

export interface AiDimension {
	lean: AiLean;
	note: string;
	confidence?: string;
}

export interface AiSentiment {
	label: string;
	score: number;
	drivers: string[];
}

export interface AiCatalyst {
	type: string;
	date: string | null;
	in_window: boolean;
	impact: string;
	direction: string;
	note: string;
}

export interface AiEdgeCase {
	risk: string;
	severity: string;
	note: string;
}

export interface AiVerification {
	verdict: string;
	report_price?: number;
	cited?: Record<string, number>;
	sources_checked?: { url: string; published: string | null }[];
	checked_at?: string;
	note?: string;
}

export interface AiProvenance {
	model: string;
	generated_at: string;
	sources?: unknown[];
	disclaimer?: string;
}

/** Per-symbol AI read in `<version>.ai.json` → `symbols[SYM]`. */
export interface AiSymbol {
	status: string;
	symbol: string;
	persona: Persona;
	stance: AiStance;
	alignment: Alignment;
	score: number;
	size_hint: string;
	confidence: string;
	sentiment: AiSentiment;
	catalysts: AiCatalyst[];
	market_read: { agrees_with_engine: boolean; note: string };
	edge_cases: AiEdgeCase[];
	narrative: string;
	reconciliation: string;
	provenance: AiProvenance;
	verification: AiVerification;
	dimensions: Record<string, AiDimension>;
}

export interface AiMarketOverview {
	tape: string;
	risk_tone: string;
	earnings_cluster: string;
	handle_with_care: string[];
	sources?: { kind: string; url: string }[];
	macro: string;
}

/** A full `<version>.ai.json` (kind: "ai_extension"). */
export interface AiReport {
	schema_version: number;
	kind: string;
	report_version: string;
	extends: string;
	persona: Persona;
	generated_at: string;
	model: string;
	disclaimer: string;
	market_overview: AiMarketOverview;
	symbols: Record<string, AiSymbol>;
	coverage?: { requested: number; enriched: number; basis: string; excluded?: { avoid?: string[] } };
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

/** Macro market health (engine `/market/health`). */
export interface MarketHealth {
	timeframe: string;
	indexes: {
		symbol?: string;
		name?: string;
		regime: string;
		adx?: number | null;
		price?: number | null;
		change_pct?: number | null;
		trend_strength?: string;
		[k: string]: unknown;
	}[];
	volatility?: {
		source?: string;
		atr_pct?: number | null;
		band?: string;
		trend?: string;
		vix_level?: number | null;
		vix_change_pct?: number | null;
		[k: string]: unknown;
	} | null;
	sectors: {
		symbol?: string;
		name?: string;
		group?: "offensive" | "defensive" | string;
		price?: number | null;
		return_pct?: number | null;
		rs_rank?: number | null;
		[k: string]: unknown;
	}[];
	scores?: { trend: number | null; volatility: number | null; sectors: number | null };
	verdict?: {
		health: string;
		posture: string;
		outlook: string;
		indexes_up: number;
		indexes_down: number;
		offensive_leading?: boolean;
	};
	computed_at?: string;
}

/** S&P 500 breadth (engine `/market/breadth`). */
export interface MarketBreadth {
	available: boolean;
	timeframe: string;
	analyzed: number;
	pct_above_50ma?: number;
	pct_above_200ma?: number;
	advancers?: number;
	decliners?: number;
	new_high_20d?: number;
	new_low_20d?: number;
	breadth_score?: number;
	computed_at?: string;
}

/** Top-level market overview block (schema_version ≥ 3; omitted on older runs). */
export interface MarketOverview {
	timeframe: string;
	health?: MarketHealth;
	breadth?: MarketBreadth;
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
	/** Macro market overview (schema_version ≥ 3; omitted on older runs). */
	market?: MarketOverview;
	candidates: Candidate[];
	decisions: Record<string, SymbolDecision>;
	/** Extra per-symbol analysis for the detail tabs (schema_version ≥ 2; omitted on older runs). */
	analysis?: Record<string, SymbolAnalysis>;
	charts: Record<string, Record<string, Bar[]>>;
}
