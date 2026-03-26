import {
  TrendingUp, TrendingDown, Target, DollarSign, BarChart3, RotateCcw,
} from "lucide-react";

export interface AssetEntry {
  symbol: string;
  weight: number;
}

export type Strategy = "long" | "short" | "value" | "dividend" | "growth" | "custom";

export const STRATEGIES: { id: Strategy; label: string; desc: string; icon: any }[] = [
  { id: "long", label: "Long Hold", desc: "Buy and hold for capital appreciation", icon: TrendingUp },
  { id: "value", label: "Value Investing", desc: "Focus on undervalued fundamentals", icon: Target },
  { id: "dividend", label: "Dividend Focus", desc: "Maximize yield and income", icon: DollarSign },
  { id: "growth", label: "Growth", desc: "High-growth momentum stocks", icon: BarChart3 },
  { id: "short", label: "Short", desc: "Bet against — inverse returns", icon: TrendingDown },
  { id: "custom", label: "Custom", desc: "Your own strategy and weights", icon: RotateCcw },
];

export const PRESET_PORTFOLIOS: Record<string, { label: string; assets: AssetEntry[] }> = {
  "sp500-top5": {
    label: "S&P 500 Top 5",
    assets: [
      { symbol: "AAPL", weight: 25 }, { symbol: "MSFT", weight: 25 },
      { symbol: "GOOGL", weight: 20 }, { symbol: "AMZN", weight: 15 }, { symbol: "NVDA", weight: 15 },
    ],
  },
  "dividend-kings": {
    label: "Dividend Kings",
    assets: [
      { symbol: "JNJ", weight: 20 }, { symbol: "PG", weight: 20 }, { symbol: "KO", weight: 20 },
      { symbol: "PEP", weight: 20 }, { symbol: "MMM", weight: 20 },
    ],
  },
  "tech-growth": {
    label: "Tech Growth",
    assets: [
      { symbol: "NVDA", weight: 25 }, { symbol: "META", weight: 20 }, { symbol: "TSLA", weight: 20 },
      { symbol: "AMD", weight: 20 }, { symbol: "CRM", weight: 15 },
    ],
  },
  "defensive": {
    label: "Defensive",
    assets: [
      { symbol: "JNJ", weight: 20 }, { symbol: "PG", weight: 20 }, { symbol: "WMT", weight: 20 },
      { symbol: "UNH", weight: 20 }, { symbol: "VZ", weight: 20 },
    ],
  },
  "balanced-60-40": {
    label: "Balanced Mix",
    assets: [
      { symbol: "AAPL", weight: 15 }, { symbol: "MSFT", weight: 15 }, { symbol: "JNJ", weight: 15 },
      { symbol: "PG", weight: 15 }, { symbol: "JPM", weight: 15 },
      { symbol: "XOM", weight: 10 }, { symbol: "NEE", weight: 15 },
    ],
  },
  "high-beta": {
    label: "High Beta",
    assets: [
      { symbol: "TSLA", weight: 25 }, { symbol: "NVDA", weight: 25 },
      { symbol: "AMD", weight: 25 }, { symbol: "META", weight: 25 },
    ],
  },
  "low-vol": {
    label: "Low Volatility",
    assets: [
      { symbol: "KO", weight: 20 }, { symbol: "PG", weight: 20 }, { symbol: "JNJ", weight: 20 },
      { symbol: "WMT", weight: 20 }, { symbol: "NEE", weight: 20 },
    ],
  },
  "financials": {
    label: "Financials",
    assets: [
      { symbol: "JPM", weight: 25 }, { symbol: "GS", weight: 20 }, { symbol: "BAC", weight: 20 },
      { symbol: "BLK", weight: 20 }, { symbol: "MS", weight: 15 },
    ],
  },
  "healthcare": {
    label: "Healthcare",
    assets: [
      { symbol: "UNH", weight: 25 }, { symbol: "JNJ", weight: 20 }, { symbol: "LLY", weight: 20 },
      { symbol: "ABBV", weight: 20 }, { symbol: "PFE", weight: 15 },
    ],
  },
  "energy": {
    label: "Energy",
    assets: [
      { symbol: "XOM", weight: 30 }, { symbol: "CVX", weight: 30 },
      { symbol: "COP", weight: 20 }, { symbol: "SLB", weight: 20 },
    ],
  },
};

export const RISK_TOLERANCE = ["Conservative", "Moderate", "Aggressive"] as const;
export const REBALANCE_FREQ = ["None", "Monthly", "Quarterly", "Yearly"] as const;

export interface SimResult {
  success: boolean;
  strategy: string;
  backtest: {
    total_return: number; ann_return: number; ann_vol: number;
    sharpe: number; sortino: number; calmar: number;
    max_drawdown: number; win_rate: number;
    equity_curve: number[]; monthly_returns: number[]; month_labels: string[];
  };
  assets: { symbol: string; weight: number; ann_return: number; ann_vol: number; sharpe: number; total_return: number }[];
  correlation: number[][];
  projection: {
    goal_value: number; total_contributed: number;
    expected_value: number; median_value: number;
    worst_case_5pct: number; best_case_95pct: number;
    prob_goal: number; prob_profit: number; expected_cagr: number;
    var_95: number; cvar_95: number;
    fan_chart: { month: number; p5: number; p25: number; p50: number; p75: number; p95: number }[];
    return_histogram: { bin: number; count: number }[];
  };
}

export function fmt$(v: number): string {
  return v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
}
