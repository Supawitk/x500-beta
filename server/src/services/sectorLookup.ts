import yf from "./yfClient";
import { getCache, setCache } from "./cache";
const CACHE_TTL = 3600_000; // 1 hour - sectors don't change often

interface SectorInfo {
  sector: string;
  industry: string;
}

const sectorCache = new Map<string, SectorInfo>();

export async function lookupSectors(
  symbols: string[]
): Promise<Map<string, SectorInfo>> {
  const cacheKey = "sector_lookup";
  const cached = getCache<Map<string, SectorInfo>>(cacheKey);
  if (cached && cached.size >= symbols.length * 0.8) return cached;

  const missing = symbols.filter((s) => !sectorCache.has(s));
  if (missing.length === 0) return sectorCache;

  // Fetch in larger batches for efficiency with many symbols
  const BATCH = 10;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const data = await yf.quoteSummary(sym, { modules: ["assetProfile"] });
          return {
            symbol: sym,
            sector: data.assetProfile?.sector || "Unknown",
            industry: data.assetProfile?.industry || "Unknown",
          };
        } catch {
          return { symbol: sym, sector: "Unknown", industry: "Unknown" };
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        sectorCache.set(r.value.symbol, {
          sector: r.value.sector,
          industry: r.value.industry,
        });
      }
    }
    // Small delay between batches to avoid rate limits
    if (i + BATCH < missing.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  setCache(cacheKey, new Map(sectorCache), CACHE_TTL);
  return sectorCache;
}

export function getCachedSector(symbol: string): SectorInfo | null {
  return sectorCache.get(symbol) ?? null;
}
