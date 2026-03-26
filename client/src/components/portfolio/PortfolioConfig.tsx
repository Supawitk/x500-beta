import { useState, useMemo, useCallback } from "react";
import {
  Plus, Trash2, Play, Zap, ChevronDown, ChevronUp, Brain, Check, X, Info,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import type { StockQuote, IndustrySummary } from "../../types/stock";
import type { AssetEntry, Strategy } from "./portfolioConstants";
import { STRATEGIES, PRESET_PORTFOLIOS, RISK_TOLERANCE, REBALANCE_FREQ } from "./portfolioConstants";
import { StockPicker } from "./StockPicker";
import { MultiModelPanel } from "./MultiModelPanel";

interface PortfolioConfigProps {
  assets: AssetEntry[];
  setAssets: React.Dispatch<React.SetStateAction<AssetEntry[]>>;
  strategies: Strategy[];
  toggleStrategy: (id: Strategy) => void;
  goalReturn: number;
  setGoalReturn: (v: number) => void;
  goalYears: number;
  setGoalYears: (v: number) => void;
  initial: number;
  setInitial: (v: number) => void;
  monthly: number;
  setMonthly: (v: number) => void;
  riskTolerance: typeof RISK_TOLERANCE[number];
  setRiskTolerance: (v: typeof RISK_TOLERANCE[number]) => void;
  rebalance: typeof REBALANCE_FREQ[number];
  setRebalance: (v: typeof REBALANCE_FREQ[number]) => void;
  stopLoss: number;
  setStopLoss: (v: number) => void;
  takeProfit: number;
  setTakeProfit: (v: number) => void;
  allStocks: StockQuote[];
  industries: IndustrySummary[];
  loading: boolean;
  error: string | null;
  runSimulation: () => void;
}

interface OptResult {
  success: boolean;
  confidence: number;
  confidence_breakdown: { pattern_similarity: number; risk_adjusted_edge: number; yearly_consistency: number; data_depth: number };
  weights: Record<string, number>;
  assets: { symbol: string; weight: number; ann_return: number; ann_vol: number; sharpe: number }[];
  method: string;
  risk_tolerance: string;
  data_years: number;
  n_windows_analyzed: number;
  avg_pattern_similarity: number;
  backtest: { total_return: number; ann_return: number; ann_vol: number; sharpe: number; max_drawdown: number; daily_win_rate: number };
  vs_equal_weight: { eq_total_return: number; eq_ann_return: number; eq_ann_vol: number; eq_sharpe: number; outperformance_ann: number; outperformed_years: number; total_years: number };
  yearly_backtest: { year: number; period: string; optimal_return: number; equal_return: number; optimal_vol: number; optimal_sharpe: number; max_drawdown: number; outperformed: boolean }[];
  equity_curve: { day: number; optimal: number; equal: number }[];
  error?: string;
}

const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#ec4899", "#84cc16", "#f97316", "#06b6d4"];

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 80 ? "var(--green)" : value >= 60 ? "#d97706" : "var(--red)";
  const label = value >= 80 ? "High" : value >= 60 ? "Moderate" : "Low";
  return (
    <div className="pb-conf-meter">
      <div className="pb-conf-track">
        <div className="pb-conf-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="pb-conf-label" style={{ color }}>{value.toFixed(0)}% — {label} Confidence</span>
    </div>
  );
}

function OptimizationPanel({ opt, onApply, onDismiss }: { opt: OptResult; onApply: () => void; onDismiss: () => void }) {
  const [showYearly, setShowYearly] = useState(false);
  const bt = opt.backtest;
  const eq = opt.vs_equal_weight;

  return (
    <div className="pb-opt-panel">
      <div className="pb-opt-header">
        <div className="pb-opt-title">
          <Brain size={16} />
          <span>ML Weight Optimization</span>
        </div>
        <button className="pb-opt-dismiss" onClick={onDismiss}><X size={14} /></button>
      </div>

      <ConfidenceMeter value={opt.confidence} />

      <div className="pb-opt-meta">
        <span>{opt.data_years}y data</span>
        <span>{opt.n_windows_analyzed} patterns analyzed</span>
        <span>Cosine sim: {(opt.avg_pattern_similarity * 100).toFixed(0)}%</span>
      </div>

      {/* Confidence breakdown */}
      <div className="pb-opt-breakdown">
        {Object.entries(opt.confidence_breakdown).map(([k, v]) => (
          <div key={k} className="pb-opt-bk-row">
            <span className="pb-opt-bk-label">{k.replace(/_/g, " ")}</span>
            <div className="pb-opt-bk-bar">
              <div className="pb-opt-bk-fill" style={{ width: `${v * (100 / 30)}%` }} />
            </div>
            <span className="pb-opt-bk-val">{v.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {/* Suggested weights */}
      <div className="pb-opt-weights">
        <h5 className="pb-opt-sub">Suggested Weights</h5>
        {opt.assets.map((a, i) => (
          <div key={a.symbol} className="pb-opt-w-row">
            <span className="pb-opt-w-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="pb-opt-w-sym">{a.symbol}</span>
            <div className="pb-opt-w-bar-wrap">
              <div className="pb-opt-w-bar" style={{ width: `${a.weight}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
            </div>
            <span className="pb-opt-w-pct">{a.weight}%</span>
            <span className="pb-opt-w-meta">
              {a.ann_return > 0 ? "+" : ""}{a.ann_return}% ret | {a.ann_vol}% vol
            </span>
          </div>
        ))}
      </div>

      {/* Backtest summary */}
      <div className="pb-opt-bt">
        <h5 className="pb-opt-sub">Backtest vs Equal Weight</h5>
        <div className="pb-opt-bt-grid">
          <div className="pb-opt-bt-card">
            <span className="pb-opt-bt-label">Optimized</span>
            <span className="pb-opt-bt-val" style={{ color: bt.ann_return > 0 ? "var(--green)" : "var(--red)" }}>
              {bt.ann_return > 0 ? "+" : ""}{bt.ann_return}%
            </span>
            <span className="pb-opt-bt-sub">Ann. Return</span>
          </div>
          <div className="pb-opt-bt-card">
            <span className="pb-opt-bt-label">Equal Wt</span>
            <span className="pb-opt-bt-val" style={{ color: eq.eq_ann_return > 0 ? "var(--green)" : "var(--red)" }}>
              {eq.eq_ann_return > 0 ? "+" : ""}{eq.eq_ann_return}%
            </span>
            <span className="pb-opt-bt-sub">Ann. Return</span>
          </div>
          <div className="pb-opt-bt-card">
            <span className="pb-opt-bt-label">Sharpe</span>
            <span className="pb-opt-bt-val">{bt.sharpe}</span>
            <span className="pb-opt-bt-sub">vs {eq.eq_sharpe} EW</span>
          </div>
          <div className="pb-opt-bt-card">
            <span className="pb-opt-bt-label">Max DD</span>
            <span className="pb-opt-bt-val text-red">{bt.max_drawdown}%</span>
            <span className="pb-opt-bt-sub">Win rate: {bt.daily_win_rate}%</span>
          </div>
        </div>
        <div className="pb-opt-bt-outperf">
          Outperformed equal weight in <strong>{eq.outperformed_years}/{eq.total_years}</strong> years
          ({((eq.outperformed_years / Math.max(1, eq.total_years)) * 100).toFixed(0)}%)
        </div>
      </div>

      {/* Equity curve */}
      {opt.equity_curve.length > 0 && (
        <div className="pb-opt-chart">
          <h5 className="pb-opt-sub">Equity Curve</h5>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={opt.equity_curve}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="day" tick={false} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: any) => `${Number(v).toFixed(1)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line dataKey="optimal" stroke="#4f46e5" strokeWidth={2} dot={false} name="Optimized" />
              <Line dataKey="equal" stroke="#9ca3af" strokeWidth={1.5} dot={false} name="Equal Weight" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Yearly toggle */}
      <button className="pb-opt-yearly-toggle" onClick={() => setShowYearly(!showYearly)}>
        {showYearly ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showYearly ? "Hide" : "Show"} yearly breakdown
      </button>
      {showYearly && (
        <div className="pb-opt-yearly">
          {opt.yearly_backtest.map((y) => (
            <div key={y.year} className={`pb-opt-yr-row ${y.outperformed ? "pb-opt-yr-win" : "pb-opt-yr-lose"}`}>
              <span className="pb-opt-yr-period">{y.period}</span>
              <span className="pb-opt-yr-ret" style={{ color: y.optimal_return > 0 ? "var(--green)" : "var(--red)" }}>
                {y.optimal_return > 0 ? "+" : ""}{y.optimal_return}%
              </span>
              <span className="text-muted">vs</span>
              <span className="pb-opt-yr-ret" style={{ color: y.equal_return > 0 ? "var(--green)" : "var(--red)" }}>
                {y.equal_return > 0 ? "+" : ""}{y.equal_return}%
              </span>
              <span className="pb-opt-yr-sharpe">Sharpe {y.optimal_sharpe}</span>
              {y.outperformed ? <Check size={12} className="text-green" /> : <X size={12} className="text-red" />}
            </div>
          ))}
        </div>
      )}

      {/* Apply / dismiss */}
      <div className="pb-opt-actions">
        <button className="pb-opt-apply" onClick={onApply}>
          <Check size={14} /> Apply Weights
        </button>
        <button className="pb-opt-skip" onClick={onDismiss}>Keep Current</button>
      </div>

      <p className="pb-opt-disclaimer">
        <Info size={10} /> Based on {opt.data_years}y of historical data using cosine-similarity weighted mean-variance optimization. Past performance does not guarantee future results.
      </p>
    </div>
  );
}

export function PortfolioConfig({
  assets, setAssets, strategies, toggleStrategy,
  goalReturn, setGoalReturn, goalYears, setGoalYears,
  initial, setInitial, monthly, setMonthly,
  riskTolerance, setRiskTolerance, rebalance, setRebalance,
  stopLoss, setStopLoss, takeProfit, setTakeProfit,
  allStocks, industries, loading, error, runSimulation,
}: PortfolioConfigProps) {
  const [newSymbol, setNewSymbol] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<OptResult | null>(null);
  const [optError, setOptError] = useState<string | null>(null);
  const [showMultiModel, setShowMultiModel] = useState(false);

  const totalWeight = useMemo(() => assets.reduce((s, a) => s + a.weight, 0), [assets]);
  const existingSyms = useMemo(() => new Set(assets.map(a => a.symbol)), [assets]);

  const addAsset = useCallback(() => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym || assets.find(a => a.symbol === sym)) return;
    setAssets(prev => [...prev, { symbol: sym, weight: Math.max(1, 100 - totalWeight) }]);
    setNewSymbol("");
  }, [newSymbol, assets, totalWeight, setAssets]);

  const addAssetFromPicker = useCallback((sym: string) => {
    if (assets.find(a => a.symbol === sym)) return;
    const evenWeight = Math.max(1, Math.round(100 / (assets.length + 1)));
    setAssets(prev => [...prev, { symbol: sym, weight: evenWeight }]);
  }, [assets, setAssets]);

  const removeAsset = (sym: string) => setAssets(prev => prev.filter(a => a.symbol !== sym));

  const updateWeight = (sym: string, w: number) => {
    setAssets(prev => prev.map(a => a.symbol === sym ? { ...a, weight: Math.max(0, Math.min(100, w)) } : a));
  };

  const equalizeWeights = () => {
    const w = Math.round(100 / assets.length);
    setAssets(prev => prev.map((a, i) => ({ ...a, weight: i === prev.length - 1 ? 100 - w * (prev.length - 1) : w })));
  };

  const loadPreset = (key: string) => {
    setAssets([...PRESET_PORTFOLIOS[key].assets]);
    setOptResult(null);
  };

  const addQuickPicks = (stocks: StockQuote[], maxCount: number = 5) => {
    const toAdd = stocks.slice(0, maxCount).filter(s => !assets.find(a => a.symbol === s.symbol));
    if (toAdd.length === 0) return;
    const w = Math.round(100 / (assets.length + toAdd.length));
    setAssets(prev => [...prev, ...toAdd.map(s => ({ symbol: s.symbol, weight: w }))]);
  };

  const addIndustryStocks = (ind: IndustrySummary) => {
    const toAdd = ind.symbols.filter(s => !assets.find(a => a.symbol === s));
    if (toAdd.length === 0) return;
    const w = Math.round(100 / (assets.length + toAdd.length));
    setAssets(prev => [...prev, ...toAdd.map(s => ({ symbol: s, weight: w }))]);
  };

  const runOptimize = useCallback(async () => {
    if (assets.length < 2) return;
    setOptimizing(true);
    setOptError(null);
    setOptResult(null);
    try {
      const symbols = assets.map(a => a.symbol).join(",");
      const res = await fetch(`/api/predict/optimize-weights?symbols=${symbols}&risk_tolerance=${riskTolerance}`);
      const data: OptResult = await res.json();
      if (!data.success) throw new Error(data.error || "Optimization failed");
      setOptResult(data);
    } catch (e: any) {
      setOptError(e.message || "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  }, [assets, riskTolerance]);

  const applyOptWeights = useCallback(() => {
    if (!optResult?.weights) return;
    setAssets(prev => prev.map(a => ({
      ...a,
      weight: Math.round(optResult.weights[a.symbol] ?? 0),
    })));
    setOptResult(null);
  }, [optResult, setAssets]);

  const pieData = useMemo(() => assets.map((a, i) => ({
    name: a.symbol, value: a.weight, fill: PIE_COLORS[i % PIE_COLORS.length],
  })), [assets]);

  return (
    <div className="pb-config">
      {/* 1. Investment Goals */}
      <div className="pb-section">
        <h4 className="pb-section-title">Investment Goals</h4>
        <div className="pb-goals">
          <label>Initial Investment ($)
            <input type="number" value={initial} onChange={e => setInitial(+e.target.value)} min={100} step={1000} className="pb-goal-input" />
          </label>
          <label>Monthly Contribution ($)
            <input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)} min={0} step={100} className="pb-goal-input" />
          </label>
          <label>Target Return (% p.a.)
            <div className="pb-slider-row">
              <input type="range" min={1} max={50} value={goalReturn}
                onChange={e => setGoalReturn(+e.target.value)} className="pb-range" />
              <span className="pb-range-val">{goalReturn}%</span>
            </div>
          </label>
          <label>Time Horizon (years)
            <div className="pb-slider-row">
              <input type="range" min={1} max={30} value={goalYears}
                onChange={e => setGoalYears(+e.target.value)} className="pb-range" />
              <span className="pb-range-val">{goalYears}y</span>
            </div>
          </label>
          <label>Risk Tolerance
            <div className="pb-toggle-group">
              {RISK_TOLERANCE.map(r => (
                <button key={r} className={`pb-toggle-btn${riskTolerance === r ? " pb-toggle-active" : ""}`}
                        onClick={() => setRiskTolerance(r)}>{r}</button>
              ))}
            </div>
          </label>
          <label>Rebalance Frequency
            <div className="pb-toggle-group">
              {REBALANCE_FREQ.map(r => (
                <button key={r} className={`pb-toggle-btn${rebalance === r ? " pb-toggle-active" : ""}`}
                        onClick={() => setRebalance(r)}>{r}</button>
              ))}
            </div>
          </label>
        </div>

        <button className="pb-adv-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
          <Zap size={12} /> Advanced Options {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showAdvanced && (
          <div className="pb-advanced">
            <label>Stop Loss (% from peak, 0 = off)
              <div className="pb-slider-row">
                <input type="range" min={0} max={50} value={stopLoss}
                  onChange={e => setStopLoss(+e.target.value)} className="pb-range" />
                <span className="pb-range-val">{stopLoss}%</span>
              </div>
            </label>
            <label>Take Profit (% gain target, 0 = off)
              <div className="pb-slider-row">
                <input type="range" min={0} max={200} step={5} value={takeProfit}
                  onChange={e => setTakeProfit(+e.target.value)} className="pb-range" />
                <span className="pb-range-val">{takeProfit}%</span>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* 2. Strategy */}
      <div className="pb-section">
        <h4 className="pb-section-title">
          Strategy
          <span className="pb-hint">Select 1-2 strategies</span>
        </h4>
        <div className="pb-strategy-grid">
          {STRATEGIES.map(s => {
            const isActive = strategies.includes(s.id);
            const idx = strategies.indexOf(s.id);
            return (
              <button
                key={s.id}
                className={`pb-strat-btn${isActive ? " pb-strat-active" : ""}`}
                onClick={() => toggleStrategy(s.id)}
              >
                <div className="pb-strat-head">
                  <s.icon size={16} />
                  {isActive && <span className="pb-strat-badge">{idx === 0 ? "Primary" : "Secondary"}</span>}
                </div>
                <span className="pb-strat-label">{s.label}</span>
                <span className="pb-strat-desc">{s.desc}</span>
              </button>
            );
          })}
        </div>
        {strategies.length === 2 && (
          <p className="pb-strat-combo-note">
            Combining <strong>{STRATEGIES.find(s => s.id === strategies[0])?.label}</strong> +{" "}
            <strong>{STRATEGIES.find(s => s.id === strategies[1])?.label}</strong>
          </p>
        )}
      </div>

      {/* 3. Stock Picker */}
      <StockPicker
        allStocks={allStocks}
        industries={industries}
        existingSymbols={existingSyms}
        onAddAsset={addAssetFromPicker}
        onRemoveAsset={removeAsset}
        onAddMultiple={addQuickPicks}
        onAddIndustry={addIndustryStocks}
      />

      {/* 4. Assets & Weights */}
      <div className="pb-section">
        <h4 className="pb-section-title">
          Assets ({assets.length})
          <span className="pb-section-actions">
            <button className="pb-eq-btn" onClick={equalizeWeights} title="Equalize weights">= Equal</button>
            <button
              className="pb-ai-btn"
              onClick={runOptimize}
              disabled={optimizing || assets.length < 2}
              title="ML-based weight optimization using 10y backtest with cosine similarity"
            >
              <Brain size={12} /> {optimizing ? "Analyzing..." : "AI Optimize"}
            </button>
            <button
              className="pb-ai-btn"
              onClick={() => setShowMultiModel(!showMultiModel)}
              disabled={assets.length < 2}
              title="Compare 5 optimization models side by side"
              style={{ background: showMultiModel ? "var(--primary)" : undefined, color: showMultiModel ? "white" : undefined }}
            >
              <Brain size={12} /> Multi-Model
            </button>
            <span className={`pb-weight-total ${Math.abs(totalWeight - 100) < 0.1 ? "pb-wt-ok" : "pb-wt-warn"}`}>
              {totalWeight.toFixed(0)}%
            </span>
          </span>
        </h4>

        {/* Presets */}
        <div className="pb-presets">
          {Object.entries(PRESET_PORTFOLIOS).map(([k, v]) => (
            <button key={k} className="pb-preset-btn" onClick={() => loadPreset(k)}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Optimization result */}
        {optError && (
          <div className="pb-opt-error">
            <X size={12} /> {optError}
            <button onClick={() => setOptError(null)} className="pb-opt-error-close"><X size={10} /></button>
          </div>
        )}
        {optResult && (
          <OptimizationPanel
            opt={optResult}
            onApply={applyOptWeights}
            onDismiss={() => setOptResult(null)}
          />
        )}

        {showMultiModel && (
          <MultiModelPanel
            assets={assets}
            onApplyWeights={(weights) => {
              setAssets(prev => prev.map(a => ({
                ...a,
                weight: Math.round(weights[a.symbol] ?? a.weight),
              })));
              setShowMultiModel(false);
            }}
          />
        )}

        <div className="pb-assets">
          {assets.map((a, idx) => {
            const stockInfo = allStocks.find(s => s.symbol === a.symbol);
            return (
              <div key={a.symbol} className="pb-asset-row">
                <div className="pb-asset-info">
                  <span className="pb-asset-dot" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="pb-asset-sym">{a.symbol}</span>
                  {stockInfo && (
                    <span className={`pb-asset-chg ${stockInfo.changePercent >= 0 ? "text-green" : "text-red"}`}>
                      {stockInfo.changePercent >= 0 ? "+" : ""}{stockInfo.changePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <input type="range" min={0} max={100} value={a.weight}
                       onChange={e => updateWeight(a.symbol, Number(e.target.value))}
                       className="pb-range"
                       style={{ "--range-accent": PIE_COLORS[idx % PIE_COLORS.length] } as React.CSSProperties} />
                <input type="number" min={0} max={100} value={a.weight}
                       onChange={e => updateWeight(a.symbol, Number(e.target.value))} className="pb-weight-input" />
                <span className="text-muted">%</span>
                <button className="pb-del-btn" onClick={() => removeAsset(a.symbol)}><Trash2 size={12} /></button>
              </div>
            );
          })}
          <div className="pb-add-row">
            <input type="text" placeholder="Add symbol..." value={newSymbol}
                   onChange={e => setNewSymbol(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && addAsset()}
                   className="pb-add-input" />
            <button className="pb-add-btn" onClick={addAsset} disabled={!newSymbol.trim()}><Plus size={14} /> Add</button>
          </div>
        </div>

        {/* Mini pie chart */}
        {assets.length > 0 && (
          <div className="pb-pie-wrap">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                     outerRadius={55} innerRadius={30} paddingAngle={2} label={({ name, value }) => `${name} ${value}%`}
                     labelLine={false}>
                  {pieData.map(d => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. Run button */}
      <button className="pb-run-btn" onClick={runSimulation} disabled={loading || assets.length === 0}>
        {loading ? "Running simulation..." : <><Play size={16} /> Run Simulation</>}
      </button>
      {strategies.length === 2 && (
        <p className="pb-strat-note-sm">Simulating with primary: <strong>{strategies[0]}</strong></p>
      )}
      {error && <p className="pb-error">{error}</p>}
    </div>
  );
}
