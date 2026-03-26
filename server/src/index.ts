import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { stockRoutes } from "./routes/stocks";
import { fetchQuotesPage } from "./services/yahoo";
import { SP500_SYMBOLS } from "./config/symbols";
import { marketRoutes } from "./routes/market";
import { watchlistRoutes } from "./routes/watchlist";
import { analysisRoutes } from "./routes/analysis";
import { searchRoutes } from "./routes/search";
import { compareRoutes } from "./routes/compare";
import { correlationRoutes } from "./routes/correlation";
import { predictionRoutes } from "./routes/prediction";
import { earningsRoutes } from "./routes/earnings";
import { newsRoutes } from "./routes/news";

const app = new Elysia()
  .use(cors({ origin: true }))
  .get("/api/stocks-page/:page", async ({ params }) => {
    try {
      const page = parseInt(params.page) || 0;
      return await fetchQuotesPage(SP500_SYMBOLS, page);
    } catch {
      return { error: "FETCH_FAILED", message: "Unable to fetch stock data" };
    }
  })
  .use(stockRoutes)
  .use(marketRoutes)
  .use(watchlistRoutes)
  .use(analysisRoutes)
  .use(searchRoutes)
  .use(compareRoutes)
  .use(correlationRoutes)
  .use(predictionRoutes)
  .use(earningsRoutes)
  .use(newsRoutes)
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(3001);

console.log(`Server running at http://localhost:${app.server?.port}`);
