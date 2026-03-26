import yf from "./yfClient";
import type { StockQuote } from "../types/stock";
import {
  calcGrahamNumber, calcIntrinsicValue,
  calcMarginOfSafety, calcHealthScore,
} from "../utils/calculations";
import { getCache, setCache } from "./cache";
import { SECTOR_MAP, INDUSTRY_MAP } from "../config/symbols";
const CACHE_TTL = 60_000; // 1 minute for full S&P 500 list

function resolveSectorInfo(symbol: string) {
  return {
    sector: SECTOR_MAP[symbol] || "Unknown",
    industry: INDUSTRY_MAP[symbol] || "Unknown",
  };
}

function mapQuote(q: any): StockQuote | null {
  if (!q || !q.symbol || !q.regularMarketPrice) return null;

  const price = q.regularMarketPrice;
  const eps = q.epsTrailingTwelveMonths ?? null;
  const priceToBook = q.priceToBook ?? null;
  const intrinsicValue = calcIntrinsicValue(eps);
  const marginOfSafety = calcMarginOfSafety(intrinsicValue, price);
  const high = q.fiftyTwoWeekHigh ?? price;
  const low = q.fiftyTwoWeekLow ?? price;
  const divYield = q.dividendYield ? q.dividendYield / 100 : null;
  const pe = q.trailingPE ?? null;
  const roe = q.returnOnEquity ?? null;
  const dte = q.debtToEquity ?? null;
  const { sector, industry } = resolveSectorInfo(q.symbol);

  return {
    symbol: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    sector,
    industry,
    price,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    marketCap: q.marketCap ?? 0,
    peRatio: pe,
    forwardPE: q.forwardPE ?? null,
    eps,
    dividendYield: divYield,
    dividendPerShare: q.dividendRate ?? null,
    payoutRatio: q.payoutRatio ?? null,
    priceToBook,
    beta: q.beta ?? null,
    fiftyTwoWeekHigh: high,
    fiftyTwoWeekLow: low,
    fiftyTwoWeekRange: `$${low.toFixed(2)} - $${high.toFixed(2)}`,
    returnOnEquity: roe,
    debtToEquity: dte,
    intrinsicValue,
    marginOfSafety,
    grahamNumber: calcGrahamNumber(eps, priceToBook, price),
    healthScore: calcHealthScore({
      peRatio: pe, dividendYield: divYield,
      marginOfSafety, debtToEquity: dte, returnOnEquity: roe,
    }),
  };
}

const PAGE_SIZE = 100;

/** Fetch a single page of quotes (0-indexed). Each page is cached independently. */
export async function fetchQuotesPage(symbols: string[], page: number): Promise<{ stocks: StockQuote[]; page: number; totalPages: number; totalSymbols: number }> {
  const totalPages = Math.ceil(symbols.length / PAGE_SIZE);
  const cacheKey = `quotes_page_${page}`;
  const cached = getCache<StockQuote[]>(cacheKey);

  if (cached) {
    return { stocks: cached, page, totalPages, totalSymbols: symbols.length };
  }

  const start = page * PAGE_SIZE;
  const batch = symbols.slice(start, start + PAGE_SIZE);
  const stocks: StockQuote[] = [];

  if (batch.length > 0) {
    try {
      const results = await yf.quote(batch);
      const arr = Array.isArray(results) ? results : [results];
      stocks.push(...arr.map(mapQuote).filter((s): s is StockQuote => s !== null));
    } catch (e) {
      console.error(`Failed to fetch page ${page}:`, e);
    }
  }

  setCache(cacheKey, stocks, CACHE_TTL);
  return { stocks, page, totalPages, totalSymbols: symbols.length };
}

/** Fetch ALL quotes (all pages). Uses per-page cache. */
export async function fetchQuotes(symbols: string[]): Promise<StockQuote[]> {
  const cacheKey = "quotes_all";
  const cached = getCache<StockQuote[]>(cacheKey);
  if (cached) return cached;

  const totalPages = Math.ceil(symbols.length / PAGE_SIZE);
  const allStocks: StockQuote[] = [];

  for (let p = 0; p < totalPages; p++) {
    const result = await fetchQuotesPage(symbols, p);
    allStocks.push(...result.stocks);
  }

  setCache(cacheKey, allStocks, CACHE_TTL);
  return allStocks;
}

export async function fetchSingleQuote(
  symbol: string
): Promise<StockQuote | null> {
  const cacheKey = `quote_${symbol}`;
  const cached = getCache<StockQuote>(cacheKey);
  if (cached) return cached;

  const result = await yf.quote(symbol);
  const stock = mapQuote(result);
  if (stock) setCache(cacheKey, stock, CACHE_TTL);
  return stock;
}
