const BASE = "/api/predict";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  if (d?.error) throw new Error(d.message || "Failed");
  return d as T;
}

export interface ModelSummary {
  name: string;
  success: boolean;
  error?: string;
  model_type?: string;
  direction?: string;
  prob_up?: number | null;
  confidence?: number | null;
  dir_accuracy?: number | null;
  skill_score?: number | null;
  rmse?: number | null;
  n_steps?: number | null;
  interpretation?: string;
  raw?: any;
}

export interface CompareResult {
  symbol: string;
  period: string;
  lookahead: number;
  models: ModelSummary[];
  consensus: {
    direction: string;
    agreement_pct: number;
    n_bullish: number;
    n_bearish: number;
    n_models: number;
    label: string;
  };
  lastPrice: number;
  dataPoints: number;
}

export interface EnsembleResult {
  success: boolean;
  symbol: string;
  direction: string;
  probability_up: number;
  prob_up_pct: number;
  conviction: number;
  conviction_label: string;
  model_votes: { name: string; direction: string; prob_up: number; skill: number; weight: number }[];
  technical_signals: Record<string, any>;
  monte_carlo: {
    prob_up: number;
    median_ret: number;
    p10: number; p25: number; p75: number; p90: number;
    fan_chart: { day: number; p10: number; p25: number; p50: number; p75: number; p90: number }[];
  };
  regime: { trending: boolean; type: string; trend_strength: number; vol_ann: number };
  note: string;
}

export interface EnhancedBacktestResult {
  success: boolean;
  version: string;
  symbol: string;
  dataPoints: number;
  window: number;
  lookahead: number;
  current_pattern: { dates: string[]; normalized: number[] };
  matches: any[];
  summary: {
    total_matches: number;
    avg_return: number;
    median_return: number;
    std_return: number;
    pct_positive: number;
    avg_max_gain: number;
    avg_max_loss: number;
    best_match_return: number;
    worst_match_return: number;
    avg_score: number;
    avg_r_squared: number;
    avg_rmse: number;
    avg_sharpe_after: number;
    confidence_score: number;
    directional_bias: string;
    avg_path: number[];
    p10_path: number[];
    p90_path: number[];
    current_vol: number;
    current_regime: string;
  };
  note: string;
}

export type ModelPeriod = "1y" | "2y" | "3y";
export type LookAhead   = 5 | 10 | 14 | 20 | 30;

export function fetchModelCompare(
  symbol: string,
  period: ModelPeriod = "2y",
  lookahead: LookAhead = 10,
  retrain = false
): Promise<CompareResult> {
  return fetchJson(`${BASE}/compare/${symbol}?period=${period}&lookahead=${lookahead}&retrain=${retrain}`);
}

export function fetchEnsemble(
  symbol: string,
  period: ModelPeriod = "2y",
  lookahead: LookAhead = 10,
  retrain = false
): Promise<EnsembleResult> {
  return fetchJson(`${BASE}/ensemble/${symbol}?period=${period}&lookahead=${lookahead}&retrain=${retrain}`);
}

export function fetchEnhancedBacktest(
  symbol: string,
  window = 20,
  lookahead: LookAhead = 14,
  retrain = false
): Promise<EnhancedBacktestResult> {
  return fetchJson(`${BASE}/backtest-v2/${symbol}?window=${window}&lookahead=${lookahead}&retrain=${retrain}`);
}

export async function resetModelCache(symbol: string, model = "all"): Promise<void> {
  await fetch(`${BASE}/cache/${symbol}?model=${model}`, { method: "DELETE" });
}
