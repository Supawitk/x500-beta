import { Elysia, t } from "elysia";
import {
  getWatchlist, getWatchlistSymbols,
  addToWatchlist, removeFromWatchlist,
  updateWatchlistEntry,
} from "../services/watchlist";

export const watchlistRoutes = new Elysia({ prefix: "/api/watchlist" })
  .get("/", () => {
    return {
      symbols: getWatchlistSymbols(),
      entries: getWatchlist(),
    };
  })
  .post("/", ({ body }) => {
    const added = addToWatchlist(body.symbol);
    return { success: added, symbols: getWatchlistSymbols() };
  }, {
    body: t.Object({ symbol: t.String() }),
  })
  .patch("/:symbol", ({ params, body }) => {
    const entry = updateWatchlistEntry(params.symbol, {
      targetPrice: body.targetPrice,
      notes: body.notes,
    });
    if (!entry) return { error: "NOT_FOUND", message: "Symbol not in watchlist" };
    return { success: true, entry };
  }, {
    body: t.Object({
      targetPrice: t.Optional(t.Nullable(t.Number())),
      notes: t.Optional(t.String()),
    }),
  })
  .delete("/:symbol", ({ params }) => {
    const removed = removeFromWatchlist(params.symbol);
    return { success: removed, symbols: getWatchlistSymbols() };
  });
