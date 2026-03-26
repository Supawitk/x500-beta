import yf from "./yfClient";
import { getCache, setCache } from "./cache";
const CACHE_TTL = 30_000;

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC", "^VIX", "^RUT"];

export async function fetchMarketIndices(): Promise<MarketIndex[]> {
  const cacheKey = "market_indices";
  const cached = getCache<MarketIndex[]>(cacheKey);
  if (cached) return cached;

  try {
    const results = await yf.quote(INDEX_SYMBOLS);
    const arr = Array.isArray(results) ? results : [results];
    const indices = arr
      .filter((q: any) => q && q.regularMarketPrice)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
      }));
    setCache(cacheKey, indices, CACHE_TTL);
    return indices;
  } catch {
    return [];
  }
}
