/**
 * Multi-Source News Aggregator
 *
 * Aggregates financial news from multiple reliable sources:
 * 1. Yahoo Finance (primary - already integrated)
 * 2. Finnhub (free tier - company news with summaries)
 * 3. Google News RSS (aggregates Reuters, Bloomberg, CNBC, etc.)
 *
 * Each article is tagged with source, reliability score, and link.
 * Only trusted/referenceable sources are included.
 */

import { getCache, setCache } from "./cache";

const CACHE_TTL = 300_000; // 5 min

// ── Source reliability ratings (0-100) ──────────────────────────────────────
// Based on journalistic standards, financial reporting accuracy, editorial oversight
const SOURCE_RELIABILITY: Record<string, number> = {
  // Tier 1: Major financial wire services & outlets (90-100)
  "Reuters": 98,
  "Associated Press": 97,
  "Bloomberg": 96,
  "The Wall Street Journal": 95,
  "Financial Times": 94,
  "CNBC": 92,
  "Barron's": 91,
  "MarketWatch": 90,
  "The New York Times": 90,

  // Tier 2: Established financial media (80-89)
  "Yahoo Finance": 85,
  "Investor's Business Daily": 85,
  "Forbes": 84,
  "Business Insider": 82,
  "Seeking Alpha": 80,
  "The Motley Fool": 80,
  "Benzinga": 80,

  // Tier 3: Industry-specific / decent sources (70-79)
  "TechCrunch": 78,
  "The Verge": 76,
  "Morningstar": 85,
  "Zacks": 75,
  "TheStreet": 75,
  "Investopedia": 78,
  "Globe Newswire": 72,
  "PR Newswire": 72,
  "Business Wire": 72,
  "AccessWire": 70,

  // Tier 4: Lower reliability / blogs / opinion (50-69)
  "Medium": 55,
  "Substack": 55,

  // Default for unknown sources
  "_default": 60,
};

function getReliability(publisher: string): number {
  // Check exact match first
  if (SOURCE_RELIABILITY[publisher] != null) return SOURCE_RELIABILITY[publisher];
  // Check partial match
  for (const [name, score] of Object.entries(SOURCE_RELIABILITY)) {
    if (name === "_default") continue;
    if (publisher.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(publisher.toLowerCase())) {
      return score;
    }
  }
  return SOURCE_RELIABILITY["_default"];
}

function reliabilityTier(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Highly Reliable", color: "#059669" };
  if (score >= 80) return { label: "Reliable", color: "#34d399" };
  if (score >= 70) return { label: "Moderately Reliable", color: "#d97706" };
  if (score >= 60) return { label: "Use Caution", color: "#f87171" };
  return { label: "Unverified", color: "#dc2626" };
}

// ── Article interface ───────────────────────────────────────────────────────
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

// ── Google News RSS fetcher ─────────────────────────────────────────────────
// Parses Google News RSS which aggregates from Reuters, CNBC, Bloomberg, etc.
async function fetchGoogleNewsRSS(symbol: string): Promise<MultiNewsArticle[]> {
  try {
    const query = encodeURIComponent(`${symbol} stock`);
    const url = `https://news.google.com/rss/search?q=${query}+when:14d&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML parsing (no dependency needed)
    const articles: MultiNewsArticle[] = [];
    const items = xml.split("<item>").slice(1);

    for (const item of items.slice(0, 15)) {
      const title = extractXmlTag(item, "title");
      const link = extractXmlTag(item, "link");
      const pubDate = extractXmlTag(item, "pubDate");
      const sourceTag = extractXmlTag(item, "source");

      if (!title) continue;

      // Google News includes the source at the end of title: "Headline - Source"
      let publisher = sourceTag || "Google News";
      let cleanTitle = title;
      const dashIdx = title.lastIndexOf(" - ");
      if (dashIdx > 0 && !sourceTag) {
        publisher = title.slice(dashIdx + 3).trim();
        cleanTitle = title.slice(0, dashIdx).trim();
      }

      const rel = getReliability(publisher);
      const tier = reliabilityTier(rel);

      // Only include articles from sources with reliability >= 70
      if (rel < 70) continue;

      articles.push({
        id: `gn_${symbol}_${pubDate || title.slice(0, 20)}`,
        title: cleanTitle,
        summary: null,
        publisher,
        source: "google-rss",
        sourceLabel: "Google News",
        link: link || null,
        publishTime: pubDate ? new Date(pubDate).toISOString() : null,
        thumbnail: null,
        relatedTickers: [symbol],
        reliability: rel,
        reliabilityTier: tier.label,
        reliabilityColor: tier.color,
        category: null,
        sentiment: null,
      });
    }

    return articles;
  } catch {
    return [];
  }
}

function extractXmlTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(re);
  return match ? match[1].trim() : null;
}

// ── Bing News RSS fetcher ────────────────────────────────────────────────────
// Free, no API key, aggregates from reputable publishers
async function fetchBingNewsRSS(symbol: string): Promise<MultiNewsArticle[]> {
  try {
    const query = encodeURIComponent(`${symbol} stock market`);
    const url = `https://www.bing.com/news/search?q=${query}&format=rss&count=15`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StockDashboard/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const articles: MultiNewsArticle[] = [];
    const items = xml.split("<item>").slice(1);

    for (const item of items.slice(0, 15)) {
      const title = extractXmlTag(item, "title");
      const link = extractXmlTag(item, "link");
      const pubDate = extractXmlTag(item, "pubDate");
      const sourceTag = extractXmlTag(item, "news:source");
      const description = extractXmlTag(item, "description");

      if (!title) continue;

      const publisher = sourceTag || "Bing News";
      const rel = getReliability(publisher);
      const tier = reliabilityTier(rel);

      // Only include reliable sources
      if (rel < 70) continue;

      articles.push({
        id: `bn_${symbol}_${pubDate || title.slice(0, 20)}`,
        title: title.replace(/<[^>]*>/g, ""), // strip HTML
        summary: description ? description.replace(/<[^>]*>/g, "").slice(0, 200) : null,
        publisher,
        source: "google-rss", // reuse the type since it's also RSS
        sourceLabel: "Bing News",
        link: link || null,
        publishTime: pubDate ? new Date(pubDate).toISOString() : null,
        thumbnail: null,
        relatedTickers: [symbol],
        reliability: rel,
        reliabilityTier: tier.label,
        reliabilityColor: tier.color,
        category: null,
        sentiment: null,
      });
    }
    return articles;
  } catch {
    return [];
  }
}

// ── Yahoo Finance adapter (wraps existing data) ─────────────────────────────
export function adaptYahooNews(yahooArticles: any[]): MultiNewsArticle[] {
  return yahooArticles.map((a: any) => {
    const publisher = a.publisher || "Yahoo Finance";
    const rel = getReliability(publisher);
    const tier = reliabilityTier(rel);
    return {
      id: `yf_${a.uuid || a.title?.slice(0, 20)}`,
      title: a.title || "",
      summary: null,
      publisher,
      source: "yahoo" as const,
      sourceLabel: "Yahoo Finance",
      link: a.link || null,
      publishTime: a.publishTime || null,
      thumbnail: a.thumbnail || null,
      relatedTickers: a.relatedTickers || [],
      reliability: rel,
      reliabilityTier: tier.label,
      reliabilityColor: tier.color,
      category: a.type || null,
      sentiment: null,
    };
  });
}

// ── Main aggregator ─────────────────────────────────────────────────────────
export async function fetchMultiSourceNews(symbol: string): Promise<MultiNewsResult> {
  const cacheKey = `multi_news_${symbol}`;
  const cached = getCache<MultiNewsResult>(cacheKey);
  if (cached) return cached;

  // Fetch from all free sources in parallel (no API keys required)
  const [googleArticles, bingArticles] = await Promise.all([
    fetchGoogleNewsRSS(symbol),
    fetchBingNewsRSS(symbol),
  ]);

  // Combine and deduplicate
  const allArticles = [...googleArticles, ...bingArticles];

  // Deduplicate by similarity of titles
  const deduped: MultiNewsArticle[] = [];
  const seen = new Set<string>();
  for (const article of allArticles) {
    // Normalize title for dedup
    const key = article.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(article);
  }

  // Sort by reliability then recency
  deduped.sort((a, b) => {
    const relDiff = b.reliability - a.reliability;
    if (Math.abs(relDiff) > 5) return relDiff;
    // Same tier, sort by date
    const dateA = a.publishTime ? new Date(a.publishTime).getTime() : 0;
    const dateB = b.publishTime ? new Date(b.publishTime).getTime() : 0;
    return dateB - dateA;
  });

  // Source breakdown
  const sourceMap = new Map<string, { count: number; totalRel: number }>();
  for (const a of deduped) {
    const existing = sourceMap.get(a.sourceLabel) || { count: 0, totalRel: 0 };
    existing.count++;
    existing.totalRel += a.reliability;
    sourceMap.set(a.sourceLabel, existing);
  }
  const sourceBreakdown = [...sourceMap.entries()].map(([source, data]) => ({
    source,
    count: data.count,
    avgReliability: Math.round(data.totalRel / data.count),
  }));

  const avgReliability = deduped.length > 0
    ? Math.round(deduped.reduce((s, a) => s + a.reliability, 0) / deduped.length)
    : 0;

  const result: MultiNewsResult = {
    symbol,
    articles: deduped,
    sourceBreakdown,
    totalArticles: deduped.length,
    avgReliability,
  };

  setCache(cacheKey, result, CACHE_TTL);
  return result;
}

// Export reliability helpers for other services
export { getReliability, reliabilityTier, SOURCE_RELIABILITY };
