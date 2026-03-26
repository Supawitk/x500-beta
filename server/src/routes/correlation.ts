import { Elysia, t } from "elysia";
import { fetchHistory } from "../services/historical";
import {
  calcCorrelation, toReturns, calcBeta, normalizePrices,
} from "../utils/correlation";
import { calcRegression } from "../utils/regression";
import { getCache, setCache } from "../services/cache";

const SECTOR_ETFS: Record<string, string> = {
  "Technology": "XLK", "Healthcare": "XLV", "Financial Services": "XLF",
  "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP", "Energy": "XLE",
  "Industrials": "XLI", "Utilities": "XLU", "Real Estate": "XLRE",
  "Communication Services": "XLC", "Basic Materials": "XLB", "S&P 500": "SPY",
};

export const correlationRoutes = new Elysia({ prefix: "/api/correlation" })
  .get("/sectors", async () => {
    const cacheKey = "sector_corr_matrix";
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const names = Object.keys(SECTOR_ETFS);
      const symbols = Object.values(SECTOR_ETFS);
      const histories = await Promise.all(
        symbols.map((sym) => fetchHistory(sym, "6mo").catch(() => []))
      );
      const returns = histories.map((h) => toReturns(h.map((d) => d.close)));

      const matrix: Record<string, Record<string, number>> = {};
      for (let i = 0; i < names.length; i++) {
        matrix[names[i]] = {};
        for (let j = 0; j < names.length; j++) {
          matrix[names[i]][names[j]] = i === j ? 1 : calcCorrelation(returns[i], returns[j]);
        }
      }

      const result = { sectors: names, matrix };
      setCache(cacheKey, result, 300_000);
      return result;
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to compute correlations" };
    }
  })

  .get("/stock/:symbol", async ({ params }) => {
    const symbol = params.symbol.toUpperCase();
    const cacheKey = `stock_corr_${symbol}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch stock + SPY + all sector ETFs
      const benchmarks = ["SPY", ...Object.values(SECTOR_ETFS).filter((s) => s !== "SPY")];
      const benchmarkNames = ["S&P 500", ...Object.keys(SECTOR_ETFS).filter((s) => s !== "S&P 500")];

      const [stockHist, ...benchHists] = await Promise.all([
        fetchHistory(symbol, "6mo"),
        ...benchmarks.map((s) => fetchHistory(s, "6mo").catch(() => [])),
      ]);

      if (stockHist.length < 20) {
        return { error: "INSUFFICIENT_DATA", message: "Not enough data" };
      }

      const stockCloses = stockHist.map((h) => h.close);
      const stockReturns = toReturns(stockCloses);
      const stockVolumes = stockHist.map((h) => h.volume);
      const stockReg = calcRegression(stockCloses);

      // Rolling volatility (20-day)
      const stockVol: number[] = [];
      for (let i = 20; i < stockReturns.length; i++) {
        const slice = stockReturns.slice(i - 20, i);
        stockVol.push(Math.sqrt(slice.reduce((a, r) => a + r * r, 0) / 20));
      }

      // Correlations vs each benchmark
      const benchCorrelations: Record<string, any> = {};
      for (let i = 0; i < benchmarks.length; i++) {
        if (benchHists[i].length < 20) continue;
        const bCloses = benchHists[i].map((h) => h.close);
        const bReturns = toReturns(bCloses);
        const minLen = Math.min(stockReturns.length, bReturns.length);
        const sr = stockReturns.slice(-minLen);
        const br = bReturns.slice(-minLen);

        benchCorrelations[benchmarkNames[i]] = {
          etf: benchmarks[i],
          returns_corr: calcCorrelation(sr, br),
          beta: calcBeta(sr, br),
        };
      }

      // Internal parameter correlations for this stock
      // price vs volume, returns vs volume, volatility vs returns
      const minLen = Math.min(stockReturns.length, stockVolumes.length - 1);
      const retSlice = stockReturns.slice(-minLen);
      const volSlice = stockVolumes.slice(1).slice(-minLen).map(Number);
      const priceSlice = stockCloses.slice(1).slice(-minLen);

      const paramMatrix: Record<string, Record<string, number>> = {};
      const paramNames = ["Price", "Returns", "Volume"];
      const paramData = [priceSlice, retSlice, volSlice];

      for (let i = 0; i < paramNames.length; i++) {
        paramMatrix[paramNames[i]] = {};
        for (let j = 0; j < paramNames.length; j++) {
          paramMatrix[paramNames[i]][paramNames[j]] = i === j
            ? 1 : calcCorrelation(paramData[i], paramData[j]);
        }
      }

      // Add volatility if enough data
      if (stockVol.length > 10) {
        const volRetLen = Math.min(stockVol.length, retSlice.length);
        paramNames.push("Volatility");
        paramMatrix["Volatility"] = {};
        for (const name of paramNames) {
          if (name === "Volatility") {
            paramMatrix["Volatility"]["Volatility"] = 1;
          } else {
            const otherIdx = ["Price", "Returns", "Volume"].indexOf(name);
            const other = paramData[otherIdx]?.slice(-volRetLen) || [];
            const volS = stockVol.slice(-volRetLen);
            const r = calcCorrelation(volS, other);
            paramMatrix["Volatility"][name] = r;
            paramMatrix[name]["Volatility"] = r;
          }
        }
      }

      // Stock summary stats
      const totalReturn = (stockCloses[stockCloses.length - 1] / stockCloses[0] - 1);
      const annVol = Math.sqrt(stockReturns.reduce((a, r) => a + r * r, 0) / stockReturns.length) * Math.sqrt(252);

      const result = {
        symbol,
        dataPoints: stockHist.length,
        benchmarkCorrelations: benchCorrelations,
        parameterMatrix: { params: paramNames, matrix: paramMatrix },
        stats: {
          totalReturn: round4(totalReturn),
          annualizedVol: round4(annVol),
          regressionSlope: stockReg.slope,
          regressionR2: stockReg.rSquared,
          avgDailyReturn: round4(stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length),
        },
      };

      setCache(cacheKey, result, 120_000);
      return result;
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to compute stock correlations" };
    }
  });

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
