import { Elysia, t } from "elysia";
import YahooFinance from "yahoo-finance2";
import { getAllStocks } from "../services/stockService";
import { getCache, setCache } from "../services/cache";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export const searchRoutes = new Elysia({ prefix: "/api" })
  .get("/search", async ({ query }) => {
    try {
      const q = (query.q ?? "").trim();
      if (q.length < 1) return { results: [] };

      const lower = q.toLowerCase();

      // 1. Search local S&P500 cache first (fast, keyword-friendly)
      const cacheKey = "all_stocks_search";
      let cached = getCache<any[]>(cacheKey);
      if (!cached) {
        try {
          const stocks = await getAllStocks();
          cached = stocks.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            sector: s.sector,
            industry: s.industry,
            exchange: "NYSE/NASDAQ",
          }));
          setCache(cacheKey, cached, 300_000); // 5 min cache
        } catch { cached = []; }
      }

      const localMatches = (cached ?? []).filter((s) =>
        s.symbol.toLowerCase().includes(lower) ||
        s.name.toLowerCase().includes(lower) ||
        s.industry.toLowerCase().includes(lower) ||
        s.sector.toLowerCase().includes(lower)
      ).slice(0, 10).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        exchange: `${s.sector} · ${s.industry}`,
        score: s.symbol.toLowerCase() === lower ? 2000
          : s.symbol.toLowerCase().startsWith(lower) ? 1500
          : s.name.toLowerCase().startsWith(lower) ? 1000
          : s.industry.toLowerCase().includes(lower) ? 500
          : 100,
      }));

      // 2. Yahoo Finance search for non-S&P500 stocks
      let yfMatches: any[] = [];
      try {
        const result: any = await yf.search(q, {}, { validateResult: false });
        const localSymbols = new Set(localMatches.map((r) => r.symbol));
        yfMatches = (result.quotes || [])
          .filter((r: any) =>
            r.quoteType === "EQUITY" &&
            r.symbol &&
            (r.shortname || r.longname) &&
            !localSymbols.has(r.symbol) &&
            // Prefer US exchanges
            (!r.exchange || ["NMS", "NYQ", "NGM", "PCX", "ASE", "NASDAQ", "NYSE"].includes(r.exchange))
          )
          .slice(0, 6)
          .map((r: any) => ({
            symbol: r.symbol,
            name: r.shortname || r.longname || r.symbol,
            exchange: r.exchDisp || r.exchange || "",
            score: r.score ?? 0,
          }));
      } catch { /* Yahoo search failed, local results still returned */ }

      // Merge and sort by score
      const merged = [...localMatches, ...yfMatches]
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

      return { results: merged };
    } catch {
      return { results: [] };
    }
  }, {
    query: t.Object({ q: t.Optional(t.String()) }),
  });
