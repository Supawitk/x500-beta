import { useState, useMemo } from "react";
import { Card } from "../common/Card";
import {
  Info, ChevronDown, ChevronUp, Sliders, TrendingUp,
  TrendingDown, Activity, BarChart3, Zap, Target,
} from "lucide-react";
import type { SignalSummary, AnalysisDataPoint } from "../../api/analysis";

interface Props {
  signals: SignalSummary;
  regression: { slope: number; rSquared: number; trend: string };
  lastPoint?: AnalysisDataPoint;
  data: AnalysisDataPoint[];
}

// ── Category colors ─────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  trend: "#4f46e5",
  momentum: "#d97706",
  oscillator: "#7c3aed",
  volatility: "#0891b2",
  volume: "#059669",
  statistical: "#be185d",
};

// ── Indicator definitions ───────────────────────────────────────────────────
interface IndicatorDef {
  id: string;
  label: string;
  defaultWeight: number;
  category: string;
  description: string;
  howToRead: string;
  getQuantValues: (p: AnalysisDataPoint | undefined, data: AnalysisDataPoint[]) => QuantValue[];
  signals: Record<string, { meaning: string; action: string; strength: "strong" | "moderate" | "weak" }>;
}

interface QuantValue {
  label: string;
  value: string;
  color?: string;
}

const INDICATOR_DEFS: IndicatorDef[] = [
  {
    id: "macd",
    label: "MACD (12, 26, 9)",
    defaultWeight: 18,
    category: "momentum",
    description: "Moving Average Convergence Divergence compares a 12-day EMA to a 26-day EMA, smoothed into a 9-day signal line. The histogram shows momentum strength — widening = strengthening.",
    howToRead: "Bullish: MACD crosses above signal. Histogram expanding green = accelerating momentum. Zero-line crossover confirms trend shift.",
    getQuantValues: (p, data) => {
      if (!p) return [];
      const hist = p.macdHist;
      const prevHist = data.length >= 2 ? data[data.length - 2]?.macdHist : null;
      const momentum = hist != null && prevHist != null ? (hist > prevHist ? "Accelerating" : "Decelerating") : "—";
      return [
        { label: "MACD", value: p.macd?.toFixed(2) ?? "—", color: p.macd && p.macd > 0 ? "#059669" : "#dc2626" },
        { label: "Signal", value: p.macdSignal?.toFixed(2) ?? "—" },
        { label: "Histogram", value: hist?.toFixed(2) ?? "—", color: hist && hist > 0 ? "#059669" : "#dc2626" },
        { label: "Momentum", value: momentum, color: momentum === "Accelerating" ? "#059669" : "#d97706" },
      ];
    },
    signals: {
      "Bullish": { meaning: "MACD line is above the signal line — buying momentum is positive.", action: "Lean long. Watch histogram for momentum acceleration.", strength: "strong" },
      "Bearish": { meaning: "MACD line is below the signal line — selling momentum dominates.", action: "Lean short. Watch for histogram narrowing as early reversal sign.", strength: "strong" },
    },
  },
  {
    id: "ema",
    label: "EMA Crossover (12/26)",
    defaultWeight: 12,
    category: "trend",
    description: "12-day EMA (fast) vs 26-day EMA (slow). Golden cross = bullish shift. Death cross = bearish. The spread between them shows trend strength.",
    howToRead: "Widening spread = strengthening trend. Narrowing spread = potential crossover coming.",
    getQuantValues: (p) => {
      if (!p) return [];
      const spread = p.ema12 && p.ema26 ? p.ema12 - p.ema26 : null;
      const spreadPct = spread && p.close ? (spread / p.close * 100) : null;
      return [
        { label: "EMA12", value: p.ema12?.toFixed(2) ?? "—" },
        { label: "EMA26", value: p.ema26?.toFixed(2) ?? "—" },
        { label: "Spread", value: spread ? `$${spread.toFixed(2)}` : "—", color: spread && spread > 0 ? "#059669" : "#dc2626" },
        { label: "Spread %", value: spreadPct ? `${spreadPct.toFixed(2)}%` : "—" },
      ];
    },
    signals: {
      "Bullish": { meaning: "12-day EMA above 26-day — short-term momentum outpacing medium-term.", action: "Align with bullish signals. Wider spread = stronger conviction.", strength: "moderate" },
      "Bearish": { meaning: "12-day EMA below 26-day — downside pressure building.", action: "Avoid new longs. Narrowing spread may signal reversal.", strength: "moderate" },
    },
  },
  {
    id: "trend",
    label: "Price vs EMA 50",
    defaultWeight: 12,
    category: "trend",
    description: "Closing price vs 50-day EMA — a key medium-term trend indicator. EMA50 often acts as dynamic support/resistance.",
    howToRead: "Price above rising EMA50 = strong uptrend. Price below falling EMA50 = strong downtrend. Flat EMA50 = ranging.",
    getQuantValues: (p) => {
      if (!p) return [];
      const dist = p.ema50 ? p.close - p.ema50 : null;
      const distPct = dist && p.ema50 ? (dist / p.ema50 * 100) : null;
      return [
        { label: "Price", value: `$${p.close.toFixed(2)}` },
        { label: "EMA50", value: p.ema50 ? `$${p.ema50.toFixed(2)}` : "—" },
        { label: "Distance", value: distPct ? `${distPct > 0 ? "+" : ""}${distPct.toFixed(2)}%` : "—", color: dist && dist > 0 ? "#059669" : "#dc2626" },
      ];
    },
    signals: {
      "Above EMA50": { meaning: "Price above 50-day EMA — medium-term uptrend. EMA50 is potential support.", action: "Trend bullish. Dips to EMA50 could be buying opportunities.", strength: "moderate" },
      "Below EMA50": { meaning: "Price below 50-day EMA — medium-term downtrend. EMA50 is potential resistance.", action: "Trend bearish. Rallies to EMA50 may face selling pressure.", strength: "moderate" },
    },
  },
  {
    id: "ema200",
    label: "Price vs EMA 200",
    defaultWeight: 10,
    category: "trend",
    description: "Closing price vs 200-day EMA — the definitive long-term trend indicator. The 200 EMA defines the major trend direction for institutional investors.",
    howToRead: "Above = long-term bull market. Below = long-term bear market. The further from EMA200, the more extended the move.",
    getQuantValues: (p) => {
      if (!p) return [];
      const dist = p.ema200 ? p.close - p.ema200 : null;
      const distPct = dist && p.ema200 ? (dist / p.ema200 * 100) : null;
      return [
        { label: "Price", value: `$${p.close.toFixed(2)}` },
        { label: "EMA200", value: p.ema200 ? `$${p.ema200.toFixed(2)}` : "—" },
        { label: "Distance", value: distPct ? `${distPct > 0 ? "+" : ""}${distPct.toFixed(2)}%` : "—", color: dist && dist > 0 ? "#059669" : "#dc2626" },
      ];
    },
    signals: {
      "Above EMA200": { meaning: "Price above 200-day EMA — long-term uptrend intact. Institutions favor the long side.", action: "Macro trend is bullish. Medium-term dips are generally buying opportunities.", strength: "strong" },
      "Below EMA200": { meaning: "Price below 200-day EMA — long-term downtrend. Institutional selling pressure.", action: "Macro trend is bearish. Rallies face overhead resistance.", strength: "strong" },
    },
  },
  {
    id: "rsi",
    label: "RSI (14)",
    defaultWeight: 10,
    category: "oscillator",
    description: "Relative Strength Index (0–100). Measures speed and magnitude of price changes. >70 = overbought, <30 = oversold. Look for divergences.",
    howToRead: "RSI divergence (price makes new high but RSI doesn't) is more powerful than level-based signals. Mid-range (40-60) often means consolidation.",
    getQuantValues: (p, data) => {
      if (!p) return [];
      const rsiVal = p.rsi;
      // Check for divergence
      const recent = data.slice(-20);
      let divergence = "None";
      if (recent.length >= 10) {
        const prices = recent.map(d => d.close);
        const rsis = recent.map(d => d.rsi).filter(v => v != null) as number[];
        if (rsis.length >= 10) {
          const priceTrend = prices[prices.length - 1] > prices[0];
          const rsiTrend = rsis[rsis.length - 1] > rsis[0];
          if (priceTrend && !rsiTrend) divergence = "Bearish Div.";
          else if (!priceTrend && rsiTrend) divergence = "Bullish Div.";
        }
      }
      const zone = rsiVal != null ? (rsiVal > 70 ? "Overbought" : rsiVal > 60 ? "Bullish Zone" : rsiVal > 40 ? "Neutral" : rsiVal > 30 ? "Bearish Zone" : "Oversold") : "—";
      return [
        { label: "RSI", value: rsiVal?.toFixed(1) ?? "—", color: rsiVal && rsiVal > 70 ? "#dc2626" : rsiVal && rsiVal < 30 ? "#059669" : undefined },
        { label: "Zone", value: zone },
        { label: "Divergence", value: divergence, color: divergence.includes("Bullish") ? "#059669" : divergence.includes("Bearish") ? "#dc2626" : "#6b7280" },
      ];
    },
    signals: {
      "Overbought": { meaning: "RSI above 70 — momentum may be exhausting. Not a sell signal alone but warrants caution.", action: "Reduce new longs. Watch for bearish divergence to confirm reversal.", strength: "moderate" },
      "Oversold": { meaning: "RSI below 30 — price has fallen sharply, may bounce. Stronger in uptrends.", action: "Look for RSI cross above 30 and bullish divergence.", strength: "moderate" },
      "Neutral": { meaning: "RSI 30-70 — no extreme momentum. Direction comes from other indicators.", action: "Defer to trend-following indicators.", strength: "weak" },
    },
  },
  {
    id: "stoch",
    label: "Stochastic (14,3,3)",
    defaultWeight: 7,
    category: "oscillator",
    description: "Compares closing price to high-low range. %K vs %D crossovers at extremes are key. More sensitive than RSI to short-term swings.",
    howToRead: "%K crossing above %D below 20 = buy. %K crossing below %D above 80 = sell. In strong trends, can stay extreme.",
    getQuantValues: (p) => {
      if (!p) return [];
      const kd = p.stochK != null && p.stochD != null ? (p.stochK > p.stochD ? "Bullish Cross" : "Bearish Cross") : "—";
      return [
        { label: "%K", value: p.stochK?.toFixed(1) ?? "—" },
        { label: "%D", value: p.stochD?.toFixed(1) ?? "—" },
        { label: "K/D Signal", value: kd, color: kd.includes("Bullish") ? "#059669" : kd.includes("Bearish") ? "#dc2626" : undefined },
      ];
    },
    signals: {
      "Overbought": { meaning: "%K above 80 — short-term overbought. Watch for %K/%D bearish crossover.", action: "Monitor for %K crossing below %D as exit signal.", strength: "weak" },
      "Oversold": { meaning: "%K below 20 — short-term oversold. Watch for %K/%D bullish crossover.", action: "Watch for %K crossing above %D as entry signal.", strength: "weak" },
      "Neutral": { meaning: "Between 20-80. No extreme short-term signal.", action: "Use trend indicators for direction.", strength: "weak" },
    },
  },
  {
    id: "ichimoku",
    label: "Ichimoku Cloud",
    defaultWeight: 10,
    category: "trend",
    description: "Five-line system: Tenkan (9), Kijun (26), Senkou Span A/B (cloud), Chikou (lagging). Price position relative to cloud determines trend.",
    howToRead: "Price above cloud + Tenkan > Kijun = strong bullish. Price in cloud = indecision. Cloud twist = potential trend change.",
    getQuantValues: (p) => {
      if (!p) return [];
      const cloudTop = p.ichimokuSpanA != null && p.ichimokuSpanB != null ? Math.max(p.ichimokuSpanA, p.ichimokuSpanB) : null;
      const cloudBot = p.ichimokuSpanA != null && p.ichimokuSpanB != null ? Math.min(p.ichimokuSpanA, p.ichimokuSpanB) : null;
      const inCloud = cloudTop != null && cloudBot != null && p.close <= cloudTop && p.close >= cloudBot;
      const tkCross = p.ichimokuTenkan != null && p.ichimokuKijun != null
        ? (p.ichimokuTenkan > p.ichimokuKijun ? "TK Bullish" : "TK Bearish") : "—";
      const cloudColor = p.ichimokuSpanA != null && p.ichimokuSpanB != null
        ? (p.ichimokuSpanA > p.ichimokuSpanB ? "Green Cloud" : "Red Cloud") : "—";
      return [
        { label: "Tenkan", value: p.ichimokuTenkan?.toFixed(2) ?? "—" },
        { label: "Kijun", value: p.ichimokuKijun?.toFixed(2) ?? "—" },
        { label: "TK Cross", value: tkCross, color: tkCross.includes("Bullish") ? "#059669" : tkCross.includes("Bearish") ? "#dc2626" : undefined },
        { label: "Cloud", value: inCloud ? "In Cloud" : cloudColor, color: cloudColor.includes("Green") ? "#059669" : "#dc2626" },
      ];
    },
    signals: {
      "Bullish": { meaning: "Price above cloud, Tenkan above Kijun — strong bullish across all Ichimoku components.", action: "Full bullish confirmation. Cloud acts as support.", strength: "strong" },
      "Bearish": { meaning: "Price below cloud, Tenkan below Kijun — strong bearish setup.", action: "Full bearish confirmation. Cloud acts as resistance.", strength: "strong" },
      "Neutral": { meaning: "Mixed signals — price may be in or near the cloud.", action: "Wait for clear breakout above/below cloud.", strength: "weak" },
    },
  },
  {
    id: "bollinger",
    label: "Bollinger Bands (20,2)",
    defaultWeight: 8,
    category: "volatility",
    description: "20-period SMA ± 2 standard deviations. Bands widen in volatility, narrow in calm. Price touching bands signals extremes.",
    howToRead: "Squeeze (narrow bands) precedes big moves. Walking the band = strong trend. Mean reversion expected at extremes.",
    getQuantValues: (p) => {
      if (!p) return [];
      const bbWidth = p.bbUpper && p.bbLower && p.bbMiddle ? ((p.bbUpper - p.bbLower) / p.bbMiddle * 100) : null;
      const bbPos = p.bbUpper && p.bbLower ? ((p.close - p.bbLower) / (p.bbUpper - p.bbLower) * 100) : null;
      return [
        { label: "Upper", value: p.bbUpper?.toFixed(2) ?? "—" },
        { label: "Middle", value: p.bbMiddle?.toFixed(2) ?? "—" },
        { label: "Lower", value: p.bbLower?.toFixed(2) ?? "—" },
        { label: "Width", value: bbWidth ? `${bbWidth.toFixed(1)}%` : "—" },
        { label: "Position", value: bbPos ? `${bbPos.toFixed(0)}%` : "—", color: bbPos && bbPos > 80 ? "#dc2626" : bbPos && bbPos < 20 ? "#059669" : undefined },
      ];
    },
    signals: {
      "Overbought": { meaning: "Price above upper band — extended move, mean reversion likely.", action: "Caution on new longs. Consider taking profits.", strength: "moderate" },
      "Oversold": { meaning: "Price below lower band — oversold, bounce probable.", action: "Watch for reversal candle for entry.", strength: "moderate" },
      "Above Mid": { meaning: "Price between middle and upper band — bullish zone.", action: "Trend favoring longs. Middle band is support.", strength: "weak" },
      "Below Mid": { meaning: "Price between middle and lower band — bearish zone.", action: "Trend favoring shorts. Middle band is resistance.", strength: "weak" },
    },
  },
  {
    id: "adx",
    label: "ADX (14) — Trend Strength",
    defaultWeight: 8,
    category: "volatility",
    description: "Average Directional Index measures trend STRENGTH (not direction). +DI and -DI show direction. Higher ADX = stronger trend regardless of up/down.",
    howToRead: "ADX > 25 = trending. ADX < 20 = ranging. Rising ADX = trend strengthening. +DI > -DI = uptrend direction.",
    getQuantValues: (p) => {
      if (!p) return [];
      const dir = p.plusDI != null && p.minusDI != null ? (p.plusDI > p.minusDI ? "Uptrend" : "Downtrend") : "—";
      const diDiff = p.plusDI != null && p.minusDI != null ? Math.abs(p.plusDI - p.minusDI) : null;
      return [
        { label: "ADX", value: p.adx?.toFixed(1) ?? "—", color: p.adx && p.adx > 25 ? "#4f46e5" : "#6b7280" },
        { label: "+DI", value: p.plusDI?.toFixed(1) ?? "—", color: "#059669" },
        { label: "-DI", value: p.minusDI?.toFixed(1) ?? "—", color: "#dc2626" },
        { label: "Direction", value: dir, color: dir === "Uptrend" ? "#059669" : dir === "Downtrend" ? "#dc2626" : undefined },
        { label: "DI Spread", value: diDiff?.toFixed(1) ?? "—" },
      ];
    },
    signals: {
      "Very Strong Trend": { meaning: "ADX > 50 — extremely strong trend. Trend-following strategies are ideal.", action: "Ride the trend. Counter-trend trades are high-risk.", strength: "strong" },
      "Strong Trend": { meaning: "ADX 25-50 — confirmed trending market.", action: "Use trend-following entries. +DI > -DI = favor longs.", strength: "moderate" },
      "Weak Trend": { meaning: "ADX 20-25 — trend is forming or fading.", action: "Be cautious. Wait for ADX to confirm direction.", strength: "weak" },
      "No Trend": { meaning: "ADX < 20 — range-bound market. No clear trend.", action: "Mean-reversion strategies. Avoid trend-following.", strength: "weak" },
    },
  },
  {
    id: "volume",
    label: "Volume Analysis",
    defaultWeight: 5,
    category: "volume",
    description: "Current volume vs 20-day average. Volume confirms price moves — high volume on breakouts = conviction. Low volume on moves = suspicion.",
    howToRead: "Volume spike with price move = strong conviction. Low volume rally = weak hands. Volume divergence (price up, vol down) warns of reversal.",
    getQuantValues: (p, data) => {
      if (!p) return [];
      const recent = data.slice(-20);
      const avgVol = recent.reduce((s, d) => s + d.volume, 0) / recent.length;
      const ratio = avgVol > 0 ? p.volume / avgVol : 0;
      const fmtVol = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toString();
      return [
        { label: "Volume", value: fmtVol(p.volume) },
        { label: "20D Avg", value: fmtVol(avgVol) },
        { label: "Ratio", value: `${ratio.toFixed(2)}x`, color: ratio > 1.5 ? "#4f46e5" : ratio < 0.5 ? "#d97706" : undefined },
      ];
    },
    signals: {
      "High Volume": { meaning: "Volume > 1.5x average — high conviction in current price action.", action: "Price move is backed by volume. Breakouts are more reliable.", strength: "moderate" },
      "Above Average": { meaning: "Volume above average — decent participation.", action: "Normal confirmation. No extra caution needed.", strength: "weak" },
      "Below Average": { meaning: "Volume below average — weaker participation.", action: "Current move may lack conviction. Be cautious of false breakouts.", strength: "weak" },
      "Low Volume": { meaning: "Volume < 50% of average — very low participation.", action: "Moves are unreliable. Wait for volume to return.", strength: "moderate" },
    },
  },
  {
    id: "regression",
    label: "Regression Trend",
    defaultWeight: 5,
    category: "statistical",
    description: "Linear regression fitted to closes. R² (0-1) shows trend reliability — high R² means clean trend. Slope shows rate of change.",
    howToRead: "High R² + positive slope = confident uptrend. Low R² = noisy/unreliable regardless of direction.",
    getQuantValues: () => [],
    signals: {
      "Uptrend": { meaning: "Positive slope — statistical upward drift.", action: "Directional confirmation. Weight higher if R² > 0.7.", strength: "weak" },
      "Downtrend": { meaning: "Negative slope — statistical downward drift.", action: "Directional confirmation for shorts.", strength: "weak" },
      "Sideways": { meaning: "Near-zero slope — no clear statistical trend.", action: "Range-bound. Mean-reversion may work better.", strength: "weak" },
    },
  },
];

// ── Signal scoring (now with graduated values) ──────────────────────────────
function scoreSignal(signal: string, id: string, p?: AnalysisDataPoint): number {
  const s = signal.toLowerCase();

  if (id === "rsi" && p?.rsi != null) {
    if (p.rsi > 80) return -0.8;
    if (p.rsi > 70) return -0.4;
    if (p.rsi > 60) return 0.2;
    if (p.rsi > 40) return 0;
    if (p.rsi > 30) return -0.2;
    if (p.rsi > 20) return 0.4;
    return 0.8;
  }
  if (id === "stoch" && p?.stochK != null) {
    if (p.stochK > 80) return -0.4;
    if (p.stochK < 20) return 0.4;
    return 0;
  }
  if (id === "adx") {
    // ADX is trend strength, not direction. Use +DI/-DI for direction.
    if (p?.adx != null && p.plusDI != null && p.minusDI != null) {
      const dir = p.plusDI > p.minusDI ? 1 : -1;
      if (p.adx > 50) return dir * 0.9;
      if (p.adx > 25) return dir * 0.5;
      return 0;
    }
    return 0;
  }
  if (id === "volume") {
    // Volume doesn't give direction by itself, just confirmation
    return 0;
  }
  if (id === "bollinger") {
    if (s.includes("overbought")) return -0.6;
    if (s.includes("oversold")) return 0.6;
    if (s.includes("above mid")) return 0.2;
    if (s.includes("below mid")) return -0.2;
    return 0;
  }
  if (id === "ichimoku") {
    if (s.includes("bullish")) return 1;
    if (s.includes("bearish")) return -1;
    return 0;
  }

  if (s.includes("bullish") || s.includes("above")) return 1;
  if (s.includes("bearish") || s.includes("below")) return -1;
  if (s.includes("uptrend")) return 0.7;
  if (s.includes("downtrend")) return -0.7;
  return 0;
}

function computeWeightedScore(
  signals: SignalSummary,
  regression: { trend: string },
  weights: Record<string, number>,
  p?: AnalysisDataPoint,
) {
  const readings: { id: string; signal: string }[] = [
    { id: "macd", signal: signals.macdSignal },
    { id: "ema", signal: signals.emaSignal },
    { id: "trend", signal: signals.trendSignal },
    { id: "ema200", signal: signals.ema200Signal },
    { id: "rsi", signal: signals.rsiSignal },
    { id: "stoch", signal: signals.stochSignal },
    { id: "ichimoku", signal: signals.ichimokuSignal },
    { id: "bollinger", signal: signals.bollingerSignal },
    { id: "adx", signal: signals.adxSignal },
    { id: "volume", signal: signals.volumeSignal },
    { id: "regression", signal: regression.trend },
  ];

  let weightedSum = 0;
  let totalWeight = 0;
  const individual: { id: string; score: number; weight: number }[] = [];

  readings.forEach(({ id, signal }) => {
    const w = weights[id] ?? 0;
    if (signal === "N/A" || w === 0) return;
    const sc = scoreSignal(signal, id, p);
    weightedSum += sc * w;
    totalWeight += w;
    individual.push({ id, score: sc, weight: w });
  });

  const normalized = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  return { score: Math.round(normalized), individual };
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 60) return { label: "Strong Buy Signal", color: "#059669" };
  if (score >= 25) return { label: "Moderate Buy Signal", color: "#34d399" };
  if (score >= -24) return { label: "Mixed / Neutral", color: "#d97706" };
  if (score >= -59) return { label: "Moderate Sell Signal", color: "#f87171" };
  return { label: "Strong Sell Signal", color: "#dc2626" };
}

function getSignalDetail(def: IndicatorDef, signal: string) {
  for (const [key, val] of Object.entries(def.signals)) {
    if (signal.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return null;
}

// ── Convergence analysis ────────────────────────────────────────────────────
function analyzeConvergence(individual: { id: string; score: number }[]) {
  const bullish = individual.filter(i => i.score > 0.3).length;
  const bearish = individual.filter(i => i.score < -0.3).length;
  const neutral = individual.filter(i => Math.abs(i.score) <= 0.3).length;
  const total = individual.length;
  const agreement = Math.max(bullish, bearish) / Math.max(total, 1);

  let convergence: string;
  let convColor: string;
  if (agreement > 0.7) { convergence = "Strong Convergence"; convColor = "#059669"; }
  else if (agreement > 0.5) { convergence = "Moderate Convergence"; convColor = "#34d399"; }
  else if (bullish > 0 && bearish > 0) { convergence = "Divergent Signals"; convColor = "#dc2626"; }
  else { convergence = "Mixed Signals"; convColor = "#d97706"; }

  return { bullish, bearish, neutral, total, convergence, convColor, agreement };
}

// ── Momentum trend (is momentum accelerating or decelerating?) ──────────────
function analyzeMomentum(data: AnalysisDataPoint[]) {
  if (data.length < 5) return null;
  const recent = data.slice(-5);
  const rsis = recent.map(d => d.rsi).filter(v => v != null) as number[];
  const macds = recent.map(d => d.macdHist).filter(v => v != null) as number[];

  let rsiTrend = "Flat";
  if (rsis.length >= 3) {
    const diff = rsis[rsis.length - 1] - rsis[0];
    if (diff > 3) rsiTrend = "Rising";
    else if (diff < -3) rsiTrend = "Falling";
  }

  let macdTrend = "Flat";
  if (macds.length >= 3) {
    const diff = macds[macds.length - 1] - macds[0];
    if (diff > 0) macdTrend = "Expanding";
    else if (diff < 0) macdTrend = "Contracting";
  }

  const accelerating = (rsiTrend === "Rising" && macdTrend === "Expanding") ||
    (rsiTrend === "Falling" && macdTrend === "Contracting");

  return { rsiTrend, macdTrend, accelerating };
}

// ── Sub-components ──────────────────────────────────────────────────────────
function QuantBadges({ values }: { values: QuantValue[] }) {
  if (values.length === 0) return null;
  return (
    <div className="wsig-quant-row">
      {values.map((v, i) => (
        <div key={i} className="wsig-quant-badge">
          <span className="wsig-quant-label">{v.label}</span>
          <span className="wsig-quant-val" style={v.color ? { color: v.color } : undefined}>{v.value}</span>
        </div>
      ))}
    </div>
  );
}

function IndicatorRow({
  def, signal, weight, onWeightChange, lastPoint, data,
}: {
  def: IndicatorDef;
  signal: string;
  weight: number;
  onWeightChange: (w: number) => void;
  lastPoint?: AnalysisDataPoint;
  data: AnalysisDataPoint[];
}) {
  const [open, setOpen] = useState(false);
  const detail = getSignalDetail(def, signal);
  const quantValues = useMemo(() => def.getQuantValues(lastPoint, data), [def, lastPoint, data]);
  const sc = scoreSignal(signal, def.id, lastPoint);

  const isBull = sc > 0.2;
  const isBear = sc < -0.2;
  const badgeCls = isBull ? "badge-green" : isBear ? "badge-red" : "badge-yellow";
  const catColor = CAT_COLORS[def.category] || "#6b7280";

  return (
    <div className={`wsig-row ${open ? "wsig-row-open" : ""}`}>
      <div className="wsig-row-header" onClick={() => setOpen(!open)}>
        <div className="wsig-left">
          <span className="wsig-cat-dot" style={{ background: catColor }} />
          <div>
            <span className="wsig-label">{def.label}</span>
            <span className="wsig-cat" style={{ color: catColor }}>{def.category}</span>
          </div>
        </div>
        <div className="wsig-right">
          <div className="wsig-weight-bar-wrap" title={`Weight: ${weight}%`}>
            <div className="wsig-weight-bar-track">
              <div className="wsig-weight-bar-fill" style={{ width: `${weight}%`, background: catColor }} />
            </div>
            <span className="wsig-weight-label">{weight}%</span>
          </div>
          {/* Score mini-bar */}
          <div className="wsig-score-mini" title={`Score: ${sc > 0 ? "+" : ""}${(sc * 100).toFixed(0)}`}>
            <div className="wsig-score-mini-track">
              <div className="wsig-score-mini-center" />
              <div className="wsig-score-mini-fill" style={{
                left: sc >= 0 ? "50%" : `${50 + sc * 50}%`,
                width: `${Math.abs(sc) * 50}%`,
                background: isBull ? "#059669" : isBear ? "#dc2626" : "#d97706",
              }} />
            </div>
          </div>
          <span className={`health-badge ${badgeCls}`} style={{ minWidth: 90, textAlign: "center", fontSize: 11 }}>
            {signal}
          </span>
          {open ? <ChevronUp size={14} style={{ color: "#9ca3af" }} /> : <ChevronDown size={14} style={{ color: "#9ca3af" }} />}
        </div>
      </div>

      {open && (
        <div className="wsig-detail fade-in">
          {/* Quantitative values */}
          {quantValues.length > 0 && <QuantBadges values={quantValues} />}

          {/* Weight slider */}
          <div className="wsig-weight-slider-row">
            <span className="metric-label" style={{ fontSize: 11 }}>Weight:</span>
            <input
              type="range" min={0} max={30} value={weight}
              onChange={e => onWeightChange(Number(e.target.value))}
              className="wsig-weight-slider"
              style={{ "--range-accent": catColor } as React.CSSProperties}
            />
            <span className="wsig-weight-slider-val">{weight}%</span>
          </div>

          <p className="wsig-desc">{def.description}</p>
          <div className="wsig-howto">
            <span className="metric-label">How to read: </span>
            <span>{def.howToRead}</span>
          </div>
          {detail && (
            <div className={`wsig-current ${isBull ? "wsig-bull" : isBear ? "wsig-bear" : "wsig-neutral"}`}>
              <div className="wsig-current-header">
                Current: <strong>{signal}</strong>
                <span className={`wsig-strength wsig-${detail.strength}`}>{detail.strength}</span>
              </div>
              <p style={{ margin: "4px 0" }}>{detail.meaning}</p>
              <div className="wsig-action"><strong>Action: </strong>{detail.action}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function WeightedSignalPanel({ signals, regression, lastPoint, data }: Props) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    INDICATOR_DEFS.forEach(d => { w[d.id] = d.defaultWeight; });
    return w;
  });

  const updateWeight = (id: string, v: number) => {
    setWeights(prev => ({ ...prev, [id]: v }));
  };

  const resetWeights = () => {
    const w: Record<string, number> = {};
    INDICATOR_DEFS.forEach(d => { w[d.id] = d.defaultWeight; });
    setWeights(w);
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const { score, individual } = useMemo(
    () => computeWeightedScore(signals, regression, weights, lastPoint),
    [signals, regression, weights, lastPoint]
  );
  const { label: scoreLabel_, color: scoreColor } = scoreLabel(score);
  const convergence = useMemo(() => analyzeConvergence(individual), [individual]);
  const momentum = useMemo(() => analyzeMomentum(data), [data]);

  const signalMap: Record<string, string> = {
    macd: signals.macdSignal,
    ema: signals.emaSignal,
    trend: signals.trendSignal,
    ema200: signals.ema200Signal,
    rsi: signals.rsiSignal,
    stoch: signals.stochSignal,
    ichimoku: signals.ichimokuSignal,
    bollinger: signals.bollingerSignal,
    adx: signals.adxSignal,
    volume: signals.volumeSignal,
    regression: regression.trend,
  };

  const barPct = Math.min(Math.max(((score + 100) / 200) * 100, 0), 100);

  return (
    <Card title="Advanced Signal Analysis">
      {/* ── Composite Score ──────────────────────────────────── */}
      <div className="wsig-score-block">
        <div className="wsig-score-header">
          <span className="metric-label">Composite Weighted Score</span>
          <span className="wsig-score-num" style={{ color: scoreColor }}>
            {score > 0 ? "+" : ""}{score}
          </span>
        </div>
        <div className="wsig-gauge-track">
          <div className="wsig-gauge-center" />
          <div className="wsig-gauge-fill" style={{
            left: score >= 0 ? "50%" : `${barPct}%`,
            width: `${Math.abs(score) / 2}%`,
            background: scoreColor,
          }} />
          {/* Pointer */}
          <div className="wsig-gauge-pointer" style={{ left: `${barPct}%` }} />
        </div>
        <div className="wsig-gauge-labels">
          <span style={{ color: "#dc2626", fontSize: 10 }}>Strong Sell</span>
          <span style={{ color: "#d97706", fontSize: 10 }}>Neutral</span>
          <span style={{ color: "#059669", fontSize: 10 }}>Strong Buy</span>
        </div>
        <div className="wsig-score-label" style={{ color: scoreColor }}>{scoreLabel_}</div>
      </div>

      {/* ── Convergence & Momentum Strip ──────────────────────── */}
      <div className="wsig-analysis-strip">
        <div className="wsig-strip-card">
          <div className="wsig-strip-icon"><Target size={14} /></div>
          <div>
            <div className="wsig-strip-title">Signal Convergence</div>
            <div className="wsig-strip-val" style={{ color: convergence.convColor }}>
              {convergence.convergence}
            </div>
            <div className="wsig-strip-detail">
              <span style={{ color: "#059669" }}>{convergence.bullish} Bull</span>
              <span style={{ color: "#dc2626" }}>{convergence.bearish} Bear</span>
              <span style={{ color: "#6b7280" }}>{convergence.neutral} Neutral</span>
            </div>
          </div>
        </div>

        <div className="wsig-strip-card">
          <div className="wsig-strip-icon"><Activity size={14} /></div>
          <div>
            <div className="wsig-strip-title">Momentum Trend</div>
            {momentum ? (
              <>
                <div className="wsig-strip-val" style={{
                  color: momentum.accelerating ? "#059669" : "#d97706"
                }}>
                  {momentum.accelerating ? "Accelerating" : "Mixed"}
                </div>
                <div className="wsig-strip-detail">
                  <span>RSI: {momentum.rsiTrend}</span>
                  <span>MACD: {momentum.macdTrend}</span>
                </div>
              </>
            ) : (
              <div className="wsig-strip-val" style={{ color: "#6b7280" }}>Insufficient Data</div>
            )}
          </div>
        </div>

        <div className="wsig-strip-card">
          <div className="wsig-strip-icon"><Zap size={14} /></div>
          <div>
            <div className="wsig-strip-title">Trend Strength</div>
            <div className="wsig-strip-val" style={{
              color: lastPoint?.adx && lastPoint.adx > 25 ? "#4f46e5" : "#6b7280"
            }}>
              {lastPoint?.adx ? `ADX ${lastPoint.adx.toFixed(1)}` : "—"}
            </div>
            <div className="wsig-strip-detail">
              <span>R² {regression.rSquared.toFixed(2)}</span>
              {lastPoint?.atr && <span>ATR ${lastPoint.atr.toFixed(2)}</span>}
            </div>
          </div>
        </div>

        <div className="wsig-strip-card">
          <div className="wsig-strip-icon"><BarChart3 size={14} /></div>
          <div>
            <div className="wsig-strip-title">Volatility</div>
            {lastPoint?.bbUpper && lastPoint?.bbLower && lastPoint?.bbMiddle ? (
              <>
                <div className="wsig-strip-val">
                  {((lastPoint.bbUpper - lastPoint.bbLower) / lastPoint.bbMiddle * 100).toFixed(1)}% BB Width
                </div>
                <div className="wsig-strip-detail">
                  <span>{lastPoint.atr ? `ATR $${lastPoint.atr.toFixed(2)}` : ""}</span>
                </div>
              </>
            ) : (
              <div className="wsig-strip-val" style={{ color: "#6b7280" }}>—</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Legend + Customize Toggle ──────────────────── */}
      <div className="wsig-toolbar">
        <div className="wsig-cat-legend">
          {Object.entries(CAT_COLORS).map(([cat, color]) => (
            <span key={cat} className="wsig-cat-chip" style={{ color, borderColor: color + "40", background: color + "10" }}>
              <span style={{ background: color, width: 6, height: 6, borderRadius: "50%", display: "inline-block", marginRight: 4 }} />
              {cat}
            </span>
          ))}
        </div>
        <button className="wsig-customize-btn" onClick={() => setShowCustomize(!showCustomize)}>
          <Sliders size={12} />
          {showCustomize ? "Done" : "Weights"}
        </button>
      </div>

      {showCustomize && (
        <div className="wsig-customize-bar fade-in">
          <span className="wsig-customize-info">
            Total: {totalWeight}% {totalWeight !== 100 && <span style={{ color: "#d97706" }}>(scores normalized)</span>}
          </span>
          <button className="wsig-reset-btn" onClick={resetWeights}>Reset Defaults</button>
        </div>
      )}

      {/* ── Weight/Signal Header ──────────────────────────────── */}
      <div className="wsig-weight-header">
        <span>Indicator</span>
        <span>Weight · Score · Signal</span>
      </div>

      {/* ── Indicator Rows ────────────────────────────────────── */}
      <div className="wsig-rows">
        {INDICATOR_DEFS.map(def => (
          <IndicatorRow
            key={def.id}
            def={def}
            signal={signalMap[def.id] ?? "N/A"}
            weight={weights[def.id]}
            onWeightChange={v => updateWeight(def.id, v)}
            lastPoint={lastPoint}
            data={data}
          />
        ))}
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="wsig-footer">
        <div>
          {individual.length} active indicators · Composite across {convergence.total} signals
          {regression.rSquared < 0.4 && " · Low R² — regression trend is noisy"}
        </div>
        <div style={{ marginTop: 2 }}>
          R² = {regression.rSquared.toFixed(3)} · Slope = {regression.slope.toFixed(4)}/day
          · Not financial advice · Past signals ≠ future returns
        </div>
      </div>
    </Card>
  );
}
