import { getCache, setCache } from "./cache";

const CACHE_TTL = 600_000; // 10 min

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

export async function fetchSECFilings(symbol: string): Promise<SECFilingsResult> {
  const cacheKey = `sec_filings_${symbol}`;
  const cached = getCache<SECFilingsResult>(cacheKey);
  if (cached) return cached;

  const sym = symbol.toUpperCase();

  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 730 * 86400000).toISOString().split("T")[0]; // 2 years
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(sym)}%22&forms=10-K,10-Q,8-K,S-1,DEF%2014A,6-K,20-F&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=30`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StockDashboard/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return { symbol: sym, filings: [], companyName: null, cik: null, totalResults: 0 };

    const data = await res.json();
    const hits = data.hits?.hits || [];
    let companyName: string | null = null;
    let cik: string | null = null;

    // Filter to filings that actually belong to this ticker
    const tickerRegex = new RegExp(`\\(${sym}\\)`, "i");
    const relevantHits = hits.filter((hit: any) => {
      const names = hit._source?.display_names || [];
      return names.some((n: string) => tickerRegex.test(n));
    });

    const filings: SECFiling[] = relevantHits.map((hit: any) => {
      const src = hit._source || {};
      const displayName = src.display_names?.[0] || "";
      if (!companyName && displayName) {
        // "Apple Inc.  (AAPL)  (CIK 0000320193)" -> "Apple Inc."
        companyName = displayName.split("(")[0].trim() || null;
      }
      if (!cik && src.ciks?.[0]) cik = src.ciks[0];

      const accession = (src.adsh || "").replace(/-/g, "");
      const cikNum = src.ciks?.[0] ? parseInt(src.ciks[0]) : 0;
      const docId = hit._id?.split(":")[1] || "";
      const docUrl = accession && cikNum
        ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}/${docId}`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${sym}&type=${src.form || ""}&dateb=&owner=include&count=1`;

      return {
        id: hit._id || `sec_${src.file_date}_${src.form}`,
        type: src.form || src.root_forms?.[0] || "Unknown",
        title: displayName || `${sym} — ${src.form || "Filing"}`,
        description: src.file_description || null,
        filedDate: src.file_date || null,
        url: docUrl,
        companyName: companyName || sym,
      };
    });

    const result: SECFilingsResult = {
      symbol: sym,
      filings,
      companyName,
      cik,
      totalResults: data.hits?.total?.value || filings.length,
    };

    setCache(cacheKey, result, CACHE_TTL);
    return result;
  } catch {
    return { symbol: sym, filings: [], companyName: null, cik: null, totalResults: 0 };
  }
}
