import type { MarketSummary, SectorSummary, IndustrySummary } from "../types/stock";

const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "API error");
  return data as T;
}

export function fetchMarketSummary(): Promise<MarketSummary> {
  return fetchJson(`${BASE}/market/summary`);
}

export function fetchSectors(): Promise<SectorSummary[]> {
  return fetchJson(`${BASE}/sectors`);
}

export function fetchIndustries(): Promise<IndustrySummary[]> {
  return fetchJson(`${BASE}/industries`);
}
