const BASE = "/api/watchlist";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface WatchlistEntry {
  symbol: string;
  targetPrice: number | null;
  notes: string;
  addedAt: string;
}

interface WatchlistResponse {
  symbols: string[];
  entries?: WatchlistEntry[];
  success?: boolean;
}

export function fetchWatchlist(): Promise<WatchlistResponse> {
  return fetchJson(BASE);
}

export function addToWatchlist(symbol: string): Promise<WatchlistResponse> {
  return fetchJson(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
}

export function removeFromWatchlist(symbol: string): Promise<WatchlistResponse> {
  return fetchJson(`${BASE}/${symbol}`, { method: "DELETE" });
}

export function updateWatchlistEntry(
  symbol: string,
  update: { targetPrice?: number | null; notes?: string }
): Promise<{ success: boolean; entry: WatchlistEntry }> {
  return fetchJson(`${BASE}/${symbol}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
}
