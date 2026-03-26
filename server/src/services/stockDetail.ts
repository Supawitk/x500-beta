import YahooFinance from "yahoo-finance2";
import { getCache, setCache } from "./cache";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const CACHE_TTL = 120_000; // 2 minutes

export interface StockDetail {
  analystTargetHigh: number | null;
  analystTargetLow: number | null;
  analystTargetMean: number | null;
  analystTargetMedian: number | null;
  recommendationKey: string | null;
  numberOfAnalysts: number | null;
  recommendations: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
  enterpriseToRevenue: number | null;
  enterpriseToEbitda: number | null;
  shortRatio: number | null;
  shortPercentOfFloat: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
  fiftyTwoWeekChange: number | null;
  forwardEps: number | null;
  trailingEps: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  bookValue: number | null;
  beta: number | null;
  debtToEquity: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  totalRevenue: number | null;
  ebitda: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  sector: string | null;
  industry: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  revenuePerShare: number | null;
}

export async function fetchStockDetail(symbol: string): Promise<StockDetail | null> {
  const cacheKey = `detail_${symbol}`;
  const cached = getCache<StockDetail>(cacheKey);
  if (cached) return cached;

  try {
    const r = await yf.quoteSummary(symbol, {
      modules: ["financialData", "defaultKeyStatistics", "recommendationTrend", "summaryDetail", "summaryProfile"],
    });
    const fd = r.financialData;
    const ks = r.defaultKeyStatistics;
    const sd = r.summaryDetail as any;
    const sp = r.summaryProfile as any;
    const rec = r.recommendationTrend?.trend?.[0];

    const detail: StockDetail = {
      analystTargetHigh: fd?.targetHighPrice ?? null,
      analystTargetLow: fd?.targetLowPrice ?? null,
      analystTargetMean: fd?.targetMeanPrice ?? null,
      analystTargetMedian: fd?.targetMedianPrice ?? null,
      recommendationKey: fd?.recommendationKey ?? null,
      numberOfAnalysts: fd?.numberOfAnalystOpinions ?? null,
      recommendations: rec ? {
        strongBuy: rec.strongBuy ?? 0, buy: rec.buy ?? 0,
        hold: rec.hold ?? 0, sell: rec.sell ?? 0, strongSell: rec.strongSell ?? 0,
      } : null,
      revenueGrowth: fd?.revenueGrowth ?? null,
      earningsGrowth: fd?.earningsGrowth ?? null,
      grossMargins: fd?.grossMargins ?? null,
      operatingMargins: fd?.operatingMargins ?? null,
      profitMargins: fd?.profitMargins ?? null,
      freeCashflow: fd?.freeCashflow ?? null,
      operatingCashflow: fd?.operatingCashflow ?? null,
      currentRatio: fd?.currentRatio ?? null,
      quickRatio: fd?.quickRatio ?? null,
      returnOnAssets: fd?.returnOnAssets ?? null,
      returnOnEquity: fd?.returnOnEquity ?? null,
      enterpriseToRevenue: ks?.enterpriseToRevenue ?? null,
      enterpriseToEbitda: ks?.enterpriseToEbitda ?? null,
      shortRatio: ks?.shortRatio ?? null,
      shortPercentOfFloat: ks?.shortPercentOfFloat ?? null,
      heldPercentInsiders: ks?.heldPercentInsiders ?? null,
      heldPercentInstitutions: ks?.heldPercentInstitutions ?? null,
      fiftyTwoWeekChange: ks?.["52WeekChange"] ?? null,
      forwardEps: ks?.forwardEps ?? null,
      trailingEps: ks?.trailingEps ?? null,
      trailingPE: sd?.trailingPE ?? null,
      forwardPE: sd?.forwardPE ?? null,
      pegRatio: ks?.pegRatio ?? null,
      priceToBook: ks?.priceToBook ?? null,
      bookValue: ks?.bookValue ?? null,
      beta: ks?.beta ?? null,
      debtToEquity: fd?.debtToEquity ?? null,
      totalDebt: fd?.totalDebt ?? null,
      totalCash: fd?.totalCash ?? null,
      totalRevenue: fd?.totalRevenue ?? null,
      ebitda: fd?.ebitda ?? null,
      marketCap: sd?.marketCap ?? null,
      dividendYield: sd?.dividendYield ?? null,
      sector: sp?.sector ?? null,
      industry: sp?.industry ?? null,
      fiftyTwoWeekHigh: sd?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: sd?.fiftyTwoWeekLow ?? null,
      fiftyDayAverage: sd?.fiftyDayAverage ?? null,
      twoHundredDayAverage: sd?.twoHundredDayAverage ?? null,
      revenuePerShare: fd?.revenuePerShare ?? null,
    };

    setCache(cacheKey, detail, CACHE_TTL);
    return detail;
  } catch {
    return null;
  }
}
