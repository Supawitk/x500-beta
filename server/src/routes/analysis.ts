import { Elysia, t } from "elysia";
import { fetchHistory, fetchHistoryRange } from "../services/historical";
import { analyzeStock } from "../services/analysis";
import { fetchStockDetail } from "../services/stockDetail";
import { getAllStocks } from "../services/stockService";
import { analyzeNewsImpact } from "../services/newsImpact";

export const analysisRoutes = new Elysia({ prefix: "/api/analysis" })
  .get("/:symbol", async ({ params, query }) => {
    try {
      const symbol = params.symbol.toUpperCase();
      const period = query.period || "6mo";
      const interval = (query.interval as "1d" | "1wk") || "1d";

      const [history, detail] = await Promise.all([
        fetchHistory(symbol, period, interval),
        fetchStockDetail(symbol),
      ]);

      if (history.length === 0) {
        return { error: "NO_DATA", message: "No historical data available" };
      }

      const analysis = analyzeStock(symbol, history, period);
      return { ...analysis, detail };
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch analysis data" };
    }
  }, {
    query: t.Object({
      period: t.Optional(t.String()),
      interval: t.Optional(t.String()),
    }),
  })
  .get("/benchmark/:symbol", async ({ params, query }) => {
    try {
      const symbol = params.symbol.toUpperCase();
      const period = query.period || "6mo";
      const [stockHist, spyHist] = await Promise.all([
        fetchHistory(symbol, period, "1d"),
        fetchHistory("SPY", period, "1d"),
      ]);
      if (stockHist.length === 0 || spyHist.length === 0) {
        return { error: "NO_DATA", message: "No benchmark data available" };
      }
      // Align by date
      const spyMap = new Map(spyHist.map(h => [h.date, h.close]));
      const aligned: { date: string; stock: number; spy: number }[] = [];
      const stockBase = stockHist[0].close;
      const firstSpyDate = stockHist.find(h => spyMap.has(h.date));
      const spyBase = firstSpyDate ? spyMap.get(firstSpyDate.date)! : spyHist[0].close;

      for (const h of stockHist) {
        const spyClose = spyMap.get(h.date);
        if (spyClose != null) {
          aligned.push({
            date: h.date,
            stock: Math.round(((h.close / stockBase) - 1) * 10000) / 100,
            spy: Math.round(((spyClose / spyBase) - 1) * 10000) / 100,
          });
        }
      }
      const last = aligned[aligned.length - 1];
      return {
        symbol,
        data: aligned,
        stockReturn: last?.stock ?? 0,
        spyReturn: last?.spy ?? 0,
        alpha: last ? Math.round((last.stock - last.spy) * 100) / 100 : 0,
      };
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch benchmark data" };
    }
  }, {
    query: t.Object({ period: t.Optional(t.String()) }),
  })
  .get("/news-impact/:symbol", async ({ params }) => {
    try {
      const symbol = params.symbol.toUpperCase();
      return await analyzeNewsImpact(symbol);
    } catch (e: any) {
      return { error: "ANALYSIS_FAILED", message: e.message ?? "News impact analysis failed" };
    }
  })
  .get("/history-range/:symbol", async ({ params, query }) => {
    try {
      const symbol = params.symbol.toUpperCase();
      const startDate = query.start;
      const endDate = query.end;
      const interval = (query.interval as "1d" | "1wk") || "1d";

      if (!startDate || !endDate) {
        return { error: "MISSING_PARAMS", message: "start and end query params required" };
      }

      const data = await fetchHistoryRange(symbol, startDate, endDate, interval);
      return { symbol, data, start: startDate, end: endDate };
    } catch (e: any) {
      return { error: "FETCH_FAILED", message: e.message ?? "Failed to fetch history range" };
    }
  }, {
    query: t.Object({
      start: t.Optional(t.String()),
      end: t.Optional(t.String()),
      interval: t.Optional(t.String()),
    }),
  })
  .get("/trending", async () => {
    try {
      const stocks = await getAllStocks();
      const byChange = [...stocks]
        .filter((s) => s.marketCap > 0)
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 20);
      return {
        movers: byChange,
        gainers: byChange.filter((s) => s.changePercent > 0).slice(0, 10),
        losers: byChange.filter((s) => s.changePercent < 0).slice(0, 10),
      };
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch trending data" };
    }
  });
