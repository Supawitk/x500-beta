const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export interface AnalysisDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema12: number | null;
  ema26: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  regressionLine: number | null;
  ichimokuTenkan: number | null;
  ichimokuKijun: number | null;
  ichimokuSpanA: number | null;
  ichimokuSpanB: number | null;
  ichimokuChikou: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  atr: number | null;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
}

export interface SignalSummary {
  emaSignal: string;
  rsiSignal: string;
  stochSignal: string;
  macdSignal: string;
  trendSignal: string;
  ichimokuSignal: string;
  bollingerSignal: string;
  adxSignal: string;
  volumeSignal: string;
  ema200Signal: string;
  overall: string;
}

export interface StockDetail {
  analystTargetHigh: number | null;
  analystTargetLow: number | null;
  analystTargetMean: number | null;
  analystTargetMedian: number | null;
  recommendationKey: string | null;
  numberOfAnalysts: number | null;
  recommendations: {
    strongBuy: number; buy: number; hold: number;
    sell: number; strongSell: number;
  } | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
  enterpriseToRevenue: number | null;
  enterpriseToEbitda: number | null;
  shortRatio: number | null;
  shortPercentOfFloat: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
  fiftyTwoWeekChange: number | null;
  forwardEps: number | null;
  trailingEps: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  bookValue: number | null;
  beta: number | null;
  debtToEquity: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  totalRevenue: number | null;
  ebitda: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  sector: string | null;
  industry: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  revenuePerShare: number | null;
}

export interface AnalysisResult {
  symbol: string;
  period: string;
  data: AnalysisDataPoint[];
  signals: SignalSummary;
  regression: { slope: number; intercept: number; rSquared: number; trend: string };
  detail: StockDetail | null;
}

export interface TrendingData {
  movers: any[];
  gainers: any[];
  losers: any[];
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export function fetchAnalysis(symbol: string, period = "6mo"): Promise<AnalysisResult> {
  return fetchJson(`${BASE}/analysis/${symbol}?period=${period}`);
}

export interface HistoryRangeResult {
  symbol: string;
  data: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  start: string;
  end: string;
}

export function fetchHistoryRange(symbol: string, start: string, end: string): Promise<HistoryRangeResult> {
  return fetchJson(`${BASE}/analysis/history-range/${symbol}?start=${start}&end=${end}`);
}

export function fetchTrending(): Promise<TrendingData> {
  return fetchJson(`${BASE}/analysis/trending`);
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(
    `${BASE}/search?q=${encodeURIComponent(query)}`
  );
  return data.results;
}
