import type { StockQuote, FilterParams } from "../types/stock";

const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export function fetchStocks(params?: FilterParams): Promise<StockQuote[]> {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
  }
  const query = qs.toString();
  return fetchJson(`${BASE}/stocks${query ? `?${query}` : ""}`);
}

export function fetchStock(symbol: string): Promise<StockQuote> {
  return fetchJson(`${BASE}/stocks/${symbol}`);
}

export function fetchTopValue(): Promise<StockQuote[]> {
  return fetchJson(`${BASE}/stocks/top/value`);
}

export function fetchTopDividend(): Promise<StockQuote[]> {
  return fetchJson(`${BASE}/stocks/top/dividend`);
}

export function fetchTopHealth(): Promise<StockQuote[]> {
  return fetchJson(`${BASE}/stocks/top/health`);
}

export function fetchCompare(symbols: string[]): Promise<StockQuote[]> {
  return fetchJson(`${BASE}/stocks/compare?symbols=${symbols.join(",")}`);
}

export interface StockPage {
  stocks: StockQuote[];
  page: number;
  totalPages: number;
  totalSymbols: number;
}

export function fetchStockPage(page: number): Promise<StockPage> {
  return fetchJson(`${BASE}/stocks-page/${page}`);
}
