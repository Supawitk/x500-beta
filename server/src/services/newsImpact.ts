/**
 * News-Based Pattern Matching Engine
 *
 * 1. Fetches news for target stock + reference stocks
 * 2. Builds TF-IDF keyword vectors from headlines
 * 3. Cosine similarity to find historically similar news across stocks
 * 4. Extracts post-news price patterns (1d, 5d, 20d, 60d returns)
 * 5. Backtests predictions against actual outcomes
 * 6. Accumulates data in a persistent JSON corpus for auto-training
 */

import YahooFinance from "yahoo-finance2";
import { fetchHistory, type OHLCV } from "./historical";
import { getCache, setCache } from "./cache";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ── Types ────────────────────────────────────────────────────────────────────
interface NewsEntry {
  id: string;
  symbol: string;
  title: string;
  publishDate: string;
  category: string;
  sentiment: number; // -1 to 1
  keywords: string[];
  tfidfVector: Record<string, number>;
  priceImpact: {
    day3: number | null;
    day5: number | null;
    day10: number | null;
  };
}

interface SimilarMatch {
  entry: NewsEntry;
  similarity: number;
  priceImpact: NewsEntry["priceImpact"];
}

export interface NewsImpactResult {
  symbol: string;
  targetNews: {
    title: string;
    date: string;
    link: string | null;
    category: string;
    sentiment: number;
    keywords: string[];
  }[];
  matches: {
    newsTitle: string;
    newsDate: string;
    matchSymbol: string;
    similarity: number;
    category: string;
    sentiment: number;
    priceImpact: NewsEntry["priceImpact"];
  }[];
  prediction: {
    day3: { avg: number; median: number; winRate: number; count: number };
    day5: { avg: number; median: number; winRate: number; count: number };
    day10: { avg: number; median: number; winRate: number; count: number };
  };
  backtest: {
    totalPredictions: number;
    accurateDirection: number;
    directionAccuracy: number;
    avgError: number;
    profitFactor: number;
  };
  confidence: number;
  confidenceBreakdown: {
    matchQuality: number;
    sampleSize: number;
    consistency: number;
    backtestScore: number;
  };
  perArticlePredictions: {
    day3: { avg: number; median: number; winRate: number; count: number };
    day5: { avg: number; median: number; winRate: number; count: number };
    day10: { avg: number; median: number; winRate: number; count: number };
  }[];
  corpusSize: number;
  trainingCycles: number;
}

// ── Stopwords & sentiment ────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "can", "could", "of", "in", "to", "for",
  "with", "on", "at", "from", "by", "about", "as", "into", "through",
  "its", "it", "this", "that", "these", "those", "and", "or", "but",
  "not", "no", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "than", "too", "very", "just", "also",
  "after", "before", "between", "during", "while", "if", "so", "up",
  "out", "what", "which", "who", "when", "where", "how", "why",
  "new", "says", "said", "one", "two", "per", "vs", "get",
]);

const BULLISH_WORDS = new Set([
  "beat", "beats", "exceeds", "surge", "surges", "rally", "rallies",
  "upgrade", "upgraded", "buy", "outperform", "bullish", "soar", "soars",
  "record", "growth", "profit", "gains", "positive", "strong", "boost",
  "rise", "rises", "high", "approval", "approves", "approved",
  "dividend", "buyback", "acquisition", "partnership", "launch",
  "breakthrough", "innovation", "optimism", "recovery", "expansion",
]);

const BEARISH_WORDS = new Set([
  "miss", "misses", "decline", "declines", "fall", "falls", "drop",
  "drops", "downgrade", "downgraded", "sell", "underperform", "bearish",
  "crash", "plunge", "loss", "losses", "negative", "weak", "cut",
  "cuts", "warning", "lawsuit", "layoff", "layoffs", "recall",
  "investigation", "fraud", "bankruptcy", "default", "recession",
  "inflation", "shortage", "delay", "fine", "penalty", "concern",
]);

// ── News categories ──────────────────────────────────────────────────────────
const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/earnings|revenue|profit|eps|quarter|fiscal|results/i, "Earnings"],
  [/upgrade|downgrade|target|rating|analyst|price target/i, "Analyst Rating"],
  [/fda|approval|drug|trial|clinical|phase/i, "FDA/Regulatory"],
  [/merger|acquisition|acquire|deal|buyout|takeover/i, "M&A"],
  [/dividend|buyback|repurchase|capital return/i, "Shareholder Returns"],
  [/lawsuit|sue|settlement|investigation|sec|probe/i, "Legal"],
  [/layoff|restructur|cost.cut|reorganiz/i, "Restructuring"],
  [/launch|product|release|unveil|introduce/i, "Product Launch"],
  [/partnership|collaborat|alliance|agreement|contract/i, "Partnership"],
  [/ipo|listing|public|offering/i, "IPO/Offering"],
  [/crypto|bitcoin|blockchain/i, "Crypto"],
  [/ai|artificial intelligence|machine learning|chatbot/i, "AI/Tech"],
  [/oil|energy|solar|renewable|climate/i, "Energy"],
  [/interest rate|fed|inflation|gdp|employment|economic/i, "Macro"],
];

function categorizeNews(title: string): string {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(title)) return category;
  }
  return "General";
}

function sentimentScore(title: string): number {
  const words = title.toLowerCase().split(/\W+/);
  let score = 0;
  for (const w of words) {
    if (BULLISH_WORDS.has(w)) score += 1;
    if (BEARISH_WORDS.has(w)) score -= 1;
  }
  return Math.max(-1, Math.min(1, score / Math.max(words.length * 0.3, 1)));
}

// ── Text processing ──────────────────────────────────────────────────────────
function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function buildTfIdfVector(keywords: string[], idf: Record<string, number>): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const w of keywords) {
    tf[w] = (tf[w] || 0) + 1;
  }
  const vec: Record<string, number> = {};
  for (const [word, count] of Object.entries(tf)) {
    vec[word] = (count / keywords.length) * (idf[word] || 1);
  }
  return vec;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of allKeys) {
    const av = a[k] || 0;
    const bv = b[k] || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

// ── Corpus persistence (auto-training) ──────────────────────────────────────
const CORPUS_DIR = join(import.meta.dir, "../../data");
const CORPUS_FILE = join(CORPUS_DIR, "news_corpus.json");

interface Corpus {
  entries: NewsEntry[];
  idf: Record<string, number>;
  trainingCycles: number;
  lastUpdated: string;
}

function loadCorpus(): Corpus {
  try {
    if (existsSync(CORPUS_FILE)) {
      return JSON.parse(readFileSync(CORPUS_FILE, "utf-8"));
    }
  } catch {}
  return { entries: [], idf: {}, trainingCycles: 0, lastUpdated: "" };
}

function saveCorpus(corpus: Corpus) {
  try {
    if (!existsSync(CORPUS_DIR)) mkdirSync(CORPUS_DIR, { recursive: true });
    corpus.lastUpdated = new Date().toISOString();
    writeFileSync(CORPUS_FILE, JSON.stringify(corpus));
  } catch {}
}

function updateIdf(corpus: Corpus) {
  const docCount = corpus.entries.length;
  if (docCount === 0) return;
  const wordDocCount: Record<string, number> = {};
  for (const entry of corpus.entries) {
    const seen = new Set<string>();
    for (const kw of entry.keywords) {
      if (!seen.has(kw)) {
        wordDocCount[kw] = (wordDocCount[kw] || 0) + 1;
        seen.add(kw);
      }
    }
  }
  const idf: Record<string, number> = {};
  for (const [word, count] of Object.entries(wordDocCount)) {
    idf[word] = Math.log(docCount / count) + 1;
  }
  corpus.idf = idf;
}

// ── Price impact extraction ──────────────────────────────────────────────────
function extractPriceImpact(
  history: OHLCV[],
  newsDate: string,
): NewsEntry["priceImpact"] {
  const dateIdx = history.findIndex(h => h.date >= newsDate);
  if (dateIdx < 0 || dateIdx >= history.length - 1) {
    return { day3: null, day5: null, day10: null };
  }
  const basePrice = history[dateIdx].close;
  const pctReturn = (daysAhead: number) => {
    const idx = dateIdx + daysAhead;
    // Need at least 80% of requested days ahead for valid measurement
    if (idx >= history.length || (history.length - 1 - dateIdx) < daysAhead * 0.8) return null;
    return Math.round(((history[idx].close - basePrice) / basePrice) * 10000) / 100;
  };
  return {
    day3: pctReturn(3),
    day5: pctReturn(5),
    day10: pctReturn(10),
  };
}

// ── Reference stocks for training ────────────────────────────────────────────
const REFERENCE_STOCKS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM",
  "JNJ", "V", "UNH", "HD", "PG", "MA", "DIS", "NFLX", "ADBE",
  "CRM", "INTC", "AMD", "BA", "GS", "WMT", "KO", "PEP",
];

// ── Main analysis function ──────────────────────────────────────────────────
export async function analyzeNewsImpact(symbol: string): Promise<NewsImpactResult> {
  const cacheKey = `news_impact_${symbol}`;
  const cached = getCache<NewsImpactResult>(cacheKey);
  if (cached) return cached;

  const corpus = loadCorpus();

  // 1. Fetch current news for target stock
  let targetNews: { title: string; date: string; link: string | null; category: string; sentiment: number; keywords: string[] }[] = [];
  try {
    const searchResult = await yf.search(symbol, { newsCount: 15, quotesCount: 0 });
    const articles = searchResult.news || [];
    targetNews = articles
      .filter((a: any) => a.title && a.providerPublishTime)
      .map((a: any) => {
        const title = a.title as string;
        const date = new Date(a.providerPublishTime).toISOString().split("T")[0];
        return {
          title,
          date,
          link: a.link || null,
          category: categorizeNews(title),
          sentiment: sentimentScore(title),
          keywords: extractKeywords(title),
        };
      });
  } catch {}

  // 2. Train corpus with reference stocks (if corpus is small or stale)
  const needsTraining = corpus.entries.length < 100 ||
    (Date.now() - new Date(corpus.lastUpdated || 0).getTime()) > 3600000; // 1 hour

  if (needsTraining) {
    // Use more stocks on first run to build corpus faster
    const isFirstRun = corpus.trainingCycles === 0;
    const cycle = corpus.trainingCycles % REFERENCE_STOCKS.length;
    const batchSize = isFirstRun ? 12 : 5;
    const trainingStocks = [
      symbol,
      ...REFERENCE_STOCKS.slice(cycle, cycle + batchSize),
      ...REFERENCE_STOCKS.slice(0, Math.max(0, cycle + batchSize - REFERENCE_STOCKS.length)),
    ];
    const uniqueStocks = [...new Set(trainingStocks)];

    const trainPromises = uniqueStocks.map(async (sym) => {
      try {
        const [searchResult, insightsResult, history] = await Promise.allSettled([
          yf.search(sym, { newsCount: 20, quotesCount: 0 }),
          yf.insights(sym, { reportsCount: 0 }),
          fetchHistory(sym, "2y", "1d"),
        ]);

        const histData = history.status === "fulfilled" ? history.value : [];

        const newEntries: NewsEntry[] = [];
        const existingIds = new Set(corpus.entries.map(e => e.id));

        // Add news articles
        if (searchResult.status === "fulfilled") {
          const articles = searchResult.value.news || [];
          for (const a of articles) {
            if (!a.title || !a.providerPublishTime) continue;
            const title = a.title as string;
            const date = new Date(a.providerPublishTime).toISOString().split("T")[0];
            const id = `${sym}_${date}_${title.slice(0, 30)}`;
            if (existingIds.has(id)) continue;
            existingIds.add(id);

            newEntries.push({
              id, symbol: sym, title, publishDate: date,
              category: categorizeNews(title),
              sentiment: sentimentScore(title),
              keywords: extractKeywords(title),
              tfidfVector: {},
              priceImpact: extractPriceImpact(histData, date),
            });
          }
        }

        // Add significant developments (often have older dates with measurable impact)
        if (insightsResult.status === "fulfilled") {
          const sigDevs = insightsResult.value.sigDevs || [];
          for (const d of sigDevs) {
            if (!d.headline || !d.date) continue;
            const title = d.headline as string;
            const date = new Date(d.date).toISOString().split("T")[0];
            const id = `${sym}_sd_${date}_${title.slice(0, 30)}`;
            if (existingIds.has(id)) continue;
            existingIds.add(id);

            newEntries.push({
              id, symbol: sym, title, publishDate: date,
              category: categorizeNews(title),
              sentiment: sentimentScore(title),
              keywords: extractKeywords(title),
              tfidfVector: {},
              priceImpact: extractPriceImpact(histData, date),
            });
          }
        }

        // Generate synthetic entries from significant price events
        // (large moves often correspond to news even if we don't have the text)
        if (histData.length > 60) {
          for (let i = 1; i < histData.length - 60; i++) {
            const ret = (histData[i].close - histData[i - 1].close) / histData[i - 1].close;
            const volSpike = i > 20 ? histData[i].volume / (histData.slice(i - 20, i).reduce((s, d) => s + d.volume, 0) / 20) : 0;

            // Only capture significant events (>3% move or >3x volume)
            if (Math.abs(ret) < 0.03 && volSpike < 3) continue;

            const direction = ret > 0 ? "surge" : "decline";
            const magnitude = Math.abs(ret * 100).toFixed(1);
            const title = `${sym} ${direction} ${magnitude}% ${volSpike > 3 ? "high volume" : ""} ${histData[i].date}`;
            const id = `${sym}_evt_${histData[i].date}`;
            if (existingIds.has(id)) continue;
            existingIds.add(id);

            const category = ret > 0 ? "Price Surge" : "Price Drop";
            newEntries.push({
              id, symbol: sym, title, publishDate: histData[i].date,
              category,
              sentiment: ret > 0 ? 0.5 : -0.5,
              keywords: extractKeywords(title),
              tfidfVector: {},
              priceImpact: extractPriceImpact(histData, histData[i].date),
            });
          }
        }

        return newEntries;
      } catch {
        return [];
      }
    });

    const results = await Promise.allSettled(trainPromises);
    for (const r of results) {
      if (r.status === "fulfilled") {
        corpus.entries.push(...r.value);
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    corpus.entries = corpus.entries.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Keep corpus manageable (max 2000 entries)
    if (corpus.entries.length > 2000) {
      corpus.entries = corpus.entries.slice(-2000);
    }

    // Update IDF and recompute all TF-IDF vectors
    updateIdf(corpus);
    for (const entry of corpus.entries) {
      entry.tfidfVector = buildTfIdfVector(entry.keywords, corpus.idf);
    }

    corpus.trainingCycles++;
    saveCorpus(corpus);
  }

  // 3. Find similar news using cosine similarity — per-article
  const allMatches: SimilarMatch[] = [];
  const perArticleMatches: SimilarMatch[][] = [];

  for (const tn of targetNews) {
    const targetVec = buildTfIdfVector(tn.keywords, corpus.idf);
    const articleMatches: SimilarMatch[] = [];

    for (const entry of corpus.entries) {
      // Skip entries without measurable price impact data
      if (entry.priceImpact.day3 === null && entry.priceImpact.day5 === null && entry.priceImpact.day10 === null) continue;

      // Skip same symbol's news from same week (avoid self-matching)
      if (entry.symbol === symbol &&
          Math.abs(new Date(entry.publishDate).getTime() - new Date(tn.date).getTime()) < 7 * 86400000) {
        continue;
      }

      const sim = cosineSimilarity(targetVec, entry.tfidfVector);

      // Also factor in category match and sentiment alignment
      const categoryBonus = entry.category === tn.category ? 0.15 : 0;
      const sentimentBonus = Math.abs(entry.sentiment - tn.sentiment) < 0.3 ? 0.1 : 0;
      const adjustedSim = Math.min(1, sim + categoryBonus + sentimentBonus);

      if (adjustedSim > 0.25) {
        const match: SimilarMatch = {
          entry,
          similarity: Math.round(adjustedSim * 1000) / 1000,
          priceImpact: entry.priceImpact,
        };
        allMatches.push(match);
        articleMatches.push(match);
      }
    }

    articleMatches.sort((a, b) => b.similarity - a.similarity);
    perArticleMatches.push(articleMatches.slice(0, 15));
  }

  // Sort by similarity, take top matches
  allMatches.sort((a, b) => b.similarity - a.similarity);
  // Deduplicate (same entry may match multiple target articles)
  const seenIds = new Set<string>();
  const topMatches = allMatches.filter(m => {
    if (seenIds.has(m.entry.id)) return false;
    seenIds.add(m.entry.id);
    return true;
  }).slice(0, 30);

  // 4. Aggregate predictions
  function aggregateHorizon(matches: SimilarMatch[], key: keyof NewsEntry["priceImpact"]) {
    const vals = matches
      .map(m => m.priceImpact[key])
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return { avg: 0, median: 0, winRate: 0, count: 0 };

    // Weighted by similarity
    const weights = matches
      .filter(m => m.priceImpact[key] !== null)
      .map(m => m.similarity);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const weightedAvg = totalW > 0
      ? vals.reduce((s, v, i) => s + v * weights[i], 0) / totalW
      : 0;

    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const wins = vals.filter(v => v > 0).length;

    return {
      avg: Math.round(weightedAvg * 100) / 100,
      median: Math.round(median * 100) / 100,
      winRate: Math.round((wins / vals.length) * 100),
      count: vals.length,
    };
  }

  const prediction = {
    day3: aggregateHorizon(topMatches, "day3"),
    day5: aggregateHorizon(topMatches, "day5"),
    day10: aggregateHorizon(topMatches, "day10"),
  };

  // 5. Backtest: check how well past similar-news predictions matched actual outcomes
  // Use the corpus entries that have price impact data
  const backtestEntries = corpus.entries.filter(
    e => e.priceImpact.day5 !== null && e.priceImpact.day10 !== null
  );
  let accurateDir = 0;
  let totalPred = 0;
  let totalError = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  // For each entry, find similar ones and see if they predicted correctly
  const sampleSize = Math.min(100, backtestEntries.length);
  const step = Math.max(1, Math.floor(backtestEntries.length / sampleSize));

  for (let i = 0; i < backtestEntries.length; i += step) {
    const entry = backtestEntries[i];
    const entryVec = entry.tfidfVector;

    // Find similar entries (excluding itself and same-date entries)
    const similar = corpus.entries
      .filter(e => e.id !== entry.id &&
        Math.abs(new Date(e.publishDate).getTime() - new Date(entry.publishDate).getTime()) > 7 * 86400000 &&
        e.priceImpact.day10 !== null)
      .map(e => ({
        sim: cosineSimilarity(entryVec, e.tfidfVector),
        impact: e.priceImpact.day10!,
      }))
      .filter(e => e.sim > 0.2)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 10);

    if (similar.length < 3) continue;

    const predictedReturn = similar.reduce((s, e) => s + e.impact * e.sim, 0) /
      similar.reduce((s, e) => s + e.sim, 0);
    const actualReturn = entry.priceImpact.day10!;

    totalPred++;
    if ((predictedReturn > 0 && actualReturn > 0) || (predictedReturn < 0 && actualReturn < 0)) {
      accurateDir++;
    }
    totalError += Math.abs(predictedReturn - actualReturn);

    if (actualReturn > 0) grossProfit += actualReturn;
    else grossLoss += Math.abs(actualReturn);
  }

  const directionAccuracy = totalPred > 0 ? Math.round((accurateDir / totalPred) * 100) : 0;
  const avgError = totalPred > 0 ? Math.round((totalError / totalPred) * 100) / 100 : 0;
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : 0;

  // 6. Confidence scoring
  const avgSimilarity = topMatches.length > 0
    ? topMatches.reduce((s, m) => s + m.similarity, 0) / topMatches.length
    : 0;

  const matchQuality = Math.min(30, avgSimilarity * 40); // 0-30
  const sampleSizeScore = Math.min(25, topMatches.length * 1.5); // 0-25
  const consistencyScore = (() => {
    // How consistent are the predictions across horizons?
    const signs = [prediction.day3.avg, prediction.day5.avg, prediction.day10.avg]
      .filter(v => v !== 0);
    const allSameSign = signs.length > 0 && signs.every(v => v > 0) || signs.every(v => v < 0);
    const winRateBonus = Math.min(15, prediction.day10.winRate / 5);
    return (allSameSign ? 10 : 0) + winRateBonus; // 0-25
  })();
  const backtestScore = Math.min(20, directionAccuracy / 5); // 0-20

  const confidence = Math.round(
    Math.max(0, Math.min(100, matchQuality + sampleSizeScore + consistencyScore + backtestScore))
  );

  const result: NewsImpactResult = {
    symbol,
    targetNews: targetNews.slice(0, 10),
    matches: topMatches.slice(0, 20).map(m => ({
      newsTitle: m.entry.title,
      newsDate: m.entry.publishDate,
      matchSymbol: m.entry.symbol,
      similarity: m.similarity,
      category: m.entry.category,
      sentiment: m.entry.sentiment,
      priceImpact: m.priceImpact,
    })),
    prediction,
    backtest: {
      totalPredictions: totalPred,
      accurateDirection: accurateDir,
      directionAccuracy,
      avgError,
      profitFactor,
    },
    confidence,
    confidenceBreakdown: {
      matchQuality: Math.round(matchQuality),
      sampleSize: Math.round(sampleSizeScore),
      consistency: Math.round(consistencyScore),
      backtestScore: Math.round(backtestScore),
    },
    perArticlePredictions: perArticleMatches.map(matches => ({
      day3: aggregateHorizon(matches, "day3"),
      day5: aggregateHorizon(matches, "day5"),
      day10: aggregateHorizon(matches, "day10"),
    })),
    corpusSize: corpus.entries.length,
    trainingCycles: corpus.trainingCycles,
  };

  setCache(cacheKey, result, 600_000); // 10 min cache
  return result;
}
