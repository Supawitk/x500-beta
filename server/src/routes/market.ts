import { Elysia } from "elysia";
import {
  getAllStocks, getSectors, getIndustries, getMarketSummary,
} from "../services/stockService";

export const marketRoutes = new Elysia({ prefix: "/api" })
  .get("/sectors", async () => {
    try {
      const stocks = await getAllStocks();
      return getSectors(stocks);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch sector data" };
    }
  })
  .get("/industries", async () => {
    try {
      const stocks = await getAllStocks();
      return getIndustries(stocks);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch industry data" };
    }
  })
  .get("/market/summary", async () => {
    try {
      const stocks = await getAllStocks();
      return await getMarketSummary(stocks);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch market data" };
    }
  });
