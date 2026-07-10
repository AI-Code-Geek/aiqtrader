"use client";

import { useEffect, useRef } from "react";
import {
	createChart,
	CandlestickSeries,
	ColorType,
	CrosshairMode,
	type IChartApi,
	type ISeriesApi,
	type UTCTimestamp,
} from "lightweight-charts";
import type { Bar } from "@/lib/report-types";

/** Read a CSS variable off :root so the chart tracks the active theme. */
function cssVar(name: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const toSec = (iso: string) => (Date.parse(iso) / 1000) as UTCTimestamp;

export interface PriceLine {
	price: number;
	color: string;
	title: string;
	dashed?: boolean;
}

/**
 * Candlestick chart (lightweight-charts). Renders only — bars come straight from the report.
 * Overlays plan levels (entry/stop/target) and HTF support/resistance as horizontal price lines.
 */
export function PriceChart({ bars, lines, intraday }: { bars: Bar[]; lines: PriceLine[]; intraday: boolean }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

	// Create the chart once.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const chart = createChart(el, {
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: cssVar("--muted", "#6b7684"),
				fontFamily: "inherit",
			},
			grid: {
				vertLines: { color: cssVar("--border", "#e3e6ea") },
				horzLines: { color: cssVar("--border", "#e3e6ea") },
			},
			crosshair: { mode: CrosshairMode.Normal },
			rightPriceScale: { borderColor: cssVar("--border", "#e3e6ea") },
			timeScale: {
				borderColor: cssVar("--border", "#e3e6ea"),
				timeVisible: intraday,
				secondsVisible: false,
			},
			autoSize: true,
		});
		const series = chart.addSeries(CandlestickSeries, {
			upColor: cssVar("--long", "#16a34a"),
			downColor: cssVar("--short", "#dc2626"),
			borderVisible: false,
			wickUpColor: cssVar("--long", "#16a34a"),
			wickDownColor: cssVar("--short", "#dc2626"),
		});
		chartRef.current = chart;
		seriesRef.current = series;
		return () => {
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, [intraday]);

	// Feed data + (re)draw price lines whenever bars/lines change.
	useEffect(() => {
		const series = seriesRef.current;
		const chart = chartRef.current;
		if (!series || !chart) return;
		series.setData(
			bars.map((b) => ({ time: toSec(b.ts), open: b.o, high: b.h, low: b.l, close: b.c })),
		);
		// Clear any existing price lines, then add the current set.
		const created = lines.map((l) =>
			series.createPriceLine({
				price: l.price,
				color: l.color,
				lineWidth: 1,
				lineStyle: l.dashed ? 2 : 0,
				axisLabelVisible: true,
				title: l.title,
			}),
		);
		chart.timeScale().fitContent();
		return () => created.forEach((pl) => series.removePriceLine(pl));
	}, [bars, lines]);

	return <div ref={containerRef} className="h-[360px] w-full" />;
}
