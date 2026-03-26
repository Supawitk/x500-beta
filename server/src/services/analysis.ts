import type { OHLCV } from "./historical";
import { calcEMA, calcMACD } from "../utils/ema";
import { calcStochastic } from "../utils/stochastic";
import { calcRSI } from "../utils/rsi";
import { calcRegression, trendDirection } from "../utils/regression";

export interface AnalysisResult {
  symbol: string;
  period: string;
  data: AnalysisDataPoint[];
  signals: SignalSummary;
  regression: {
    slope: number;
    intercept: number;
    rSquared: number;
    trend: string;
  };
}

export interface AnalysisDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema12: number | null;
  ema26: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  regressionLine: number | null;
  ichimokuTenkan: number | null;
  ichimokuKijun: number | null;
  ichimokuSpanA: number | null;
  ichimokuSpanB: number | null;
  ichimokuChikou: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  atr: number | null;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
}

export interface SignalSummary {
  emaSignal: string;
  rsiSignal: string;
  stochSignal: string;
  macdSignal: string;
  trendSignal: string;
  ichimokuSignal: string;
  bollingerSignal: string;
  adxSignal: string;
  volumeSignal: string;
  ema200Signal: string;
  overall: string;
}

export function analyzeStock(
  symbol: string,
  history: OHLCV[],
  period: string
): AnalysisResult {
  const closes = history.map((h) => h.close);
  const ohlc = history.map((h) => ({ high: h.high, low: h.low, close: h.close }));

  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi = calcRSI(closes);
  const { percentK, percentD } = calcStochastic(ohlc);
  const { macdLine, signal: macdSig, histogram } = calcMACD(closes);
  const reg = calcRegression(closes);
  const ichimoku = calcIchimoku(history);
  const bb = calcBollingerBands(closes);
  const atrArr = calcATR(ohlc);
  const adxData = calcADX(ohlc);

  const data: AnalysisDataPoint[] = history.map((h, i) => ({
    ...h,
    ema12: r(ema12[i]),
    ema26: r(ema26[i]),
    ema50: r(ema50[i]),
    ema200: r(ema200[i]),
    rsi: r(rsi[i]),
    stochK: r(percentK[i]),
    stochD: r(percentD[i]),
    macd: r(macdLine[i]),
    macdSignal: r(macdSig[i]),
    macdHist: r(histogram[i]),
    regressionLine: r(reg.line[i]),
    ichimokuTenkan: r(ichimoku.tenkan[i]),
    ichimokuKijun: r(ichimoku.kijun[i]),
    ichimokuSpanA: r(ichimoku.spanA[i]),
    ichimokuSpanB: r(ichimoku.spanB[i]),
    ichimokuChikou: r(ichimoku.chikou[i]),
    bbUpper: r(bb.upper[i]),
    bbMiddle: r(bb.middle[i]),
    bbLower: r(bb.lower[i]),
    atr: r(atrArr[i]),
    adx: r(adxData.adx[i]),
    plusDI: r(adxData.plusDI[i]),
    minusDI: r(adxData.minusDI[i]),
  }));

  const signals = generateSignals(data);

  return {
    symbol,
    period,
    data,
    signals,
    regression: {
      slope: reg.slope,
      intercept: reg.intercept,
      rSquared: reg.rSquared,
      trend: trendDirection(reg.slope, closes[closes.length - 1]),
    },
  };
}

function generateSignals(data: AnalysisDataPoint[]): SignalSummary {
  const last = data[data.length - 1];
  if (!last) {
    return { emaSignal: "N/A", rsiSignal: "N/A", stochSignal: "N/A",
      macdSignal: "N/A", trendSignal: "N/A", ichimokuSignal: "N/A",
      bollingerSignal: "N/A", adxSignal: "N/A", volumeSignal: "N/A", ema200Signal: "N/A",
      overall: "N/A" };
  }

  const emaSignal = last.ema12 && last.ema26
    ? last.ema12 > last.ema26 ? "Bullish" : "Bearish" : "N/A";

  const rsiSignal = last.rsi !== null
    ? last.rsi > 70 ? "Overbought" : last.rsi < 30 ? "Oversold" : "Neutral"
    : "N/A";

  const stochSignal = last.stochK !== null
    ? last.stochK > 80 ? "Overbought" : last.stochK < 20 ? "Oversold" : "Neutral"
    : "N/A";

  const macdSignal = last.macd !== null && last.macdSignal !== null
    ? last.macd > last.macdSignal ? "Bullish" : "Bearish" : "N/A";

  const trendSignal = last.ema50 !== null
    ? last.close > last.ema50 ? "Above EMA50" : "Below EMA50" : "N/A";

  let ichimokuSignal = "Neutral";
  if (last.ichimokuSpanA !== null && last.ichimokuSpanB !== null &&
      last.ichimokuTenkan !== null && last.ichimokuKijun !== null) {
    const cloudTop = Math.max(last.ichimokuSpanA, last.ichimokuSpanB);
    const cloudBottom = Math.min(last.ichimokuSpanA, last.ichimokuSpanB);
    if (last.close > cloudTop && last.ichimokuTenkan > last.ichimokuKijun) {
      ichimokuSignal = "Bullish";
    } else if (last.close < cloudBottom && last.ichimokuTenkan < last.ichimokuKijun) {
      ichimokuSignal = "Bearish";
    }
  }

  const bullCount = [emaSignal, macdSignal].filter((s) => s === "Bullish").length;
  const bearCount = [emaSignal, macdSignal].filter((s) => s === "Bearish").length;
  const obCount = [rsiSignal, stochSignal].filter((s) => s === "Overbought").length;
  const osCount = [rsiSignal, stochSignal].filter((s) => s === "Oversold").length;

  let overall = "Neutral";
  if (bullCount >= 2 && osCount === 0) overall = "Bullish";
  else if (bearCount >= 2 && obCount === 0) overall = "Bearish";
  else if (obCount >= 2) overall = "Overbought - Caution";
  else if (osCount >= 2) overall = "Oversold - Opportunity";

  // Bollinger Bands signal
  let bollingerSignal = "N/A";
  if (last.bbUpper && last.bbLower && last.bbMiddle) {
    if (last.close > last.bbUpper) bollingerSignal = "Overbought";
    else if (last.close < last.bbLower) bollingerSignal = "Oversold";
    else if (last.close > last.bbMiddle) bollingerSignal = "Above Mid";
    else bollingerSignal = "Below Mid";
  }

  // ADX signal
  let adxSignal = "N/A";
  if (last.adx !== null) {
    if (last.adx > 50) adxSignal = "Very Strong Trend";
    else if (last.adx > 25) adxSignal = "Strong Trend";
    else if (last.adx > 20) adxSignal = "Weak Trend";
    else adxSignal = "No Trend";
  }

  // Volume signal
  const recentData = data.slice(-20);
  const avgVol = recentData.reduce((s, d) => s + d.volume, 0) / recentData.length;
  let volumeSignal = "N/A";
  if (avgVol > 0) {
    const volRatio = last.volume / avgVol;
    if (volRatio > 1.5) volumeSignal = "High Volume";
    else if (volRatio > 1.0) volumeSignal = "Above Average";
    else if (volRatio > 0.5) volumeSignal = "Below Average";
    else volumeSignal = "Low Volume";
  }

  // EMA200 signal
  const ema200Signal = last.ema200 !== null
    ? last.close > last.ema200 ? "Above EMA200" : "Below EMA200"
    : "N/A";

  return { emaSignal, rsiSignal, stochSignal, macdSignal, trendSignal, ichimokuSignal,
    bollingerSignal, adxSignal, volumeSignal, ema200Signal, overall };
}

function periodHighLow(data: OHLCV[], index: number, period: number): { high: number; low: number } | null {
  if (index < period - 1) return null;
  let high = -Infinity;
  let low = Infinity;
  for (let i = index - period + 1; i <= index; i++) {
    if (data[i].high > high) high = data[i].high;
    if (data[i].low < low) low = data[i].low;
  }
  return { high, low };
}

function calcIchimoku(history: OHLCV[]) {
  const len = history.length;
  const tenkan: (number | null)[] = new Array(len).fill(null);
  const kijun: (number | null)[] = new Array(len).fill(null);
  const spanA: (number | null)[] = new Array(len + 26).fill(null);
  const spanB: (number | null)[] = new Array(len + 26).fill(null);
  const chikou: (number | null)[] = new Array(len).fill(null);

  for (let i = 0; i < len; i++) {
    const hl9 = periodHighLow(history, i, 9);
    if (hl9) tenkan[i] = (hl9.high + hl9.low) / 2;

    const hl26 = periodHighLow(history, i, 26);
    if (hl26) kijun[i] = (hl26.high + hl26.low) / 2;

    if (tenkan[i] !== null && kijun[i] !== null) {
      spanA[i + 26] = (tenkan[i]! + kijun[i]!) / 2;
    }

    const hl52 = periodHighLow(history, i, 52);
    if (hl52) {
      spanB[i + 26] = (hl52.high + hl52.low) / 2;
    }

    if (i >= 26) {
      chikou[i - 26] = history[i].close;
    }
  }

  // Trim spanA and spanB to len (future values beyond data length are dropped)
  return {
    tenkan,
    kijun,
    spanA: spanA.slice(0, len),
    spanB: spanB.slice(0, len),
    chikou,
  };
}

// ── Bollinger Bands (20-period SMA ± 2 std dev) ────────────────────────────
function calcBollingerBands(closes: number[], period = 20, mult = 2) {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); middle.push(null); lower.push(null); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period);
    middle.push(sma);
    upper.push(sma + mult * std);
    lower.push(sma - mult * std);
  }
  return { upper, middle, lower };
}

// ── ATR (Average True Range, 14-period) ─────────────────────────────────────
function calcATR(history: { high: number; low: number; close: number }[], period = 14): (number | null)[] {
  const atr: (number | null)[] = [null];
  const tr: number[] = [history[0].high - history[0].low];
  for (let i = 1; i < history.length; i++) {
    const h = history[i].high, l = history[i].low, pc = history[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    if (i < period) { atr.push(null); }
    else if (i === period) { atr.push(tr.slice(0, period + 1).reduce((a, b) => a + b, 0) / (period + 1)); }
    else { atr.push((atr[i - 1]! * (period - 1) + tr[i]) / period); }
  }
  return atr;
}

// ── ADX (Average Directional Index, 14-period) ─────────────────────────────
function calcADX(history: { high: number; low: number; close: number }[], period = 14) {
  const len = history.length;
  const adx: (number | null)[] = new Array(len).fill(null);
  const plusDI: (number | null)[] = new Array(len).fill(null);
  const minusDI: (number | null)[] = new Array(len).fill(null);
  if (len < period * 2) return { adx, plusDI, minusDI };

  const plusDM: number[] = [0], minusDM: number[] = [0];
  const tr: number[] = [history[0].high - history[0].low];
  for (let i = 1; i < len; i++) {
    const up = history[i].high - history[i - 1].high;
    const dn = history[i - 1].low - history[i].low;
    plusDM.push(up > dn && up > 0 ? up : 0);
    minusDM.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(history[i].high - history[i].low,
      Math.abs(history[i].high - history[i - 1].close),
      Math.abs(history[i].low - history[i - 1].close)));
  }

  let sPDM = 0, sMDM = 0, sTR = 0;
  for (let i = 0; i < period; i++) { sPDM += plusDM[i + 1] || 0; sMDM += minusDM[i + 1] || 0; sTR += tr[i + 1] || 0; }

  const dx: number[] = [];
  for (let i = period; i < len; i++) {
    if (i > period) { sPDM = sPDM - sPDM / period + plusDM[i]; sMDM = sMDM - sMDM / period + minusDM[i]; sTR = sTR - sTR / period + tr[i]; }
    const pdi = sTR > 0 ? (sPDM / sTR) * 100 : 0;
    const mdi = sTR > 0 ? (sMDM / sTR) * 100 : 0;
    plusDI[i] = pdi; minusDI[i] = mdi;
    const diSum = pdi + mdi;
    const dxVal = diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0;
    dx.push(dxVal);
    if (dx.length >= period) {
      adx[i] = dx.length === period ? dx.reduce((a, b) => a + b, 0) / period : (adx[i - 1]! * (period - 1) + dxVal) / period;
    }
  }
  return { adx, plusDI, minusDI };
}

function r(v: number | null | undefined): number | null {
  return v != null ? Math.round(v * 100) / 100 : null;
}
