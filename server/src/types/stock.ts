export interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  dividendYield: number | null;
  dividendPerShare: number | null;
  payoutRatio: number | null;
  priceToBook: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekRange: string;
  returnOnEquity: number | null;
  debtToEquity: number | null;
  intrinsicValue: number | null;
  marginOfSafety: number | null;
  grahamNumber: number | null;
  healthScore: number | null;
}

export interface SectorSummary {
  sector: string;
  count: number;
  totalCount: number;
  avgPE: number | null;
  avgDividendYield: number | null;
}

export interface IndustrySummary {
  industry: string;
  sector: string;
  count: number;
  avgPE: number | null;
  avgDividendYield: number | null;
  avgMarginOfSafety: number | null;
  symbols: string[];
}

export interface SectorIndustryGroup {
  industry: string;
  count: number;
  avgChange: number;
  avgPrice: number;
  totalMarketCap: number;
  topStock: { symbol: string; changePercent: number; price: number };
  bottomStock: { symbol: string; changePercent: number; price: number };
  stocks: { symbol: string; name: string; price: number; changePercent: number; marketCap: number; peRatio: number | null; dividendYield: number | null }[];
}

export interface SectorPerformance {
  sector: string;
  avgChange: number;
  count: number;
  totalCount: number;
  avgPrice: number;
  totalMarketCap: number;
  advancers: number;
  decliners: number;
  topStock: { symbol: string; changePercent: number } | null;
  bottomStock: { symbol: string; changePercent: number } | null;
  industries: SectorIndustryGroup[];
  stocks: { symbol: string; name: string; price: number; changePercent: number; industry: string; marketCap: number; peRatio: number | null; dividendYield: number | null }[];
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MarketSummary {
  totalStocks: number;
  avgPE: number | null;
  avgDividendYield: number | null;
  topUndervalued: StockQuote | null;
  topDividend: StockQuote | null;
  gainers: StockQuote[];
  losers: StockQuote[];
  mostActive: StockQuote[];
  advancers: number;
  decliners: number;
  unchanged: number;
  avgChange: number;
  sectorPerformance: SectorPerformance[];
  indices: MarketIndex[];
  lastUpdated: string;
}

export interface ApiError {
  error: string;
  message: string;
}
