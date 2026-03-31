import { Elysia, t } from "elysia";
import { fetchHistory } from "../services/historical";
import { runRScript } from "../services/rExecutor";
import { getCache, setCache, deleteCache, deleteCacheByPrefix } from "../services/cache";
import { toReturns } from "../utils/correlation";

const CACHE_TTL    = 180_000; // 3 min
const CACHE_TTL_ML = 300_000; // 5 min for heavier ML models

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildHistInput(history: any[]) {
  return {
    prices:  history.map((h) => h.close),
    highs:   history.map((h) => h.high),
    lows:    history.map((h) => h.low),
    volumes: history.map((h) => h.volume ?? 1e6),
    dates:   history.map((h) => h.date),
  };
}

export const predictionRoutes = new Elysia({ prefix: "/api/predict" })

  // ── Original ARIMA forecast ───────────────────────────────────────────────
  .get("/forecast/:symbol", async ({ params, query }) => {
    const symbol  = params.symbol.toUpperCase();
    const period  = query.period || "1y";
    const horizon = parseInt(query.horizon || "14");
    const cacheKey = `forecast_${symbol}_${period}_${horizon}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 30) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 30 points" };
      const prices  = history.map((h) => h.close);
      const result  = await runRScript("arima_forecast.R", { prices, horizon });
      if (result.success) {
        result.symbol = symbol;
        result.lastPrice = prices[prices.length - 1];
        result.dates = history.map((h) => h.date);
        setCache(cacheKey, result, CACHE_TTL);
      }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Forecast failed" };
    }
  }, { query: t.Object({ period: t.Optional(t.String()), horizon: t.Optional(t.String()) }) })

  // ── Risk metrics ──────────────────────────────────────────────────────────
  .get("/risk/:symbol", async ({ params, query }) => {
    const symbol   = params.symbol.toUpperCase();
    const period   = query.period || "1y";
    const cacheKey = `risk_${symbol}_${period}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 20) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 20 points" };
      const result  = await runRScript("risk_metrics.R", {
        prices: history.map((h) => h.close),
        risk_free: 0.05,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Risk calc failed" };
    }
  }, { query: t.Object({ period: t.Optional(t.String()) }) })

  // ── Original pattern backtest (v1) ────────────────────────────────────────
  // backtest v1 now redirects to enhanced v2 — kept for backwards compatibility
  .get("/backtest/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const window    = parseInt(query.window || "20");
    const lookahead = parseInt(query.lookahead || "14");
    const cacheKey  = `backtestv2_${symbol}_${window}_${lookahead}`;
    const cached    = getCache<any>(cacheKey);
    if (cached) return { ...cached, _note: "Upgraded: now uses enhanced backtest v2" };

    try {
      const history = await fetchHistory(symbol, "3y");
      if (history.length < window + lookahead + 30) {
        return { error: "INSUFFICIENT_DATA", message: `Need more data. Got ${history.length} days.` };
      }
      const result = await runRScript("enhanced_backtest.R", {
        ...buildHistInput(history), window, lookahead,
      });
      if (result.success) { result.symbol = symbol; result.dataPoints = history.length; result._note = "Upgraded: now uses enhanced backtest v2"; setCache(cacheKey, result, CACHE_TTL); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Backtest failed" };
    }
  }, { query: t.Object({ window: t.Optional(t.String()), lookahead: t.Optional(t.String()) }) })

  // ── Enhanced pattern backtest (v2) ────────────────────────────────────────
  .get("/backtest-v2/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const window    = parseInt(query.window || "20");
    const lookahead = parseInt(query.lookahead || "14");
    const retrain   = query.retrain === "true";
    const cacheKey  = `backtest_v2_${symbol}_${window}_${lookahead}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const history = await fetchHistory(symbol, "3y");
      if (history.length < window + lookahead + 40) {
        return { error: "INSUFFICIENT_DATA", message: `Need ≥ ${window + lookahead + 40} days. Got ${history.length}.` };
      }
      const result  = await runRScript("enhanced_backtest.R", {
        ...buildHistInput(history), window, lookahead,
      });
      if (result.success) {
        result.symbol = symbol; result.dataPoints = history.length;
        setCache(cacheKey, result, CACHE_TTL_ML);
      }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Enhanced backtest failed" };
    }
  }, {
    query: t.Object({
      window: t.Optional(t.String()),
      lookahead: t.Optional(t.String()),
      retrain: t.Optional(t.String()),
    }),
  })

  // ── ETS model (ETS vs ARIMA, walk-forward) ────────────────────────────────
  .get("/ets/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const horizon   = parseInt(query.horizon || "10");
    const period    = query.period || "2y";
    const train_pct = parseFloat(query.train_pct || "0.80");
    const retrain   = query.retrain === "true";
    const cacheKey  = `ets_${symbol}_${period}_${horizon}_${train_pct}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 60) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 60 days" };
      const result  = await runRScript("ets_model.R", {
        prices: history.map((h) => h.close),
        dates: history.map((h) => h.date),
        horizon, train_pct,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "ETS model failed" };
    }
  }, {
    query: t.Object({
      horizon: t.Optional(t.String()),
      period: t.Optional(t.String()),
      train_pct: t.Optional(t.String()),
      retrain: t.Optional(t.String()),
    }),
  })

  // ── Factor / ML model (multi-factor linear + logistic) ────────────────────
  .get("/factor/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const lookahead = parseInt(query.lookahead || "10");
    const mode      = query.mode || "classification";  // classification | regression
    const period    = query.period || "2y";
    const train_pct = parseFloat(query.train_pct || "0.75");
    const retrain   = query.retrain === "true";
    const cacheKey  = `factor_${symbol}_${period}_${lookahead}_${mode}_${train_pct}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const [history, vixHistory, spxHistory] = await Promise.all([
        fetchHistory(symbol, period),
        fetchHistory("^VIX", period).catch(() => []),
        fetchHistory("^GSPC", period).catch(() => []),
      ]);
      if (history.length < 80) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 80 days" };

      // Align macro data to same length as stock data
      const len = history.length;
      const vixPrices = vixHistory.length >= len
        ? vixHistory.slice(-len).map(h => h.close)
        : new Array(len).fill(0);
      const spxPrices = spxHistory.length >= len
        ? spxHistory.slice(-len).map(h => h.close)
        : new Array(len).fill(0);

      const result  = await runRScript("factor_model.R", {
        ...buildHistInput(history), lookahead, mode, train_pct,
        vix: vixPrices,
        spx: spxPrices,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Factor model failed" };
    }
  }, {
    query: t.Object({
      lookahead: t.Optional(t.String()),
      mode: t.Optional(t.String()),
      period: t.Optional(t.String()),
      train_pct: t.Optional(t.String()),
      retrain: t.Optional(t.String()),
    }),
  })

  // ── Random Forest model ───────────────────────────────────────────────────
  .get("/rf/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const lookahead = parseInt(query.lookahead || "10");
    const n_trees   = parseInt(query.n_trees || "200");
    const period    = query.period || "2y";
    const train_pct = parseFloat(query.train_pct || "0.75");
    const retrain   = query.retrain === "true";
    const cacheKey  = `rf_${symbol}_${period}_${lookahead}_${n_trees}_${train_pct}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 80) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 80 days" };
      const result  = await runRScript("rf_model.R", {
        ...buildHistInput(history), lookahead, n_trees, train_pct,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "RF model failed" };
    }
  }, {
    query: t.Object({
      lookahead: t.Optional(t.String()),
      n_trees: t.Optional(t.String()),
      period: t.Optional(t.String()),
      train_pct: t.Optional(t.String()),
      retrain: t.Optional(t.String()),
    }),
  })

  // ── GARCH volatility forecast ─────────────────────────────────────────────
  .get("/garch/:symbol", async ({ params, query }) => {
    const symbol  = params.symbol.toUpperCase();
    const horizon = parseInt(query.horizon || "14");
    const period  = query.period || "1y";
    const cacheKey = `garch_${symbol}_${period}_${horizon}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 60) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 60 days" };
      const result = await runRScript("garch_forecast.R", {
        prices: history.map(h => h.close), horizon,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "GARCH failed" };
    }
  }, { query: t.Object({ horizon: t.Optional(t.String()), period: t.Optional(t.String()) }) })

  // ── Support & Resistance levels ─────────────────────────────────────────
  .get("/levels/:symbol", async ({ params, query }) => {
    const symbol = params.symbol.toUpperCase();
    const period = query.period || "1y";
    const cacheKey = `levels_${symbol}_${period}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 40) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 40 days" };
      const result = await runRScript("support_resistance.R", {
        ...buildHistInput(history),
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "S/R detection failed" };
    }
  }, { query: t.Object({ period: t.Optional(t.String()) }) })

  // ── Seasonal decomposition ──────────────────────────────────────────────
  .get("/seasonal/:symbol", async ({ params, query }) => {
    const symbol = params.symbol.toUpperCase();
    const period = query.period || "2y";
    const cacheKey = `seasonal_${symbol}_${period}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 60) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 60 days" };
      const result = await runRScript("seasonal_decomp.R", {
        prices: history.map(h => h.close),
        dates:  history.map(h => h.date),
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Seasonal analysis failed" };
    }
  }, { query: t.Object({ period: t.Optional(t.String()) }) })

  // ── Bollinger Band analysis ─────────────────────────────────────────────
  .get("/bollinger/:symbol", async ({ params, query }) => {
    const symbol   = params.symbol.toUpperCase();
    const period   = query.period || "1y";
    const bbPeriod = parseInt(query.bb_period || "20");
    const numSd    = parseFloat(query.num_sd || "2");
    const cacheKey = `bollinger_${symbol}_${period}_${bbPeriod}_${numSd}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < bbPeriod + 20) return { error: "INSUFFICIENT_DATA", message: "Insufficient data" };
      const result = await runRScript("bollinger_model.R", {
        ...buildHistInput(history), period: bbPeriod, num_sd: numSd,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Bollinger analysis failed" };
    }
  }, {
    query: t.Object({
      period: t.Optional(t.String()),
      bb_period: t.Optional(t.String()),
      num_sd: t.Optional(t.String()),
    }),
  })

  // ── Ensemble model ────────────────────────────────────────────────────────
  .get("/ensemble/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const lookahead = parseInt(query.lookahead || "10");
    const period    = query.period || "2y";
    const retrain   = query.retrain === "true";
    const cacheKey  = `ensemble_${symbol}_${period}_${lookahead}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 80) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 80 days" };

      // Run factor and RF in parallel for ensemble votes
      const [factorRes, rfRes] = await Promise.allSettled([
        runRScript("factor_model.R", { ...buildHistInput(history), lookahead, mode: "classification", train_pct: 0.75 }).catch(() => null),
        runRScript("rf_model.R",     { ...buildHistInput(history), lookahead, n_trees: 150, train_pct: 0.75 }).catch(() => null),
      ]);

      const modelResults = [];
      const fr = factorRes.status === "fulfilled" ? factorRes.value : null;
      const rr = rfRes.status === "fulfilled" ? rfRes.value : null;

      if (fr?.success) modelResults.push({
        name: "Multi-Factor", direction: fr.prediction?.next_direction || "Unknown",
        prob_up: fr.prediction?.probability_up ?? 0.5,
        skill_score: fr.walk_forward?.skill_score ?? 0,
      });
      if (rr?.success) modelResults.push({
        name: "Random Forest", direction: rr.prediction?.next_direction || "Unknown",
        prob_up: rr.prediction?.probability_up ?? 0.5,
        skill_score: rr.walk_forward?.skill_score ?? 0,
      });

      const result = await runRScript("ensemble_model.R", {
        ...buildHistInput(history), lookahead, model_results: modelResults,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Ensemble failed" };
    }
  }, {
    query: t.Object({
      lookahead: t.Optional(t.String()),
      period: t.Optional(t.String()),
      retrain: t.Optional(t.String()),
    }),
  })

  // ── Model comparison: run all models and return summary ───────────────────
  .get("/compare/:symbol", async ({ params, query }) => {
    const symbol    = params.symbol.toUpperCase();
    const lookahead = parseInt(query.lookahead || "10");
    const period    = query.period || "2y";
    const retrain   = query.retrain === "true";
    const cacheKey  = `compare_${symbol}_${period}_${lookahead}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const [history, vixHistory, spxHistory] = await Promise.all([
        fetchHistory(symbol, period),
        fetchHistory("^VIX", period).catch(() => []),
        fetchHistory("^GSPC", period).catch(() => []),
      ]);
      if (history.length < 80) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 80 days" };
      const inp = buildHistInput(history);

      // Align macro data for factor model
      const len = history.length;
      const vixPrices = vixHistory.length >= len ? vixHistory.slice(-len).map(h => h.close) : new Array(len).fill(0);
      const spxPrices = spxHistory.length >= len ? spxHistory.slice(-len).map(h => h.close) : new Array(len).fill(0);

      const [etsR, factorR, rfR, backR] = await Promise.allSettled([
        runRScript("ets_model.R",         { prices: inp.prices, dates: inp.dates, horizon: lookahead, train_pct: 0.80 }),
        runRScript("factor_model.R",      { ...inp, lookahead, mode: "classification", train_pct: 0.75, vix: vixPrices, spx: spxPrices }),
        runRScript("rf_model.R",          { ...inp, lookahead, n_trees: 200, train_pct: 0.75 }),
        runRScript("enhanced_backtest.R", { ...inp, window: 20, lookahead }),
      ]);

      const extract = (r: PromiseSettledResult<any>, name: string) => {
        if (r.status === "rejected" || !r.value?.success) {
          return { name, success: false, error: r.status === "rejected" ? r.reason?.message : r.value?.error };
        }
        const v = r.value;
        return {
          name,
          success: true,
          model_type: v.model_type || name,
          direction: v.prediction?.next_direction || v.summary?.directional_bias || "N/A",
          prob_up: v.prediction?.probability_up ?? null,
          confidence: v.prediction?.confidence ?? v.summary?.confidence_score ?? null,
          dir_accuracy: v.walk_forward?.dir_accuracy ?? v.performance?.dir_accuracy ?? null,
          skill_score: v.walk_forward?.skill_score ?? v.performance?.skill_score ?? null,
          rmse: v.walk_forward?.rmse ?? v.performance?.oos_rmse ?? null,
          n_steps: v.walk_forward?.n_steps ?? null,
          interpretation: v.walk_forward?.interpretation ?? v.performance?.interpretation ?? "",
          raw: v,
        };
      };

      const models = [
        extract(etsR, "ETS/ARIMA"),
        extract(factorR, "Multi-Factor"),
        extract(rfR, "Random Forest"),
        extract(backR, "Pattern Backtest v2"),
      ];

      // Agreement score: % of successful models that agree on direction
      const successful = models.filter((m) => m.success && m.direction && !["N/A", "Unknown", "No matches found", "Mixed / Uncertain"].includes(m.direction));
      const nUp   = successful.filter((m) => m.direction?.toLowerCase().includes("up") || m.direction?.toLowerCase().includes("bull")).length;
      const nDown = successful.filter((m) => m.direction?.toLowerCase().includes("down") || m.direction?.toLowerCase().includes("bear")).length;
      const consensus = successful.length > 0
        ? Math.max(nUp, nDown) / successful.length
        : 0;
      const consensusDir = nUp >= nDown ? "Bullish" : "Bearish";

      const result = {
        symbol, period, lookahead,
        models,
        consensus: {
          direction: consensusDir,
          agreement_pct: Math.round(consensus * 100),
          n_bullish: nUp, n_bearish: nDown,
          n_models: successful.length,
          label: consensus >= 0.75 ? "Strong Consensus"
            : consensus >= 0.5 ? "Moderate Consensus"
            : "No Consensus — Models Disagree",
        },
        lastPrice: inp.prices[inp.prices.length - 1],
        dataPoints: history.length,
      };
      setCache(cacheKey, result, CACHE_TTL_ML);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Model comparison failed" };
    }
  }, {
    query: t.Object({
      lookahead: t.Optional(t.String()),
      period: t.Optional(t.String()),
      retrain: t.Optional(t.String()),
    }),
  })

  // ── Holt-Winters Exponential Smoothing ──────────────────────────────────
  // HWES now redirects to ETS (Holt-Winters is a special case of ETS) — kept for backwards compatibility
  .get("/hwes/:symbol", async ({ params, query }) => {
    const symbol  = params.symbol.toUpperCase();
    const horizon = parseInt(query.horizon || "14");
    const period  = query.period || "1y";
    const cacheKey = `ets_${symbol}_${period}_${horizon}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return { ...cached, _note: "Consolidated: HWES now uses ETS engine (superset)" };

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 40) return { error: "INSUFFICIENT_DATA", message: "Need >= 40 days" };
      const result = await runRScript("ets_model.R", {
        prices: history.map(h => h.close), dates: history.map(h => h.date), horizon, train_pct: 0.80,
      });
      if (result.success) { result.symbol = symbol; result._note = "Consolidated: HWES now uses ETS engine (superset)"; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "ETS (formerly HWES) failed" };
    }
  }, { query: t.Object({ horizon: t.Optional(t.String()), period: t.Optional(t.String()) }) })

  // ── Bayesian Regression forecast ───────────────────────────────────────
  .get("/bayesian/:symbol", async ({ params, query }) => {
    const symbol  = params.symbol.toUpperCase();
    const horizon = parseInt(query.horizon || "14");
    const period  = query.period || "1y";
    const retrain = query.retrain === "true";
    const cacheKey = `bayesian_${symbol}_${period}_${horizon}`;
    if (!retrain) { const c = getCache<any>(cacheKey); if (c) return c; }

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 60) return { error: "INSUFFICIENT_DATA", message: "Need >= 60 days" };
      const result = await runRScript("bayesian_model.R", {
        ...buildHistInput(history), horizon,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Bayesian model failed" };
    }
  }, { query: t.Object({ horizon: t.Optional(t.String()), period: t.Optional(t.String()), retrain: t.Optional(t.String()) }) })

  // ── Regime Detection + Conditional Forecast ───────────────────────────
  .get("/regime/:symbol", async ({ params, query }) => {
    const symbol  = params.symbol.toUpperCase();
    const horizon = parseInt(query.horizon || "14");
    const period  = query.period || "2y";
    const cacheKey = `regime_${symbol}_${period}_${horizon}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 100) return { error: "INSUFFICIENT_DATA", message: "Need >= 100 days" };
      const result = await runRScript("regime_model.R", {
        ...buildHistInput(history), horizon,
      });
      if (result.success) { result.symbol = symbol; setCache(cacheKey, result, CACHE_TTL_ML); }
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Regime detection failed" };
    }
  }, { query: t.Object({ horizon: t.Optional(t.String()), period: t.Optional(t.String()) }) })

  // ── Master forecast: run ALL models and combine ───────────────────────
  .get("/master/:symbol", async ({ params, query }) => {
    const symbol  = params.symbol.toUpperCase();
    const horizon = parseInt(query.horizon || "14");
    const period  = query.period || "1y";
    const cacheKey = `master_${symbol}_${period}_${horizon}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const history = await fetchHistory(symbol, period);
      if (history.length < 60) return { error: "INSUFFICIENT_DATA", message: "Need >= 60 days" };
      const inp = buildHistInput(history);
      const lastPrice = inp.prices[inp.prices.length - 1];

      // Run all forecast models in parallel
      const [arimaR, garchR, hwesR, bayesR, regimeR] = await Promise.allSettled([
        runRScript("arima_forecast.R", { prices: inp.prices, horizon }),
        runRScript("garch_forecast.R", { prices: inp.prices, horizon }),
        runRScript("hwes_model.R",     { prices: inp.prices, horizon }),
        runRScript("bayesian_model.R", { ...inp, horizon }),
        history.length >= 100
          ? runRScript("regime_model.R", { ...inp, horizon })
          : Promise.resolve({ success: false, error: "Need >= 100 days" }),
      ]);

      const extract = (r: PromiseSettledResult<any>, name: string) => {
        if (r.status === "rejected") return { name, success: false, error: "Execution failed" };
        const v = r.value;
        if (!v?.success) return { name, success: false, error: v?.error || "Model failed" };

        // Normalize forecast to common format: [{day, point, lo80, hi80, lo95, hi95}]
        let forecast = [];
        if (name === "ARIMA") {
          forecast = v.forecast || [];
        } else if (name === "GARCH") {
          forecast = (v.price_forecast || []).map((p: any) => ({
            day: p.day, point: p.mean, lo80: p.lo80, hi80: p.hi80, lo95: p.lo95, hi95: p.hi95,
          }));
        } else if (name === "Holt-Winters") {
          forecast = (v.best_forecast || []).map((p: any) => ({
            day: p.day, point: p.point, lo80: p.lo80, hi80: p.hi80, lo95: p.lo95, hi95: p.hi95,
          }));
        } else if (name === "Bayesian") {
          forecast = (v.forecast || []).map((p: any) => ({
            day: p.day, point: p.mean, lo80: p.lo80, hi80: p.hi80, lo95: p.lo95, hi95: p.hi95,
          }));
        } else if (name === "Regime") {
          forecast = (v.forecast || []).map((p: any) => ({
            day: p.day, point: p.mean, lo80: p.lo80, hi80: p.hi80, lo95: p.lo95, hi95: p.hi95,
          }));
        }

        const endPoint = forecast.length > 0 ? forecast[forecast.length - 1]?.point ?? lastPrice : lastPrice;
        const direction = endPoint > lastPrice ? "Bullish" : endPoint < lastPrice ? "Bearish" : "Neutral";
        const returnPct = ((endPoint / lastPrice) - 1) * 100;

        return {
          name, success: true,
          forecast,
          endPoint: Math.round(endPoint * 100) / 100,
          direction,
          returnPct: Math.round(returnPct * 100) / 100,
          probUp: v.probability?.prob_up ?? null,
          walkForward: v.walk_forward ?? null,
          regime: v.current_regime ?? null,
          model_detail: name === "ARIMA" ? v.model :
                       name === "GARCH" ? v.model?.type :
                       name === "Holt-Winters" ? v.best_model :
                       name === "Bayesian" ? "Bayesian LR" :
                       name === "Regime" ? `Regime: ${v.current_regime}` : name,
          extra: name === "Bayesian" ? { importance: v.importance, distribution: v.return_distribution, histogram: v.histogram } :
                 name === "Regime" ? { stats: v.regime_stats, timeline: v.regime_timeline, transition: v.transition_matrix, next_prob: v.next_regime_prob } :
                 name === "Holt-Winters" ? { models: v.models, trend: v.trend } :
                 name === "GARCH" ? { vol: v.current_vol, var: v.var_metrics, regime: v.regime } : null,
        };
      };

      const models = [
        extract(arimaR, "ARIMA"),
        extract(garchR, "GARCH"),
        extract(hwesR, "Holt-Winters"),
        extract(bayesR, "Bayesian"),
        extract(regimeR, "Regime"),
      ];

      const successful = models.filter(m => m.success && m.direction !== "Neutral");
      const nUp = successful.filter(m => m.direction === "Bullish").length;
      const nDown = successful.filter(m => m.direction === "Bearish").length;
      const consensus = successful.length > 0 ? Math.max(nUp, nDown) / successful.length : 0;

      // Weighted consensus using walk-forward skill
      let weightedUp = 0, weightedTotal = 0;
      for (const m of successful) {
        const w = Math.max(0.1, 1 + ((m as any).walkForward?.skill_score ?? 0) / 100);
        weightedTotal += w;
        if (m.direction === "Bullish") weightedUp += w;
      }
      const weightedBullPct = weightedTotal > 0 ? (weightedUp / weightedTotal) * 100 : 50;

      // Average forecast path
      const validForecasts = models.filter(m => m.success && (m as any).forecast?.length > 0);
      const avgPath: any[] = [];
      if (validForecasts.length > 0) {
        const maxLen = Math.max(...validForecasts.map(m => (m as any).forecast.length));
        for (let d = 0; d < maxLen; d++) {
          const points = validForecasts.map(m => (m as any).forecast[d]?.point).filter(Boolean);
          const lo80s = validForecasts.map(m => (m as any).forecast[d]?.lo80).filter(Boolean);
          const hi80s = validForecasts.map(m => (m as any).forecast[d]?.hi80).filter(Boolean);
          if (points.length > 0) {
            avgPath.push({
              day: d + 1,
              consensus: Math.round(points.reduce((a: number, b: number) => a + b, 0) / points.length * 100) / 100,
              lo80: Math.round(Math.min(...lo80s) * 100) / 100,
              hi80: Math.round(Math.max(...hi80s) * 100) / 100,
            });
          }
        }
      }

      const result = {
        symbol, period, horizon, lastPrice,
        models,
        consensus: {
          direction: nUp >= nDown ? "Bullish" : "Bearish",
          agreement_pct: Math.round(consensus * 100),
          weighted_bull_pct: Math.round(weightedBullPct),
          n_bullish: nUp, n_bearish: nDown,
          n_models: successful.length,
          total_models: models.length,
          label: consensus >= 0.8 ? "Strong Consensus"
            : consensus >= 0.6 ? "Moderate Consensus"
            : "Models Disagree",
        },
        avgPath,
        dataPoints: history.length,
      };
      setCache(cacheKey, result, CACHE_TTL_ML);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Master forecast failed" };
    }
  }, { query: t.Object({ horizon: t.Optional(t.String()), period: t.Optional(t.String()) }) })

  // ── Reset / retrain: clear model cache ───────────────────────────────────
  .delete("/cache/:symbol", async ({ params, query }) => {
    const symbol = params.symbol.toUpperCase();
    const model  = query.model || "all";
    const prefixes = model === "all"
      ? ["forecast_", "risk_", "backtest_v2_", "ets_", "factor_", "rf_", "ensemble_", "compare_", "hwes_", "bayesian_", "regime_", "master_"]
      : [`${model}_`];

    let cleared = 0;
    for (const pfx of prefixes) {
      cleared += deleteCacheByPrefix(`${pfx}${symbol}`);
    }
    return { success: true, symbol, cleared, message: `Cleared ${cleared} cache entries for ${symbol}` };
  }, {
    query: t.Object({ model: t.Optional(t.String()) }),
  })

  // ── Portfolio strategy simulation ──────────────────────────────────────
  .get("/portfolio-strategy", async ({ query }) => {
    const symbols  = (query.symbols || "").split(",").filter(Boolean).map(s => s.trim().toUpperCase());
    const weights  = (query.weights || "").split(",").map(Number).filter(n => !isNaN(n));
    const strategy = query.strategy || "long";
    const strategy2 = query.strategy2 || "";
    const goalReturn = parseFloat(query.goal_return || "10");
    const goalYears  = parseFloat(query.goal_years || "5");
    const initial    = parseFloat(query.initial || "10000");
    const monthly    = parseFloat(query.monthly || "0");
    const riskTolerance = query.risk_tolerance || "Moderate";
    const rebalance  = query.rebalance || "Quarterly";
    const stopLoss   = parseFloat(query.stop_loss || "0");
    const takeProfit = parseFloat(query.take_profit || "0");

    if (symbols.length < 1) return { error: "BAD_REQUEST", message: "Need at least 1 symbol" };
    const cacheKey = `pstrat_${symbols.join("_")}_${strategy}_${strategy2}_${goalReturn}_${goalYears}_${initial}_${monthly}_${riskTolerance}_${rebalance}_${stopLoss}_${takeProfit}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const histories = await Promise.all(symbols.map(s => fetchHistory(s, "2y")));
      const minLen = Math.min(...histories.map(h => h.length));
      if (minLen < 30) return { error: "INSUFFICIENT_DATA", message: "Need >= 30 data points" };

      const returnsObj: Record<string, number[]> = {};
      symbols.forEach((sym, i) => {
        const prices = histories[i].slice(-minLen).map(d => d.close);
        const rets: number[] = [];
        for (let j = 1; j < prices.length; j++) rets.push(prices[j] / prices[j - 1] - 1);
        returnsObj[sym] = rets;
      });

      const result = await runRScript("portfolio_strategy.R", {
        returns: returnsObj,
        symbols,
        weights: weights.length === symbols.length ? weights : symbols.map(() => 1 / symbols.length),
        strategy,
        strategy2,
        goal_return: goalReturn,
        goal_years: goalYears,
        initial,
        monthly,
        risk_tolerance: riskTolerance,
        rebalance,
        stop_loss: stopLoss,
        take_profit: takeProfit,
      });

      if (result.success) setCache(cacheKey, result, CACHE_TTL_ML);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Portfolio strategy failed" };
    }
  }, {
    query: t.Object({
      symbols: t.Optional(t.String()),
      weights: t.Optional(t.String()),
      strategy: t.Optional(t.String()),
      strategy2: t.Optional(t.String()),
      goal_return: t.Optional(t.String()),
      goal_years: t.Optional(t.String()),
      initial: t.Optional(t.String()),
      monthly: t.Optional(t.String()),
      risk_tolerance: t.Optional(t.String()),
      rebalance: t.Optional(t.String()),
      stop_loss: t.Optional(t.String()),
      take_profit: t.Optional(t.String()),
    }),
  })

  // ── Portfolio optimization (original) ─────────────────────────────────────
  .get("/portfolio", async ({ query }) => {
    const symbols  = (query.symbols || "").split(",").filter(Boolean).map((s) => s.trim().toUpperCase());
    if (symbols.length < 2) return { error: "BAD_REQUEST", message: "Need at least 2 symbols" };
    const cacheKey = `portfolio_${symbols.sort().join("_")}`;
    const cached   = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const histories   = await Promise.all(symbols.map((s) => fetchHistory(s, "1y")));
      const minLen      = Math.min(...histories.map((h) => h.length));
      if (minLen < 30) return { error: "INSUFFICIENT_DATA", message: "Need ≥ 30 points" };

      const assetReturns = histories.map((h) => {
        const prices = h.slice(-minLen).map((d) => d.close);
        return toReturns(prices);
      });
      const returnsObj: Record<string, number[]> = {};
      symbols.forEach((sym, i) => { returnsObj[sym] = assetReturns[i]; });

      const optResult  = await runRScript("portfolio_optimize.R", { returns: returnsObj, symbols, risk_free: 0.05 });
      const eqWeights  = symbols.map(() => 1 / symbols.length);
      const mcResult   = await runRScript("monte_carlo.R", { returns: returnsObj, weights: eqWeights, simulations: 5000, days: 21 });

      let mcOptimal = null;
      if (optResult.success && optResult.max_sharpe) {
        const optWeights = symbols.map((s) => optResult.max_sharpe.weights[s] || 0);
        mcOptimal = await runRScript("monte_carlo.R", { returns: returnsObj, weights: optWeights, simulations: 5000, days: 21 });
      }

      const result = { symbols, optimization: optResult, monteCarlo: { equalWeight: mcResult, optimized: mcOptimal } };
      if (optResult.success) setCache(cacheKey, result, CACHE_TTL);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Portfolio analysis failed" };
    }
  }, { query: t.Object({ symbols: t.Optional(t.String()) }) })

  /* ── ML-based Weight Optimizer ───────────────────────────────────────── */
  .get("/optimize-weights", async ({ query }) => {
    const symbols = (query.symbols || "").split(",").filter(Boolean).map((s) => s.trim().toUpperCase());
    if (symbols.length < 2) return { error: "BAD_REQUEST", message: "Need at least 2 symbols" };
    const risk = query.risk_tolerance || "Moderate";
    const cacheKey = `optw_${symbols.sort().join("_")}_${risk}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch up to 10 years of daily data per symbol
      const histories = await Promise.all(
        symbols.map((s) => fetchHistory(s, "10y").catch(() => fetchHistory(s, "5y").catch(() => fetchHistory(s, "3y"))))
      );

      const minLen = Math.min(...histories.map((h) => h.length));
      if (minLen < 252) return { error: "INSUFFICIENT_DATA", message: "Need at least 1 year of data" };

      const assetReturns: Record<string, number[]> = {};
      symbols.forEach((sym, i) => {
        const prices = histories[i].slice(-minLen).map((d) => d.close);
        assetReturns[sym] = toReturns(prices);
      });

      const result = await runRScript("weight_optimizer.R", {
        returns: assetReturns,
        symbols,
        risk_tolerance: risk,
        risk_free: 0.05,
      });

      if (result.success) setCache(cacheKey, result, CACHE_TTL_ML);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Weight optimization failed", success: false, confidence: 0 };
    }
  }, { query: t.Object({ symbols: t.Optional(t.String()), risk_tolerance: t.Optional(t.String()) }) })

  /* ── Multi-Model Portfolio Optimizer ──────────────────────────────────── */
  .get("/multi-optimize", async ({ query }) => {
    const symbols = (query.symbols || "").split(",").filter(Boolean).map((s) => s.trim().toUpperCase());
    if (symbols.length < 2) return { error: "BAD_REQUEST", message: "Need at least 2 symbols" };
    const cacheKey = `multiopt_${symbols.sort().join("_")}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch up to 5 years of daily data per symbol (fallback 3y, 2y)
      const histories = await Promise.all(
        symbols.map((s) =>
          fetchHistory(s, "5y")
            .catch(() => fetchHistory(s, "3y"))
            .catch(() => fetchHistory(s, "2y"))
        )
      );

      const minLen = Math.min(...histories.map((h) => h.length));
      if (minLen < 252) return { error: "INSUFFICIENT_DATA", message: "Need at least 1 year of data" };

      const assetReturns: Record<string, number[]> = {};
      symbols.forEach((sym, i) => {
        const prices = histories[i].slice(-minLen).map((d) => d.close);
        assetReturns[sym] = toReturns(prices);
      });

      const result = await runRScript("multi_model_optimizer.R", {
        returns: assetReturns,
        symbols,
        risk_free: 0.05,
      });

      if (result.success) setCache(cacheKey, result, CACHE_TTL_ML);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Multi-model optimization failed", success: false };
    }
  }, { query: t.Object({ symbols: t.Optional(t.String()) }) })

  /* ── Model Accuracy Leaderboard ─────────────────────────────────────── */
  .get("/accuracy/:symbol", async ({ params, query }) => {
    const symbol = params.symbol.toUpperCase();
    const period = query.period || "2y";
    const lookahead = parseInt(query.lookahead || "10");
    const cacheKey = `accuracy_${symbol}_${period}_${lookahead}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const [history, vixHistory, spxHistory] = await Promise.all([
        fetchHistory(symbol, period),
        fetchHistory("^VIX", period).catch(() => []),
        fetchHistory("^GSPC", period).catch(() => []),
      ]);
      if (history.length < 80) return { error: "INSUFFICIENT_DATA", message: "Need >= 80 days" };
      const inp = buildHistInput(history);
      const len = history.length;
      const vixPrices = vixHistory.length >= len ? vixHistory.slice(-len).map(h => h.close) : new Array(len).fill(0);
      const spxPrices = spxHistory.length >= len ? spxHistory.slice(-len).map(h => h.close) : new Array(len).fill(0);

      // Run all models in parallel
      const [etsR, factorR, rfR, backtestR, bayesR, garchR] = await Promise.allSettled([
        runRScript("ets_model.R",          { prices: inp.prices, dates: inp.dates, horizon: lookahead, train_pct: 0.80 }),
        runRScript("factor_model.R",       { ...inp, lookahead, mode: "classification", train_pct: 0.75, vix: vixPrices, spx: spxPrices }),
        runRScript("rf_model.R",           { ...inp, lookahead, n_trees: 200, train_pct: 0.75 }),
        runRScript("enhanced_backtest.R",  { ...inp, window: 20, lookahead }),
        runRScript("bayesian_model.R",     { prices: inp.prices, dates: inp.dates, horizon: lookahead }),
        runRScript("garch_forecast.R",     { prices: inp.prices, dates: inp.dates, horizon: lookahead }),
      ]);

      const extractAccuracy = (r: PromiseSettledResult<any>, name: string, type: string) => {
        if (r.status === "rejected" || !r.value?.success) {
          return { name, type, status: "failed", error: r.status === "rejected" ? r.reason?.message : r.value?.error };
        }
        const v = r.value;
        return {
          name,
          type,
          status: "ok",
          direction: v.prediction?.next_direction || v.summary?.directional_bias || "N/A",
          dir_accuracy: v.walk_forward?.dir_accuracy ?? v.performance?.dir_accuracy ?? null,
          skill_score: v.walk_forward?.skill_score ?? v.performance?.skill_score ?? null,
          rmse: v.walk_forward?.rmse ?? v.performance?.oos_rmse ?? null,
          n_steps: v.walk_forward?.n_steps ?? null,
          confidence: v.prediction?.confidence ?? v.summary?.confidence_score ?? null,
          prob_up: v.prediction?.probability_up ?? null,
          interpretation: v.walk_forward?.interpretation ?? v.performance?.interpretation ?? "",
        };
      };

      const models = [
        extractAccuracy(etsR,      "ETS/ARIMA",         "time-series"),
        extractAccuracy(factorR,   "Multi-Factor+Macro","ml"),
        extractAccuracy(rfR,       "Random Forest",     "ml"),
        extractAccuracy(backtestR, "Pattern Backtest",  "pattern"),
        extractAccuracy(bayesR,    "Bayesian",          "probabilistic"),
        extractAccuracy(garchR,    "GARCH Volatility",  "volatility"),
      ];

      // Rank by accuracy
      const ranked = models
        .filter(m => m.status === "ok" && m.dir_accuracy !== null)
        .sort((a, b) => (b.dir_accuracy ?? 0) - (a.dir_accuracy ?? 0))
        .map((m, i) => ({ ...m, rank: i + 1 }));

      // Best model consensus
      const top3 = ranked.slice(0, 3);
      const bullish = top3.filter(m => m.direction?.toLowerCase().includes("up") || m.direction?.toLowerCase().includes("bull")).length;
      const bearish = top3.filter(m => m.direction?.toLowerCase().includes("down") || m.direction?.toLowerCase().includes("bear")).length;

      const result = {
        symbol,
        period,
        lookahead,
        dataPoints: history.length,
        lastPrice: inp.prices[inp.prices.length - 1],
        leaderboard: ranked,
        failed: models.filter(m => m.status === "failed"),
        top3_consensus: {
          direction: bullish >= bearish ? "Bullish" : "Bearish",
          bullish_count: bullish,
          bearish_count: bearish,
          avg_accuracy: top3.length > 0 ? Math.round(top3.reduce((s, m) => s + (m.dir_accuracy ?? 0), 0) / top3.length * 10) / 10 : null,
          avg_skill: top3.length > 0 ? Math.round(top3.reduce((s, m) => s + (m.skill_score ?? 0), 0) / top3.length * 10) / 10 : null,
        },
        note: "Models ranked by walk-forward directional accuracy. Skill score = accuracy above naive baseline (always predict up). Higher skill = more predictive value.",
      };

      setCache(cacheKey, result, CACHE_TTL_ML);
      return result;
    } catch (e: any) {
      return { error: "R_ERROR", message: e.message || "Accuracy tracking failed" };
    }
  }, {
    query: t.Object({
      period: t.Optional(t.String()),
      lookahead: t.Optional(t.String()),
    }),
  });
