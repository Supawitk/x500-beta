import { Elysia, t } from "elysia";
import { getAllStocks, filterStocks } from "../services/stockService";
import { fetchSingleQuote } from "../services/yahoo";

export const stockRoutes = new Elysia({ prefix: "/api/stocks" })
  .get("/", async ({ query }) => {
    try {
      const stocks = await getAllStocks();
      return filterStocks(stocks, {
        sector: query.sector || undefined,
        industry: query.industry || undefined,
        search: query.search || undefined,
        minDividendYield: query.minDividendYield
          ? parseFloat(query.minDividendYield) : undefined,
        maxPE: query.maxPE ? parseFloat(query.maxPE) : undefined,
        minHealthScore: query.minHealthScore
          ? parseFloat(query.minHealthScore) : undefined,
        sortBy: query.sortBy || undefined,
        sortOrder: query.sortOrder || "desc",
      });
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch stock data" };
    }
  }, {
    query: t.Object({
      sector: t.Optional(t.String()),
      industry: t.Optional(t.String()),
      search: t.Optional(t.String()),
      minDividendYield: t.Optional(t.String()),
      maxPE: t.Optional(t.String()),
      minHealthScore: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.String()),
    }),
  })
  .get("/top/value", async () => {
    try {
      const stocks = await getAllStocks();
      return stocks
        .filter((s) => s.marginOfSafety !== null && s.marginOfSafety > 0)
        .sort((a, b) => (b.marginOfSafety ?? 0) - (a.marginOfSafety ?? 0))
        .slice(0, 15);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch data" };
    }
  })
  .get("/top/dividend", async () => {
    try {
      const stocks = await getAllStocks();
      return stocks
        .filter((s) => s.dividendYield !== null && s.dividendYield > 0)
        .sort((a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0))
        .slice(0, 15);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch data" };
    }
  })
  .get("/top/health", async () => {
    try {
      const stocks = await getAllStocks();
      return stocks
        .filter((s) => s.healthScore !== null)
        .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))
        .slice(0, 15);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch data" };
    }
  })
  .get("/compare", async ({ query }) => {
    try {
      const symbols = (query.symbols || "").split(",").filter(Boolean);
      if (symbols.length < 2) {
        return { error: "BAD_REQUEST", message: "Provide at least 2 symbols" };
      }
      const stocks = await getAllStocks();
      return stocks.filter((s) => symbols.includes(s.symbol.toUpperCase()));
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch data" };
    }
  }, {
    query: t.Object({ symbols: t.Optional(t.String()) }),
  })
  .get("/:symbol", async ({ params }) => {
    try {
      const stock = await fetchSingleQuote(params.symbol.toUpperCase());
      if (!stock) return { error: "NOT_FOUND", message: "Stock not found" };
      return stock;
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch data" };
    }
  });
