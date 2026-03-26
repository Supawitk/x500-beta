export interface WatchlistEntry {
  symbol: string;
  targetPrice: number | null;
  notes: string;
  addedAt: string;
}

const watchlist = new Map<string, WatchlistEntry>();

export function getWatchlist(): WatchlistEntry[] {
  return Array.from(watchlist.values());
}

export function getWatchlistSymbols(): string[] {
  return Array.from(watchlist.keys());
}

export function addToWatchlist(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (watchlist.has(upper)) return false;
  watchlist.set(upper, {
    symbol: upper,
    targetPrice: null,
    notes: "",
    addedAt: new Date().toISOString(),
  });
  return true;
}

export function removeFromWatchlist(symbol: string): boolean {
  return watchlist.delete(symbol.toUpperCase());
}

export function updateWatchlistEntry(
  symbol: string,
  update: { targetPrice?: number | null; notes?: string }
): WatchlistEntry | null {
  const entry = watchlist.get(symbol.toUpperCase());
  if (!entry) return null;
  if (update.targetPrice !== undefined) entry.targetPrice = update.targetPrice;
  if (update.notes !== undefined) entry.notes = update.notes;
  return entry;
}

export function getWatchlistEntry(symbol: string): WatchlistEntry | null {
  return watchlist.get(symbol.toUpperCase()) ?? null;
}
