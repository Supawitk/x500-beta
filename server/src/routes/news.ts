import { Elysia } from "elysia";
import yf from "../services/yfClient";
import { getCache, setCache } from "../services/cache";
import { fetchMultiSourceNews, adaptYahooNews } from "../services/multiNews";
import { fetchSECFilings } from "../services/secEdgar";
const CACHE_TTL = 300_000; // 5 min

function safeDate(d: any): string | null {
  if (!d) return null;
  try { return new Date(d).toISOString(); } catch { return null; }
}

export const newsRoutes = new Elysia({ prefix: "/api/news" })
  .get("/:symbol", async ({ params }) => {
    const symbol = params.symbol.toUpperCase();
    const cacheKey = `news_${symbol}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch news via search and insights in parallel
      const [searchResult, insightsResult] = await Promise.allSettled([
        yf.search(symbol, { newsCount: 20, quotesCount: 0 }),
        yf.insights(symbol, { reportsCount: 5 }),
      ]);

      // News articles from search
      const news = searchResult.status === "fulfilled"
        ? (searchResult.value.news || []).map((n: any) => ({
            uuid: n.uuid,
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            publishTime: safeDate(n.providerPublishTime),
            type: n.type,
            thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? null,
            relatedTickers: n.relatedTickers ?? [],
          }))
        : [];

      // Insights data
      let sigDevs: any[] = [];
      let reports: any[] = [];
      let companySnapshot: any = null;
      let technicalOutlook: any = null;
      let recommendation: any = null;
      let upsell: any = null;

      if (insightsResult.status === "fulfilled") {
        const ins = insightsResult.value;

        sigDevs = (ins.sigDevs || []).map((d: any) => ({
          headline: d.headline,
          date: safeDate(d.date),
        }));

        reports = (ins.reports || []).map((r: any) => ({
          id: r.id,
          title: r.reportTitle || r.title,
          provider: r.provider,
          date: safeDate(r.reportDate),
          targetPrice: r.targetPrice ?? null,
          targetPriceStatus: r.targetPriceStatus ?? null,
          investmentRating: r.investmentRating ?? null,
        }));

        if (ins.companySnapshot) {
          companySnapshot = {
            sectorInfo: ins.companySnapshot.sectorInfo ?? null,
            company: {
              innovativeness: ins.companySnapshot.company?.innovativeness ?? null,
              hiring: ins.companySnapshot.company?.hiring ?? null,
              sustainability: ins.companySnapshot.company?.sustainability ?? null,
              insiderSentiments: ins.companySnapshot.company?.insiderSentiments ?? null,
              earningsReports: ins.companySnapshot.company?.earningsReports ?? null,
              dividends: ins.companySnapshot.company?.dividends ?? null,
            },
            sector: ins.companySnapshot.sector ? {
              innovativeness: ins.companySnapshot.sector.innovativeness ?? null,
              hiring: ins.companySnapshot.sector.hiring ?? null,
              sustainability: ins.companySnapshot.sector.sustainability ?? null,
              insiderSentiments: ins.companySnapshot.sector.insiderSentiments ?? null,
              earningsReports: ins.companySnapshot.sector.earningsReports ?? null,
              dividends: ins.companySnapshot.sector.dividends ?? null,
            } : null,
          };
        }

        if (ins.instrumentInfo?.technicalEvents) {
          const te = ins.instrumentInfo.technicalEvents;
          technicalOutlook = {
            shortTerm: te.shortTermOutlook ? {
              direction: te.shortTermOutlook.direction,
              score: te.shortTermOutlook.score,
              description: te.shortTermOutlook.scoreDescription,
            } : null,
            intermediateTerm: te.intermediateTermOutlook ? {
              direction: te.intermediateTermOutlook.direction,
              score: te.intermediateTermOutlook.score,
              description: te.intermediateTermOutlook.scoreDescription,
            } : null,
            longTerm: te.longTermOutlook ? {
              direction: te.longTermOutlook.direction,
              score: te.longTermOutlook.score,
              description: te.longTermOutlook.scoreDescription,
            } : null,
          };
        }

        if (ins.recommendation) {
          recommendation = {
            rating: ins.recommendation.rating,
            targetPrice: ins.recommendation.targetPrice ?? null,
            provider: ins.recommendation.provider,
          };
        }

        if (ins.upsell) {
          upsell = {
            bullishSummary: ins.upsell.msBullishSummary ?? [],
            bearishSummary: ins.upsell.msBearishSummary ?? [],
          };
        }
      }

      const result = {
        symbol,
        news,
        sigDevs,
        reports,
        companySnapshot,
        technicalOutlook,
        recommendation,
        upsell,
      };

      setCache(cacheKey, result, CACHE_TTL);
      return result;
    } catch (e: any) {
      return { error: "FETCH_FAILED", symbol, message: e.message ?? "Failed to fetch news" };
    }
  })
  .get("/multi/:symbol", async ({ params }) => {
    const symbol = params.symbol.toUpperCase();
    try {
      // Fetch Yahoo news + multi-source in parallel
      const [yahooSearch, multiSource] = await Promise.allSettled([
        yf.search(symbol, { newsCount: 15, quotesCount: 0 }),
        fetchMultiSourceNews(symbol),
      ]);

      // Adapt Yahoo articles to unified format
      const yahooArticles = yahooSearch.status === "fulfilled"
        ? adaptYahooNews((yahooSearch.value.news || []).map((n: any) => ({
            uuid: n.uuid,
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            publishTime: n.providerPublishTime ? new Date(n.providerPublishTime).toISOString() : null,
            type: n.type,
            thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? null,
            relatedTickers: n.relatedTickers ?? [],
          })))
        : [];

      const multiArticles = multiSource.status === "fulfilled"
        ? multiSource.value.articles : [];

      // Merge and deduplicate
      const all = [...yahooArticles, ...multiArticles];
      const seen = new Set<string>();
      const deduped = all.filter(a => {
        const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by reliability then date
      deduped.sort((a, b) => {
        const relDiff = b.reliability - a.reliability;
        if (Math.abs(relDiff) > 5) return relDiff;
        const dA = a.publishTime ? new Date(a.publishTime).getTime() : 0;
        const dB = b.publishTime ? new Date(b.publishTime).getTime() : 0;
        return dB - dA;
      });

      // Source breakdown
      const srcMap = new Map<string, { count: number; totalRel: number }>();
      for (const a of deduped) {
        const e = srcMap.get(a.sourceLabel) || { count: 0, totalRel: 0 };
        e.count++; e.totalRel += a.reliability;
        srcMap.set(a.sourceLabel, e);
      }

      return {
        symbol,
        articles: deduped,
        sourceBreakdown: [...srcMap.entries()].map(([src, d]) => ({
          source: src, count: d.count, avgReliability: Math.round(d.totalRel / d.count),
        })),
        totalArticles: deduped.length,
        avgReliability: deduped.length > 0
          ? Math.round(deduped.reduce((s, a) => s + a.reliability, 0) / deduped.length)
          : 0,
      };
    } catch (e: any) {
      return { error: "FETCH_FAILED", symbol, message: e.message ?? "Failed" };
    }
  })
  .get("/sec/:symbol", async ({ params }) => {
    const symbol = params.symbol.toUpperCase();
    try {
      return await fetchSECFilings(symbol);
    } catch (e: any) {
      return { error: "FETCH_FAILED", symbol, message: e.message ?? "Failed to fetch SEC filings" };
    }
  });
