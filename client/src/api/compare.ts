import type { StockQuote } from "../types/stock";
import type { StockDetail } from "./analysis";

const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export interface RiskMetrics {
  sharpe: number;
  sortino: number;
  volatility: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export interface CompareStock {
  symbol: string;
  quote: StockQuote | null;
  detail: StockDetail | null;
  regression: { slope: number; rSquared: number; trend: string };
  marketCorrelation: number;
  marketBeta: number;
  normalizedPrices: number[];
  totalReturn: number;
  risk: RiskMetrics;
  drawdown: number[];
  rollingVolatility: number[];
  monthlyReturns: { month: string; return: number }[];
  returnDistribution: { bin: number; count: number }[];
  avgVolume: number;
  volumeTrend: number;
}

export interface ScoredStock {
  symbol: string;
  score: number;
  reasons: string[];
}

export interface CompareResult {
  stocks: CompareStock[];
  chartData: Record<string, any>[];
  drawdownData: Record<string, any>[];
  volData: Record<string, any>[];
  pairCorrelations: Record<string, number>;
  verdict: { scored: ScoredStock[]; summary: string };
  period: string;
}

export function fetchFullCompare(symbols: string[], period = "6mo"): Promise<CompareResult> {
  return fetchJson(
    `${BASE}/compare?symbols=${symbols.join(",")}&period=${period}`
  );
}
