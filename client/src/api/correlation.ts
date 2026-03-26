const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export interface CorrelationMatrix {
  sectors: string[];
  matrix: Record<string, Record<string, number>>;
}

export interface StockCorrelation {
  symbol: string;
  dataPoints: number;
  benchmarkCorrelations: Record<string, {
    etf: string;
    returns_corr: number;
    beta: number;
  }>;
  parameterMatrix: {
    params: string[];
    matrix: Record<string, Record<string, number>>;
  };
  stats: {
    totalReturn: number;
    annualizedVol: number;
    regressionSlope: number;
    regressionR2: number;
    avgDailyReturn: number;
  };
}

export function fetchSectorCorrelations(): Promise<CorrelationMatrix> {
  return fetchJson(`${BASE}/correlation/sectors`);
}

export function fetchStockCorrelation(symbol: string): Promise<StockCorrelation> {
  return fetchJson(`${BASE}/correlation/stock/${symbol}`);
}
