import { useState, useCallback } from "react";
import { Brain, Sparkles, Check, ArrowUpDown } from "lucide-react";

interface ModelResult {
  name: string;
  weights: Record<string, number>;
  ann_return: number;
  ann_vol: number;
  sharpe: number;
  max_drawdown: number;
  outperf_years: number;
  total_years: number;
}

interface MultiOptResult {
  success: boolean;
  models: ModelResult[];
  equal_weight: { ann_return: number; ann_vol: number; sharpe: number };
  best_model: string;
  error?: string;
}

export interface MultiModelPanelProps {
  assets: { symbol: string; weight: number }[];
  onApplyWeights: (weights: Record<string, number>) => void;
}

const MODEL_COLORS: Record<string, string> = {
  "Mean-Variance": "#4f46e5",
  "Min Volatility": "#059669",
  "Risk Parity": "#d97706",
  "Max Diversification": "#7c3aed",
  "Momentum-Weighted": "#dc2626",
};

const SORT_OPTIONS = [
  { key: "sharpe", label: "Sharpe" },
  { key: "ann_return", label: "Return" },
  { key: "ann_vol", label: "Volatility" },
  { key: "max_drawdown", label: "Max DD" },
] as const;

type SortKey = typeof SORT_OPTIONS[number]["key"];

function getBadge(model: ModelResult, all: ModelResult[]): string | null {
  const bestSharpe = Math.max(...all.map((m) => m.sharpe));
  const lowestVol = Math.min(...all.map((m) => m.ann_vol));
  const highestRet = Math.max(...all.map((m) => m.ann_return));
  const lowestDD = Math.max(...all.map((m) => m.max_drawdown)); // least negative

  if (model.sharpe === bestSharpe) return "Best Sharpe";
  if (model.ann_vol === lowestVol) return "Lowest Risk";
  if (model.ann_return === highestRet) return "Highest Return";
  if (model.max_drawdown === lowestDD) return "Best Drawdown";
  return null;
}

function WeightsBar({ weights, symbols }: { weights: Record<string, number>; symbols: string[] }) {
  const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#ec4899", "#84cc16", "#f97316", "#06b6d4"];
  return (
    <div className="mm-weights-bar">
      {symbols.map((sym, i) => {
        const pct = weights[sym] || 0;
        if (pct < 0.5) return null;
        return (
          <div
            key={sym}
            className="mm-weights-seg"
            style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
            title={`${sym}: ${pct.toFixed(1)}%`}
          >
            {pct >= 8 && <span className="mm-weights-seg-label">{sym}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function MultiModelPanel({ assets, onApplyWeights }: MultiModelPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiOptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("sharpe");
  const [sortAsc, setSortAsc] = useState(false);

  const symbols = assets.map((a) => a.symbol);

  const runAnalysis = useCallback(async () => {
    if (assets.length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const syms = assets.map((a) => a.symbol).join(",");
      const res = await fetch(`/api/predict/multi-optimize?symbols=${syms}`);
      const data: MultiOptResult = await res.json();
      if (!data.success) throw new Error(data.error || "Multi-model optimization failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [assets]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(key === "ann_vol"); // ascending for vol (lower is better)
    }
  };

  const sortedModels = result
    ? [...result.models].sort((a, b) => {
        const va = a[sortBy];
        const vb = b[sortBy];
        return sortAsc ? va - vb : vb - va;
      })
    : [];

  const handleApply = (model: ModelResult) => {
    const weights: Record<string, number> = {};
    for (const sym of symbols) {
      weights[sym] = Math.round(model.weights[sym] || 0);
    }
    onApplyWeights(weights);
  };

  return (
    <div className="mm-panel">
      {!result && !loading && (
        <button
          className="mm-run-btn"
          onClick={runAnalysis}
          disabled={loading || assets.length < 2}
        >
          <Brain size={14} />
          <Sparkles size={12} />
          Run Multi-Model Analysis
        </button>
      )}

      {loading && (
        <div className="mm-loading">
          <div className="mm-loading-spinner" />
          <span>Running 5 optimization models...</span>
          <div className="mm-loading-bar">
            <div className="mm-loading-fill" />
          </div>
        </div>
      )}

      {error && (
        <div className="mm-error">
          {error}
          <button onClick={() => setError(null)} className="mm-error-close">&times;</button>
        </div>
      )}

      {result && (
        <>
          {/* Sort bar */}
          <div className="mm-sort-bar">
            <span className="mm-sort-label"><ArrowUpDown size={11} /> Sort by:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`mm-sort-btn${sortBy === opt.key ? " mm-sort-active" : ""}`}
                onClick={() => handleSort(opt.key)}
              >
                {opt.label}
                {sortBy === opt.key && (sortAsc ? " \u2191" : " \u2193")}
              </button>
            ))}
            <button className="mm-sort-btn mm-rerun-btn" onClick={runAnalysis}>
              Re-run
            </button>
          </div>

          {/* Equal weight baseline */}
          <div className="mm-baseline">
            <span className="mm-baseline-label">Equal Weight Baseline:</span>
            <span className="mm-baseline-metric">
              Ret: <strong>{result.equal_weight.ann_return > 0 ? "+" : ""}{result.equal_weight.ann_return}%</strong>
            </span>
            <span className="mm-baseline-metric">
              Vol: <strong>{result.equal_weight.ann_vol}%</strong>
            </span>
            <span className="mm-baseline-metric">
              Sharpe: <strong>{result.equal_weight.sharpe}</strong>
            </span>
          </div>

          {/* Model cards grid */}
          <div className="mm-grid">
            {sortedModels.map((model) => {
              const isBest = model.name === result.best_model;
              const badge = getBadge(model, result.models);
              const color = MODEL_COLORS[model.name] || "#4f46e5";
              return (
                <div
                  key={model.name}
                  className={`mm-card${isBest ? " mm-card-best" : ""}`}
                  style={{ "--mm-accent": color } as React.CSSProperties}
                >
                  <div className="mm-card-header">
                    <span className="mm-card-dot" style={{ background: color }} />
                    <span className="mm-card-name">{model.name}</span>
                    {badge && <span className="mm-card-badge">{badge}</span>}
                  </div>

                  <WeightsBar weights={model.weights} symbols={symbols} />

                  <div className="mm-card-weights-detail">
                    {symbols.map((sym) => {
                      const pct = model.weights[sym] || 0;
                      if (pct < 0.1) return null;
                      return (
                        <span key={sym} className="mm-w-chip">
                          {sym} {pct.toFixed(1)}%
                        </span>
                      );
                    })}
                  </div>

                  <div className="mm-metrics">
                    <div className="mm-metric-row">
                      <span className="mm-metric-label">Return</span>
                      <span className={`mm-metric-val ${model.ann_return >= 0 ? "text-green" : "text-red"}`}>
                        {model.ann_return > 0 ? "+" : ""}{model.ann_return}%
                      </span>
                    </div>
                    <div className="mm-metric-row">
                      <span className="mm-metric-label">Volatility</span>
                      <span className="mm-metric-val">{model.ann_vol}%</span>
                    </div>
                    <div className="mm-metric-row">
                      <span className="mm-metric-label">Sharpe</span>
                      <span className="mm-metric-val">{model.sharpe}</span>
                    </div>
                    <div className="mm-metric-row">
                      <span className="mm-metric-label">Max DD</span>
                      <span className="mm-metric-val text-red">{model.max_drawdown}%</span>
                    </div>
                    <div className="mm-metric-row">
                      <span className="mm-metric-label">Beat EW</span>
                      <span className="mm-metric-val">{model.outperf_years}/{model.total_years} yrs</span>
                    </div>
                  </div>

                  <button className="mm-apply-btn" onClick={() => handleApply(model)}>
                    <Check size={12} /> Apply Weights
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
