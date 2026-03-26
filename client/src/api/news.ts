const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export interface NewsArticle {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishTime: string | null;
  type: string;
  thumbnail: string | null;
  relatedTickers: string[];
}

export interface SigDev {
  headline: string;
  date: string | null;
}

export interface ResearchReport {
  id: string;
  title: string;
  provider: string;
  date: string | null;
  targetPrice: number | null;
  targetPriceStatus: string | null;
  investmentRating: string | null;
}

export interface CompanySnapshot {
  sectorInfo: string | null;
  company: {
    innovativeness: number | null;
    hiring: number | null;
    sustainability: number | null;
    insiderSentiments: number | null;
    earningsReports: number | null;
    dividends: number | null;
  };
  sector: {
    innovativeness: number | null;
    hiring: number | null;
    sustainability: number | null;
    insiderSentiments: number | null;
    earningsReports: number | null;
    dividends: number | null;
  } | null;
}

export interface TechnicalOutlook {
  shortTerm: { direction: string; score: number; description: string } | null;
  intermediateTerm: { direction: string; score: number; description: string } | null;
  longTerm: { direction: string; score: number; description: string } | null;
}

export interface StockNewsData {
  symbol: string;
  news: NewsArticle[];
  sigDevs: SigDev[];
  reports: ResearchReport[];
  companySnapshot: CompanySnapshot | null;
  technicalOutlook: TechnicalOutlook | null;
  recommendation: { rating: string; targetPrice: number | null; provider: string } | null;
  upsell: { bullishSummary: string[]; bearishSummary: string[] } | null;
}

export function fetchStockNews(symbol: string): Promise<StockNewsData> {
  return fetchJson(`${BASE}/news/${symbol}`);
}

// ── Multi-Source News ───────────────────────────────────────────────────────
export interface MultiNewsArticle {
  id: string;
  title: string;
  summary: string | null;
  publisher: string;
  source: "yahoo" | "finnhub" | "google-rss";
  sourceLabel: string;
  link: string | null;
  publishTime: string | null;
  thumbnail: string | null;
  relatedTickers: string[];
  reliability: number;
  reliabilityTier: string;
  reliabilityColor: string;
  category: string | null;
  sentiment: string | null;
}

export interface MultiNewsResult {
  symbol: string;
  articles: MultiNewsArticle[];
  sourceBreakdown: { source: string; count: number; avgReliability: number }[];
  totalArticles: number;
  avgReliability: number;
}

export function fetchMultiNews(symbol: string): Promise<MultiNewsResult> {
  return fetchJson(`${BASE}/news/multi/${symbol}`);
}

// ── SEC EDGAR Filings ─────────────────────────────────────────────────────
export interface SECFiling {
  id: string;
  type: string;
  title: string;
  description: string | null;
  filedDate: string;
  url: string;
  companyName: string;
}

export interface SECFilingsResult {
  symbol: string;
  filings: SECFiling[];
  companyName: string | null;
  cik: string | null;
  totalResults: number;
}

export function fetchSECFilings(symbol: string): Promise<SECFilingsResult> {
  return fetchJson(`${BASE}/news/sec/${symbol}`);
}

// ── News Impact (Pattern Matching) ────────────────────────────────────────
export interface PredictionHorizon {
  avg: number;
  median: number;
  winRate: number;
  count: number;
}

export interface NewsImpactData {
  symbol: string;
  targetNews: {
    title: string;
    date: string;
    link: string | null;
    category: string;
    sentiment: number;
    keywords: string[];
  }[];
  matches: {
    newsTitle: string;
    newsDate: string;
    matchSymbol: string;
    similarity: number;
    category: string;
    sentiment: number;
    priceImpact: { day3: number | null; day5: number | null; day10: number | null };
  }[];
  prediction: { day3: PredictionHorizon; day5: PredictionHorizon; day10: PredictionHorizon };
  perArticlePredictions: { day3: PredictionHorizon; day5: PredictionHorizon; day10: PredictionHorizon }[];
  backtest: {
    totalPredictions: number;
    accurateDirection: number;
    directionAccuracy: number;
    avgError: number;
    profitFactor: number;
  };
  confidence: number;
  confidenceBreakdown: { matchQuality: number; sampleSize: number; consistency: number; backtestScore: number };
  corpusSize: number;
  trainingCycles: number;
}

export function fetchNewsImpact(symbol: string): Promise<NewsImpactData> {
  return fetchJson(`${BASE}/analysis/news-impact/${symbol}`);
}
