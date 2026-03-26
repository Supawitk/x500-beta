import { SP500_SYMBOLS, CONSTITUENTS } from "../config/symbols";
import type { StockQuote, SectorSummary, IndustrySummary, MarketSummary, SectorPerformance } from "../types/stock";
import { fetchQuotes } from "./yahoo";
import { fetchMarketIndices } from "./marketIndices";

// Pre-compute full S&P 500 sector counts from CSV
const CSV_SECTOR_COUNTS: Record<string, number> = {};
for (const c of CONSTITUENTS) {
  CSV_SECTOR_COUNTS[c.sector] = (CSV_SECTOR_COUNTS[c.sector] || 0) + 1;
}

export async function getAllStocks(): Promise<StockQuote[]> {
  return fetchQuotes(SP500_SYMBOLS);
}

export interface FilterOptions {
  sector?: string;
  industry?: string;
  search?: string;
  minDividendYield?: number;
  maxPE?: number;
  minHealthScore?: number;
  sortBy?: string;
  sortOrder?: string;
}

export function filterStocks(stocks: StockQuote[], params: FilterOptions): StockQuote[] {
  let result = [...stocks];

  if (params.sector) {
    result = result.filter((s) => s.sector === params.sector);
  }
  if (params.industry) {
    result = result.filter((s) => s.industry === params.industry);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter((s) =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.industry.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
    );
  }
  if (params.minDividendYield) {
    result = result.filter((s) => (s.dividendYield ?? 0) >= params.minDividendYield!);
  }
  if (params.maxPE) {
    result = result.filter((s) => s.peRatio !== null && s.peRatio <= params.maxPE!);
  }
  if (params.minHealthScore) {
    result = result.filter((s) => (s.healthScore ?? 0) >= params.minHealthScore!);
  }
  if (params.sortBy) {
    const key = params.sortBy as keyof StockQuote;
    const dir = params.sortOrder === "asc" ? 1 : -1;
    result.sort((a, b) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }
  return result;
}

export function getSectors(stocks: StockQuote[]): SectorSummary[] {
  const map = new Map<string, StockQuote[]>();
  for (const s of stocks) {
    const arr = map.get(s.sector) || [];
    arr.push(s);
    map.set(s.sector, arr);
  }
  return Array.from(map.entries()).map(([sector, list]) => ({
    sector,
    count: list.length,
    totalCount: CSV_SECTOR_COUNTS[sector] ?? list.length,
    avgPE: avg(list.map((s) => s.peRatio)),
    avgDividendYield: avg(list.map((s) => s.dividendYield)),
  }));
}

export function getIndustries(stocks: StockQuote[]): IndustrySummary[] {
  const map = new Map<string, StockQuote[]>();
  for (const s of stocks) {
    const arr = map.get(s.industry) || [];
    arr.push(s);
    map.set(s.industry, arr);
  }
  return Array.from(map.entries())
    .map(([industry, list]) => ({
      industry,
      sector: list[0].sector,
      count: list.length,
      avgPE: avg(list.map((s) => s.peRatio)),
      avgDividendYield: avg(list.map((s) => s.dividendYield)),
      avgMarginOfSafety: avg(list.map((s) => s.marginOfSafety)),
      symbols: list.map((s) => s.symbol),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getMarketSummary(stocks: StockQuote[]): Promise<MarketSummary> {
  const withYield = stocks.filter((s) => s.dividendYield && s.dividendYield > 0);
  const withMargin = stocks.filter((s) => s.marginOfSafety !== null);

  const sorted = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter((s) => s.changePercent > 0).slice(0, 20);
  const losers = [...stocks].sort((a, b) => a.changePercent - b.changePercent)
    .filter((s) => s.changePercent < 0).slice(0, 20);
  const mostActive = [...stocks].sort((a, b) =>
    Math.abs(b.changePercent) - Math.abs(a.changePercent)
  ).slice(0, 20);

  const advancers = stocks.filter((s) => s.changePercent > 0).length;
  const decliners = stocks.filter((s) => s.changePercent < 0).length;

  // Build rich sector performance with top/bottom stocks
  const sectorStocks = new Map<string, StockQuote[]>();
  for (const s of stocks) {
    const arr = sectorStocks.get(s.sector) || [];
    arr.push(s);
    sectorStocks.set(s.sector, arr);
  }

  const sectorPerformance: SectorPerformance[] = Array.from(sectorStocks.entries())
    .map(([sector, list]) => {
      const sortedList = [...list].sort((a, b) => b.changePercent - a.changePercent);
      const top = sortedList[0];
      const bottom = sortedList[sortedList.length - 1];
      return {
        sector,
        avgChange: Math.round((list.reduce((a, s) => a + s.changePercent, 0) / list.length) * 100) / 100,
        count: list.length,
        totalCount: CSV_SECTOR_COUNTS[sector] ?? list.length,
        topStock: top ? { symbol: top.symbol, changePercent: round2(top.changePercent) } : null,
        bottomStock: bottom ? { symbol: bottom.symbol, changePercent: round2(bottom.changePercent) } : null,
        totalMarketCap: list.reduce((a, s) => a + (s.marketCap || 0), 0),
        avgPrice: round2(list.reduce((a, s) => a + s.price, 0) / list.length),
        advancers: list.filter((s) => s.changePercent > 0).length,
        decliners: list.filter((s) => s.changePercent < 0).length,
        // Group by industry sub-type within this sector
        industries: (() => {
          const indMap = new Map<string, StockQuote[]>();
          for (const s of list) {
            const arr = indMap.get(s.industry) || [];
            arr.push(s);
            indMap.set(s.industry, arr);
          }
          return Array.from(indMap.entries())
            .map(([industry, iList]) => {
              const iSorted = [...iList].sort((a, b) => b.changePercent - a.changePercent);
              return {
                industry,
                count: iList.length,
                avgChange: round2(iList.reduce((a, s) => a + s.changePercent, 0) / iList.length),
                avgPrice: round2(iList.reduce((a, s) => a + s.price, 0) / iList.length),
                totalMarketCap: iList.reduce((a, s) => a + (s.marketCap || 0), 0),
                topStock: { symbol: iSorted[0].symbol, changePercent: round2(iSorted[0].changePercent), price: round2(iSorted[0].price) },
                bottomStock: { symbol: iSorted[iSorted.length - 1].symbol, changePercent: round2(iSorted[iSorted.length - 1].changePercent), price: round2(iSorted[iSorted.length - 1].price) },
                stocks: iSorted.map((s) => ({
                  symbol: s.symbol, name: s.name, price: s.price,
                  changePercent: round2(s.changePercent),
                  marketCap: s.marketCap || 0,
                  peRatio: s.peRatio,
                  dividendYield: s.dividendYield,
                })),
              };
            })
            .sort((a, b) => b.totalMarketCap - a.totalMarketCap);
        })(),
        stocks: sortedList.map((s) => ({
          symbol: s.symbol, name: s.name, price: s.price,
          changePercent: round2(s.changePercent), industry: s.industry,
          marketCap: s.marketCap || 0,
          peRatio: s.peRatio,
          dividendYield: s.dividendYield,
        })),
      };
    })
    .sort((a, b) => b.avgChange - a.avgChange);

  // Fetch market indices in parallel (non-blocking)
  const indices = await fetchMarketIndices();

  return {
    totalStocks: stocks.length,
    avgPE: avg(stocks.map((s) => s.peRatio)),
    avgDividendYield: avg(stocks.map((s) => s.dividendYield)),
    topUndervalued: withMargin.sort(
      (a, b) => (b.marginOfSafety ?? 0) - (a.marginOfSafety ?? 0)
    )[0] ?? null,
    topDividend: withYield.sort(
      (a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0)
    )[0] ?? null,
    gainers, losers, mostActive,
    advancers, decliners,
    unchanged: stocks.length - advancers - decliners,
    avgChange: avg(stocks.map((s) => s.changePercent)) ?? 0,
    sectorPerformance,
    indices,
    lastUpdated: new Date().toISOString(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}
