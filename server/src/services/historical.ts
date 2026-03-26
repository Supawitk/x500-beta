import yf from "./yfClient";
import { getCache, setCache } from "./cache";
const CACHE_TTL = 60_000; // 1 minute

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchHistory(
  symbol: string,
  period = "6mo",
  interval: "1d" | "1wk" | "1h" = "1d"
): Promise<OHLCV[]> {
  const cacheKey = `hist_${symbol}_${period}_${interval}`;
  const cached = getCache<OHLCV[]>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const periodMap: Record<string, number> = {
    "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "3y": 1095, "5y": 1825, "10y": 3650,
  };
  const days = periodMap[period] || 180;
  const start = new Date(now.getTime() - days * 86400000);

  const result = await yf.chart(symbol, {
    period1: start.toISOString().split("T")[0],
    interval,
  });

  const data: OHLCV[] = result.quotes
    .filter((q: any) => q.close !== null && q.close !== undefined)
    .map((q: any) => ({
      date: new Date(q.date).toISOString().split("T")[0],
      open: round(q.open),
      high: round(q.high),
      low: round(q.low),
      close: round(q.close),
      volume: q.volume || 0,
    }));

  setCache(cacheKey, data, CACHE_TTL);
  return data;
}

export async function fetchHistoryRange(
  symbol: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
  interval: "1d" | "1wk" = "1d"
): Promise<OHLCV[]> {
  const cacheKey = `hist_range_${symbol}_${startDate}_${endDate}_${interval}`;
  const cached = getCache<OHLCV[]>(cacheKey);
  if (cached) return cached;

  const result = await yf.chart(symbol, {
    period1: startDate,
    period2: endDate,
    interval,
  });

  const data: OHLCV[] = result.quotes
    .filter((q: any) => q.close !== null && q.close !== undefined)
    .map((q: any) => ({
      date: new Date(q.date).toISOString().split("T")[0],
      open: round(q.open),
      high: round(q.high),
      low: round(q.low),
      close: round(q.close),
      volume: q.volume || 0,
    }));

  setCache(cacheKey, data, 300_000); // 5 min cache for range queries
  return data;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
