const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export interface EpsHistoryItem {
  quarter: string | null;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  beat: boolean | null;
}

export interface EarningsDividendData {
  symbol: string;
  earnings: {
    nextEarningsDate: string | null;
    daysUntilEarnings: number | null;
    isEstimate: boolean;
    epsEstimate: {
      current: number | null;
      low: number | null;
      high: number | null;
      yearAgo: number | null;
      growth: number | null;
      analysts: number | null;
      endDate: string | null;
    };
    revenueEstimate: {
      avg: number | null;
      low: number | null;
      high: number | null;
      yearAgo: number | null;
      growth: number | null;
    };
    revisions: {
      up7d: number;
      up30d: number;
      down30d: number;
      score: number | null;
      label: string;
    };
    epsTrend: {
      current: number | null;
      d7: number | null;
      d30: number | null;
      d60: number | null;
      d90: number | null;
    } | null;
    history: EpsHistoryItem[];
    nextQ: { endDate: string | null; epsAvg: number | null; growth: number | null } | null;
    annualEst: { endDate: string | null; epsAvg: number | null; growth: number | null } | null;
  };
  dividend: {
    exDivDate: string | null;
    daysUntilExDiv: number | null;
    payDate: string | null;
    annualRate: number | null;
    currentYield: number | null;
    fiveYearAvgYield: number | null;
    payoutRatio: number | null;
    payoutSafety: string;
    payoutSafetyColor: string;
    divVs5yrPct: number | null;
    isDividendPayer: boolean;
  };
  valuation: {
    trailingPE: number | null;
    forwardPE: number | null;
    priceSales: number | null;
  };
  incomeHistory: {
    annual: IncomeEntry[];
    quarterly: IncomeEntry[];
  };
  cashFlow: CashFlowEntry[];
  dividendHistory: { date: string | null; amount: number }[] | null;
}

export interface IncomeEntry {
  date: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ebitda: number | null;
  eps: number | null;
  rnd: number | null;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
}

export interface CashFlowEntry {
  date: string | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  dividendsPaid: number | null;
}

export function fetchEarningsDividend(symbol: string): Promise<EarningsDividendData> {
  return fetchJson(`${BASE}/earnings/${symbol}`);
}
