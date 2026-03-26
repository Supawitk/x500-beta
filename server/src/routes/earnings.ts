import { Elysia } from "elysia";
import YahooFinance from "yahoo-finance2";
import { getCache, setCache } from "../services/cache";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const CACHE_TTL = 180_000; // 3 min

function round2(n: number | null | undefined): number | null {
  if (n == null || !isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
function round4(n: number | null | undefined): number | null {
  if (n == null || !isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function safeDate(d: any): string | null {
  if (!d) return null;
  try { return new Date(d).toISOString().split("T")[0]; } catch { return null; }
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export const earningsRoutes = new Elysia({ prefix: "/api/earnings" })
  .get("/:symbol", async ({ params }) => {
    const symbol = params.symbol.toUpperCase();
    const cacheKey = `earnings_${symbol}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const [r, ftsQ, ftsA] = await Promise.all([
        yf.quoteSummary(symbol, {
          modules: ["calendarEvents", "earningsTrend", "summaryDetail", "earningsHistory"],
        }),
        yf.fundamentalsTimeSeries(symbol, {
          period1: new Date(Date.now() - 2 * 365 * 86400000).toISOString().split("T")[0],
          type: "quarterly",
          module: "financials",
        }).catch(() => []),
        yf.fundamentalsTimeSeries(symbol, {
          period1: new Date(Date.now() - 5 * 365 * 86400000).toISOString().split("T")[0],
          type: "annual",
          module: "financials",
        }).catch(() => []),
      ]);

      const cal = r.calendarEvents;
      const sd  = r.summaryDetail;
      const eh  = r.earningsHistory;
      const et  = r.earningsTrend;

      // ── Earnings ──────────────────────────────────────────────────────────
      const nextEarningsDate = safeDate(cal?.earnings?.earningsDate?.[0]);
      const trend0 = et?.trend?.find((t: any) => t.period === "0q");
      const trend1 = et?.trend?.find((t: any) => t.period === "+1q");
      const trend4 = et?.trend?.find((t: any) => t.period === "0y");

      const epsEstimate = {
        current: round2(trend0?.earningsEstimate?.avg),
        low:     round2(trend0?.earningsEstimate?.low),
        high:    round2(trend0?.earningsEstimate?.high),
        yearAgo: round2(trend0?.earningsEstimate?.yearAgoEps),
        growth:  round2(trend0?.earningsEstimate?.growth),
        analysts: trend0?.earningsEstimate?.numberOfAnalysts ?? null,
        endDate: safeDate(trend0?.endDate),
      };

      const revenueEstimate = {
        avg:     round2(trend0?.revenueEstimate?.avg),
        low:     round2(trend0?.revenueEstimate?.low),
        high:    round2(trend0?.revenueEstimate?.high),
        yearAgo: round2(trend0?.revenueEstimate?.yearAgoRevenue),
        growth:  round2(trend0?.revenueEstimate?.growth),
      };

      // EPS revisions momentum — are analysts raising or cutting?
      const revisions = trend0?.epsRevisions;
      const revisionScore = revisions
        ? (revisions.upLast30days ?? 0) - (revisions.downLast30days ?? 0)
        : null;
      const revisionLabel = revisionScore == null ? "N/A"
        : revisionScore > 2  ? "Strongly Bullish"
        : revisionScore > 0  ? "Slightly Bullish"
        : revisionScore === 0 ? "Neutral"
        : revisionScore > -3 ? "Slightly Bearish"
        : "Bearish";

      // EPS trend (7d / 30d / 60d / 90d)
      const epsTrend = trend0?.epsTrend
        ? {
            current:  round2(trend0.epsTrend.current),
            d7:       round2(trend0.epsTrend["7daysAgo"]),
            d30:      round2(trend0.epsTrend["30daysAgo"]),
            d60:      round2(trend0.epsTrend["60daysAgo"]),
            d90:      round2(trend0.epsTrend["90daysAgo"]),
          }
        : null;

      // Last 4 quarterly EPS beats / misses
      const history = (eh?.history ?? []).slice(-4).map((h: any) => ({
        quarter:  safeDate(h.quarter),
        actual:   round2(h.epsActual),
        estimate: round2(h.epsEstimate),
        surprise: round2(h.surprisePercent),
        beat:     h.epsActual != null && h.epsEstimate != null
                    ? h.epsActual >= h.epsEstimate : null,
      }));

      // Next quarter estimate
      const nextQ = trend1 ? {
        endDate: safeDate(trend1.endDate),
        epsAvg:  round2(trend1.earningsEstimate?.avg),
        growth:  round2(trend1.earningsEstimate?.growth),
      } : null;

      // Annual estimate
      const annualEst = trend4 ? {
        endDate: safeDate(trend4.endDate),
        epsAvg:  round2(trend4.earningsEstimate?.avg),
        growth:  round2(trend4.earningsEstimate?.growth),
      } : null;

      // ── Dividend ──────────────────────────────────────────────────────────
      const exDivDate   = safeDate(cal?.exDividendDate);
      const divPayDate  = safeDate(cal?.dividendDate);
      const divRate     = round2(sd?.dividendRate);
      const divYield    = sd?.dividendYield != null ? round4(sd.dividendYield) : null;
      const fiveYrAvg   = sd?.fiveYearAvgDividendYield != null ? round2(sd.fiveYearAvgDividendYield) : null;
      const payoutRatio = round2(sd?.payoutRatio);
      const trailingPE  = round2(sd?.trailingPE);
      const forwardPE   = round2(sd?.forwardPE);
      const priceSales  = round2(sd?.priceToSalesTrailing12Months);

      // Payout ratio safety
      const payoutSafety = payoutRatio == null ? "N/A"
        : payoutRatio < 0.4  ? "Very Safe (<40%)"
        : payoutRatio < 0.6  ? "Safe (40–60%)"
        : payoutRatio < 0.75 ? "Moderate (60–75%)"
        : payoutRatio < 1.0  ? "Elevated (75–100%)"
        : "Potentially Unsustainable (>100%)";

      const payoutSafetyColor = payoutRatio == null ? "muted"
        : payoutRatio < 0.4  ? "green"
        : payoutRatio < 0.6  ? "green"
        : payoutRatio < 0.75 ? "yellow"
        : "red";

      // Dividend vs 5yr avg signal
      // divYield is decimal (0.022), fiveYrAvg is already percent (2.78) from Yahoo
      const fiveYrDecimal = fiveYrAvg != null ? fiveYrAvg / 100 : null;
      const divVs5yr = divYield != null && fiveYrDecimal != null && fiveYrDecimal > 0
        ? round2(((divYield - fiveYrDecimal) / fiveYrDecimal) * 100)
        : null;

      // ── Income from fundamentalsTimeSeries ──────────────────────────────
      function mapFts(entries: any[]) {
        return entries.map((s: any) => ({
          date: safeDate(s.date),
          revenue: s.totalRevenue ?? null,
          grossProfit: s.grossProfit ?? null,
          operatingIncome: s.operatingIncome ?? null,
          netIncome: s.netIncome ?? null,
          ebitda: s.EBITDA ?? null,
          eps: round2(s.dilutedEPS ?? s.basicEPS ?? null),
          rnd: s.researchAndDevelopment ?? null,
          grossMargin: s.totalRevenue ? round4((s.grossProfit ?? 0) / s.totalRevenue) : null,
          opMargin: s.totalRevenue ? round4((s.operatingIncome ?? 0) / s.totalRevenue) : null,
          netMargin: s.totalRevenue ? round4((s.netIncome ?? 0) / s.totalRevenue) : null,
        }));
      }
      const incomeQuarterly = mapFts(ftsQ ?? []);
      const incomeAnnual = mapFts(ftsA ?? []);

      const result = {
        symbol,
        earnings: {
          nextEarningsDate,
          daysUntilEarnings: daysUntil(nextEarningsDate),
          isEstimate: cal?.earnings?.isEarningsDateEstimate ?? false,
          epsEstimate,
          revenueEstimate,
          revisions: {
            up7d:   revisions?.upLast7days   ?? 0,
            up30d:  revisions?.upLast30days  ?? 0,
            down30d: revisions?.downLast30days ?? 0,
            score:  revisionScore,
            label:  revisionLabel,
          },
          epsTrend,
          history,
          nextQ,
          annualEst,
        },
        dividend: {
          exDivDate,
          daysUntilExDiv: daysUntil(exDivDate),
          payDate: divPayDate,
          annualRate: divRate,
          currentYield: divYield,
          fiveYearAvgYield: fiveYrDecimal,
          payoutRatio,
          payoutSafety,
          payoutSafetyColor,
          divVs5yrPct: round2(divVs5yr),
          isDividendPayer: divRate != null && divRate > 0,
        },
        valuation: {
          trailingPE,
          forwardPE,
          priceSales,
        },
        incomeHistory: {
          annual: incomeAnnual,
          quarterly: incomeQuarterly,
        },
        cashFlow: [],
        dividendHistory: null,
      };

      setCache(cacheKey, result, CACHE_TTL);
      return result;
    } catch (e: any) {
      return { error: "FETCH_FAILED", symbol, message: e.message ?? "Failed to fetch earnings data" };
    }
  });
