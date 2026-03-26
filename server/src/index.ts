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
import { join } from "path";
import { existsSync } from "fs";

const PORT = parseInt(process.env.PORT || "3001");
const clientDist = join(import.meta.dir, "../../client/dist");
const hasClientBuild = existsSync(clientDist);

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
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }));

// Serve React frontend in production
if (hasClientBuild) {
  // Serve static assets
  app.get("/assets/*", ({ params }) => {
    const filePath = join(clientDist, "assets", (params as any)["*"]);
    return new Response(Bun.file(filePath));
  });

  // Serve other static files (favicon, etc.)
  app.get("/*", ({ path, set }) => {
    // Skip API routes
    if (path.startsWith("/api")) return;

    const filePath = join(clientDist, path);
    if (existsSync(filePath) && !Bun.file(filePath).name?.endsWith("/")) {
      return new Response(Bun.file(filePath));
    }

    // SPA fallback — serve index.html for all non-file routes
    return new Response(Bun.file(join(clientDist, "index.html")), {
      headers: { "Content-Type": "text/html" },
    });
  });

  console.log("Serving React frontend from client/dist");
}

app.listen(PORT);

console.log(`Server running at http://localhost:${app.server?.port}`);
