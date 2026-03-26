import { Elysia, t } from "elysia";
import { fetchHistory } from "../services/historical";
import { fetchStockDetail } from "../services/stockDetail";
import { fetchSingleQuote } from "../services/yahoo";
import { calcRegression, trendDirection } from "../utils/regression";
import {
  calcCorrelation, toReturns, calcBeta, normalizePrices,
} from "../utils/correlation";

/* ── helper: rolling volatility (annualized, 20-day window) ── */
function rollingVol(returns: number[], window = 20): number[] {
  const result: number[] = [];
  for (let i = 0; i < returns.length; i++) {
    if (i < window - 1) { result.push(0); continue; }
    const slice = returns.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    result.push(Math.round(Math.sqrt(variance) * Math.sqrt(252) * 10000) / 100); // as %
  }
  return result;
}

/* ── helper: drawdown series ── */
function calcDrawdown(closes: number[]): number[] {
  let peak = closes[0] || 1;
  return closes.map(c => {
    if (c > peak) peak = c;
    return Math.round(((c - peak) / peak) * 10000) / 100;
  });
}

/* ── helper: monthly returns ── */
function monthlyReturns(history: { date: string; close: number }[]): { month: string; return: number }[] {
  const byMonth: Record<string, number[]> = {};
  for (const h of history) {
    const m = h.date.slice(0, 7); // YYYY-MM
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(h.close);
  }
  const months = Object.keys(byMonth).sort();
  const result: { month: string; return: number }[] = [];
  for (let i = 1; i < months.length; i++) {
    const prev = byMonth[months[i - 1]];
    const curr = byMonth[months[i]];
    const startP = prev[prev.length - 1];
    const endP = curr[curr.length - 1];
    result.push({ month: months[i], return: Math.round(((endP / startP - 1) * 100) * 100) / 100 });
  }
  return result;
}

/* ── helper: daily return distribution bins ── */
function returnDistribution(returns: number[]): { bin: number; count: number }[] {
  const pctReturns = returns.map(r => Math.round(r * 10000) / 100); // as %
  const bins: Record<number, number> = {};
  for (const r of pctReturns) {
    const b = Math.round(r); // 1% bins
    bins[b] = (bins[b] || 0) + 1;
  }
  return Object.entries(bins)
    .map(([b, c]) => ({ bin: Number(b), count: c }))
    .sort((a, b) => a.bin - b.bin);
}

/* ── helper: risk metrics ── */
function riskMetrics(returns: number[], rfDaily = 0.0002) {
  const n = returns.length;
  if (n < 2) return { sharpe: 0, sortino: 0, maxDrawdown: 0, winRate: 0, avgWin: 0, avgLoss: 0, volatility: 0 };
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const downside = returns.filter(r => r < 0);
  const downDev = downside.length > 0 ? Math.sqrt(downside.reduce((a, b) => a + b ** 2, 0) / downside.length) : 0.001;
  const wins = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);
  return {
    sharpe: Math.round(((mean - rfDaily) / (std || 0.001)) * Math.sqrt(252) * 100) / 100,
    sortino: Math.round(((mean - rfDaily) / downDev) * Math.sqrt(252) * 100) / 100,
    volatility: Math.round(std * Math.sqrt(252) * 10000) / 100,
    winRate: Math.round((wins.length / n) * 10000) / 100,
    avgWin: wins.length > 0 ? Math.round((wins.reduce((a, b) => a + b, 0) / wins.length) * 10000) / 100 : 0,
    avgLoss: losses.length > 0 ? Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 10000) / 100 : 0,
  };
}

export const compareRoutes = new Elysia({ prefix: "/api/compare" })
  .get("/", async ({ query }) => {
    try {
      const symbols = (query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (symbols.length < 2) {
        return { error: "BAD_REQUEST", message: "Provide at least 2 symbols" };
      }

      const period = query.period || "6mo";

      // Fetch everything in parallel
      const [spyHistory, ...allData] = await Promise.all([
        fetchHistory("SPY", period),
        ...symbols.map(async (sym) => {
          const [quote, detail, history] = await Promise.all([
            fetchSingleQuote(sym),
            fetchStockDetail(sym),
            fetchHistory(sym, period),
          ]);
          return { symbol: sym, quote, detail, history };
        }),
      ]);

      const spyCloses = spyHistory.map((h) => h.close);
      const spyReturns = toReturns(spyCloses);
      const spyNorm = normalizePrices(spyCloses);
      const spyReg = calcRegression(spyCloses);

      const stocks = allData.map((d) => {
        const closes = d.history.map((h) => h.close);
        const volumes = d.history.map((h) => h.volume);
        const returns = toReturns(closes);
        const reg = calcRegression(closes);
        const lastPrice = closes[closes.length - 1] || 0;
        const risk = riskMetrics(returns);

        return {
          symbol: d.symbol,
          quote: d.quote,
          detail: d.detail,
          regression: {
            slope: reg.slope,
            rSquared: reg.rSquared,
            trend: trendDirection(reg.slope, lastPrice),
          },
          marketCorrelation: calcCorrelation(returns, spyReturns),
          marketBeta: calcBeta(returns, spyReturns),
          normalizedPrices: normalizePrices(closes),
          totalReturn: closes.length > 1
            ? Math.round(((closes[closes.length - 1] / closes[0] - 1) * 100) * 100) / 100
            : 0,
          // NEW: enhanced data
          risk,
          drawdown: calcDrawdown(closes),
          rollingVolatility: rollingVol(returns),
          monthlyReturns: monthlyReturns(d.history),
          returnDistribution: returnDistribution(returns),
          avgVolume: volumes.length > 0 ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : 0,
          volumeTrend: volumes.length > 20
            ? Math.round(((volumes.slice(-20).reduce((a, b) => a + b, 0) / 20) /
                (volumes.slice(0, 20).reduce((a, b) => a + b, 0) / 20) - 1) * 10000) / 100
            : 0,
        };
      });

      // Pairwise correlations
      const pairCorrelations: Record<string, number> = {};
      for (let i = 0; i < stocks.length; i++) {
        for (let j = i + 1; j < stocks.length; j++) {
          const ri = toReturns(allData[i].history.map((h) => h.close));
          const rj = toReturns(allData[j].history.map((h) => h.close));
          pairCorrelations[`${stocks[i].symbol}_${stocks[j].symbol}`] = calcCorrelation(ri, rj);
        }
      }

      // Build chart data (normalized % returns aligned by date)
      const dates = spyHistory.map((h) => h.date);
      const chartData = dates.map((date, i) => {
        const point: Record<string, any> = { date, SPY: spyNorm[i] ?? null };
        for (const s of stocks) {
          point[s.symbol] = s.normalizedPrices[i] ?? null;
        }
        return point;
      });

      // Drawdown chart data
      const drawdownData = dates.map((date, i) => {
        const point: Record<string, any> = { date };
        for (const s of stocks) {
          point[s.symbol] = s.drawdown[i] ?? null;
        }
        return point;
      });

      // Rolling volatility chart data
      const volData = dates.slice(1).map((date, i) => {
        const point: Record<string, any> = { date };
        for (const s of stocks) {
          point[s.symbol] = s.rollingVolatility[i] ?? null;
        }
        return point;
      });

      // Verdict
      const verdict = generateVerdict(stocks, spyReg);

      return { stocks, chartData, drawdownData, volData, pairCorrelations, verdict, period };
    } catch (e) {
      return { error: "FETCH_FAILED", message: "Unable to fetch comparison data" };
    }
  }, {
    query: t.Object({
      symbols: t.Optional(t.String()),
      period: t.Optional(t.String()),
    }),
  });

interface StockAnalysis {
  symbol: string;
  quote: any;
  detail: any;
  regression: { slope: number; rSquared: number; trend: string };
  marketCorrelation: number;
  marketBeta: number;
  totalReturn: number;
}

function generateVerdict(stocks: StockAnalysis[], spyReg: any) {
  const scored = stocks.map((s) => {
    let score = 0;
    const reasons: string[] = [];

    // Return performance
    if (s.totalReturn > 10) { score += 20; reasons.push("Strong returns"); }
    else if (s.totalReturn > 0) { score += 10; reasons.push("Positive returns"); }
    else { score -= 10; reasons.push("Negative returns"); }

    // Regression trend
    if (s.regression.trend.includes("Uptrend")) { score += 15; reasons.push(s.regression.trend); }
    else if (s.regression.trend.includes("Downtrend")) { score -= 10; reasons.push(s.regression.trend); }

    // R-squared (predictability)
    if (s.regression.rSquared > 0.7) { score += 10; reasons.push("Highly predictable trend"); }
    else if (s.regression.rSquared < 0.2) { reasons.push("Choppy/unpredictable"); }

    // Analyst recommendation
    const rec = s.detail?.recommendationKey;
    if (rec === "buy" || rec === "strong_buy") { score += 15; reasons.push(`Analyst: ${rec}`); }
    else if (rec === "sell" || rec === "strong_sell") { score -= 15; reasons.push(`Analyst: ${rec}`); }

    // Dividend yield
    const dy = s.quote?.dividendYield;
    if (dy && dy > 0.03) { score += 10; reasons.push("Good dividend yield"); }
    else if (dy && dy > 0) { score += 5; }

    // Health score
    const hs = s.quote?.healthScore;
    if (hs && hs > 70) { score += 10; reasons.push("High health score"); }
    else if (hs && hs < 30) { score -= 5; reasons.push("Low health score"); }

    // Margin of safety
    const mos = s.quote?.marginOfSafety;
    if (mos && mos > 10) { score += 10; reasons.push("Undervalued"); }
    else if (mos && mos < -30) { score -= 5; reasons.push("Overvalued"); }

    // Upside to target
    if (s.detail?.analystTargetMean && s.quote?.price) {
      const upside = (s.detail.analystTargetMean - s.quote.price) / s.quote.price * 100;
      if (upside > 20) { score += 10; reasons.push(`${upside.toFixed(0)}% upside to target`); }
    }

    return { symbol: s.symbol, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const allBad = scored.every((s) => s.score < 10);
  const allGood = scored.every((s) => s.score > 40);

  let summary: string;
  if (allBad) {
    summary = "Neither stock looks strong right now. Consider waiting for better entry points or looking at other opportunities.";
  } else if (allGood) {
    summary = `All compared stocks show strength. ${best.symbol} edges ahead slightly.`;
  } else {
    summary = `${best.symbol} appears to be the stronger pick based on fundamentals, trend, and analyst sentiment.`;
  }

  return { scored, summary };
}
